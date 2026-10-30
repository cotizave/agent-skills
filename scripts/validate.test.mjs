// validate.test.mjs — prueba que el detector de validate.mjs funciona.
//
//   node --test scripts/
//
// Los términos reales NUNCA se escriben en el repo. Para probarlos, pásalos al
// correr el test, uno por línea, en un archivo fuera del repo o en una variable:
//
//   FORBIDDEN_TERMS_FILE=/ruta/fuera/del/repo/terminos.txt node --test scripts/
//   FORBIDDEN_TERMS="$(cat /ruta/terminos.txt)" node --test scripts/
//
// Sin esa variable, la prueba con términos reales se omite y solo corren las que
// usan términos ficticios (que validan tokenización, normalización y n-gramas).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findForbidden, normalize, FORBIDDEN_HASHES } from "./forbidden.mjs";

const VALIDATE = join(dirname(fileURLToPath(import.meta.url)), "validate.mjs");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const hashes = (...terms) => new Set(terms.map((t) => sha(normalize(t))));

// Corre validate.mjs --scan sobre un archivo temporal FUERA del repo.
function scan(content) {
  const dir = mkdtempSync(join(tmpdir(), "cotizave-validate-"));
  try {
    const file = join(dir, "caso.txt");
    writeFileSync(file, content);
    return spawnSync(process.execPath, [VALIDATE, "--scan", file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("detecta palabra, tramo de token, ruta y acentos", () => {
  const set = hashes("ficticio", "/v9/privado", "dato.oculto");
  assert.equal(findForbidden("un FICTÍCIO aquí", set).length, 1);
  assert.equal(findForbidden("ver https://x.dato.oculto.net/ya", set).length, 1);
  assert.equal(findForbidden("GET /v9/privado/usuarios", set).length, 1);
  assert.equal(findForbidden("nada que ver con ficticia", set).length, 0);
});

test("detecta expresiones de 2 y 3 palabras, también partidas entre líneas", () => {
  const set = hashes("frase prohibida", "otra frase larga");
  assert.equal(findForbidden("una Frase\nProhibida.", set).length, 1);
  assert.equal(findForbidden("es otra frase larga", set).length, 1);
  assert.equal(findForbidden("frase permitida", set).length, 0);
});

test("q:<palabra> solo detecta la palabra entre comillas o backticks", () => {
  const set = hashes("q:plan_ficticio");
  assert.equal(findForbidden("el id `plan_ficticio`", set).length, 1);
  assert.equal(findForbidden('el id "plan_ficticio"', set).length, 1);
  assert.equal(findForbidden("un plan_ficticio suelto", set).length, 0);
});

test("--scan detecta una key con formato real y acepta un archivo limpio", () => {
  const fake = "ctz_live_" + "A".repeat(38); // se arma en tiempo de ejecución
  const bad = scan(`KEY=${fake}\n`);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /API key real/);
  assert.ok(!bad.stderr.includes(fake.slice(9)), "el reporte no debe repetir la key");
  const ok = scan("La tasa BCV rige desde su fecha valor.\n");
  assert.equal(ok.status, 0, ok.stderr);
});

function realTerms() {
  const file = process.env.FORBIDDEN_TERMS_FILE;
  const raw = file ? readFileSync(file, "utf8") : process.env.FORBIDDEN_TERMS ?? "";
  return raw
    .split("\n")
    .map((t) => normalize(t).trim())
    .filter(Boolean);
}

test("términos reales: cada uno está en la lista y --scan lo detecta", (t) => {
  const terms = realTerms();
  if (terms.length === 0) return t.skip("sin FORBIDDEN_TERMS_FILE ni FORBIDDEN_TERMS");
  for (const term of terms) {
    assert.ok(FORBIDDEN_HASHES.has(sha(term)), `un término de la lista local no está en forbidden.mjs (#${terms.indexOf(term) + 1})`);
    const text = term.startsWith("q:") ? `el plan "${term.slice(2)}" sigue` : `texto con ${term} en medio`;
    const res = scan(text + "\n");
    assert.equal(res.status, 1, `no se detectó el término #${terms.indexOf(term) + 1}`);
  }
});

// Frontmatter: casos que el antiguo parser reinterpretaba silenciosamente.
test('frontmatter acepta CRLF y strings, rechaza duplicados y tipos no string', async () => {
  const { parseFrontmatter } = await import('./frontmatter.mjs');
  const valid = '---\nname: cotizave\ndescription: >-\n  Integra Cotizave.\n  Solo su API.\nmetadata:\n  version: "0.1.0"\n---\n';
  assert.equal(parseFrontmatter(valid.replaceAll('\n', '\r\n')).data.description, 'Integra Cotizave. Solo su API.');
  assert.throws(() => parseFrontmatter(valid.replace('name: cotizave', 'name: cotizave\nname: otro')), /duplicado/);
  assert.throws(() => parseFrontmatter(valid.replace('version: "0.1.0"', 'version: "0.1.0"\n  enabled: true')), /string/);
  assert.throws(() => parseFrontmatter(valid.replace('version: "0.1.0"', 'version: "0.1.0"\n  version: "0.2.0"')), /duplicado/);
  assert.throws(() => parseFrontmatter(valid.replace('name: cotizave', 'name: [cotizave]')), /string/);
  assert.throws(() => parseFrontmatter(valid.replace('name: cotizave', 'name: cotizave\ncustom: yes')), /no soportado/);
});

test('validación de paquete: fixtures, enlaces y esquemas inválidos fallan sin crash', async () => {
  const { mkdirSync, copyFileSync, symlinkSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'cotizave-package-'));
  try {
    for (const folder of ['scripts', 'skills/cotizave/assets/fixtures', '.claude-plugin', '.codex-plugin', 'assets', 'evals']) mkdirSync(join(dir, folder), { recursive: true });
    for (const name of ['validate.mjs', 'frontmatter.mjs', 'forbidden.mjs']) copyFileSync(join(dirname(VALIDATE), name), join(dir, 'scripts', name));
    const skill = '---\nname: cotizave\ndescription: Integra Cotizave.\nmetadata:\n  version: "0.1.0"\n---\n';
    writeFileSync(join(dir, 'skills/cotizave/SKILL.md'), skill);
    writeFileSync(join(dir, 'CHANGELOG.md'), '## [0.1.0]\n');
    const marketplace = { name: 'cotizave', owner: { name: 'Cotizave' }, metadata: { version: '0.1.0' }, plugins: [{ name: 'cotizave', source: './', version: '0.1.0', skills: ['./skills/cotizave'] }] };
    writeFileSync(join(dir, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'cotizave', version: '0.1.0' }));
    writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'cotizave', version: '0.1.0', skills: './skills' }));
    writeFileSync(join(dir, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'cotizave', version: '0.1.0', skills: './skills', interface: { displayName: 'Cotizave', shortDescription: 'Cotizave', longDescription: 'Cotizave integration', developerName: 'Cotizave', category: 'Developer Tools', composerIcon: './assets/cotizave-icon.png', logo: './assets/cotizave-logo.png' } }));
    writeFileSync(join(dir, 'ge' + 'mini-extension.json'), JSON.stringify({ name: 'cotizave', version: '0.1.0' }));
    for (const name of ['cotizave-icon.png', 'cotizave-logo.png']) copyFileSync(join(dirname(VALIDATE), '..', 'assets', name), join(dir, 'assets', name));
    writeFileSync(join(dir, '.claude-plugin/marketplace.json'), JSON.stringify(marketplace));
    const fixturePath = join(dir, 'skills/cotizave/assets/fixtures/test.json');
    const fixture = { status: 200, headers: {}, body: {} };
    writeFileSync(fixturePath, JSON.stringify(fixture));
    const validate = () => spawnSync(process.execPath, [join(dir, 'scripts/validate.mjs')], { encoding: 'utf8' });
    assert.equal(validate().status, 0);
    writeFileSync(fixturePath, JSON.stringify({ ...fixture, raw: '{}' }));
    assert.match(validate().stderr, /body o raw/);
    writeFileSync(fixturePath, JSON.stringify(fixture));
    writeFileSync(join(dir, 'evals/evals.json'), '{"skill_name":"cotizave","evals":{}}');
    assert.match(validate().stderr, /array no vacío/);
    rmSync(join(dir, 'evals/evals.json'));
    writeFileSync(join(dir, 'evals/trigger-evals.json'), 'null');
    assert.equal(validate().status, 1);
    rmSync(join(dir, 'evals/trigger-evals.json'));
    writeFileSync(join(dir, '.claude-plugin/marketplace.json'), 'null');
    assert.match(validate().stderr, /marketplace debe ser un objeto/);
    writeFileSync(join(dir, '.claude-plugin/marketplace.json'), JSON.stringify(marketplace));
    writeFileSync(join(dir, 'skills/cotizave/SKILL.md'), skill + '[fuera](../../CHANGELOG.md)\n');
    assert.match(validate().stderr, /link fuera/);
    writeFileSync(join(dir, 'skills/cotizave/SKILL.md'), skill);
    symlinkSync(dir, join(dir, 'loop'));
    assert.match(validate().stderr, /enlace simbólico/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

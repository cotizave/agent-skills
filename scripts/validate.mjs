#!/usr/bin/env node
// validate.mjs — validación estática del repo, sin dependencias (Node 18+).
//
//   node scripts/validate.mjs         # valida; sale con 1 si hay errores
//   node scripts/validate.mjs --scan <archivo>...  # solo keys y términos, en esos archivos
//
// Revisa: frontmatter de cada SKILL.md, marketplace.json, versión sincronizada
// (SKILL.md ↔ marketplace.json ↔ CHANGELOG.md), links relativos y anclas, evals,
// keys con formato real y términos no publicables (comparados por hash: ver
// forbidden.mjs).
import { readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findForbidden } from "./forbidden.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scanAt = process.argv.indexOf("--scan");
const SCAN = scanAt === -1 ? [] : process.argv.slice(scanAt + 1);
const SKIP_DIRS = new Set([".git", "node_modules", "target", "bin", "obj", "__pycache__", "vendor"]);
const TEXT_EXT = /\.(md|json|ya?ml|ts|mjs|js|py|go|mod|java|php|cs|csproj|sh|txt|xml|toml)$|^(LICENSE|\.gitignore)$/;
// Carpeta del plugin: lo único que instala el directorio de Claude y lo que empaqueta package-release.py.
const PLUGIN = "plugins/cotizave";
// Política del directorio para organizaciones no verificadas: solo documentación, datos e imágenes.
const PLUGIN_ALLOWED = /\.(md|txt|json|ya?ml|png|jpe?g|gif|webp|ico)$|^(LICENSE|README|\.gitignore)$/;
const PLUGIN_IMAGE = /\.(png|jpe?g|gif|webp|ico)$/;
const PLUGIN_PACKAGE_CONFIG = /^(package(-lock)?\.json|pnpm-(workspace|lock)\.yaml|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$/;

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name === ".env" || name.startsWith(".env.")) continue;
    const p = join(dir, name);
    const stat = lstatSync(p);
    if (stat.isSymbolicLink()) { fail(relative(ROOT, p), "enlace simbólico no permitido en el paquete"); continue; }
    if (stat.isDirectory()) walk(p, out);
    else out.push(relative(ROOT, p).split(sep).join("/"));
  }
  return out;
}
const files = walk(ROOT);
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// ── Secretos y términos no publicables (se usa en la sección 5 y en --scan) ──
// La lista de términos vive solo como hashes en forbidden.mjs (ver ahí por qué).
const SECRET = /ctz_live_[0-9A-Za-z]{38}(?![0-9A-Za-z])/;
function scanText(label, text) {
  text.split("\n").forEach((line, i) => {
    if (SECRET.test(line)) fail(`${label}:${i + 1}`, "parece una API key real (ctz_live_ + 38 caracteres)");
  });
  for (const { line } of findForbidden(text)) fail(`${label}:${line}`, "término no publicable (contenido omitido)");
}
if (SCAN.length) {
  // Modo --scan: analiza solo los archivos indicados (pueden estar fuera del repo).
  for (const p of SCAN) scanText(p, readFileSync(p, "utf8"));
  if (errors.length) {
    console.error(`✗ ${errors.length} problema(s):\n  ` + errors.join("\n  "));
    process.exit(1);
  }
  console.log(`✓ sin términos no publicables (${SCAN.length} archivo(s))`);
  process.exit(0);
}

// ── 1. Frontmatter de las skills ────────────────────────────────────────────
// El parser rechaza el YAML fuera del subconjunto documentado en CONTRIBUTING.md.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const SKILL_RE = new RegExp(`^${PLUGIN}/skills/[^/]+/SKILL\\.md$`);
const skillFiles = files.filter((f) => SKILL_RE.test(f));
if (skillFiles.length === 0) fail(`${PLUGIN}/skills/`, "no hay ninguna SKILL.md");
const skillVersions = new Map();
for (const f of skillFiles) {
  const text = read(f);
  let fm;
  try { fm = parseFrontmatter(text); }
  catch (e) { fail(f, e.message); continue; }
  const { name, description, metadata } = fm.data;
  const folder = basename(dirname(f));
  if (!name) fail(f, "falta `name`");
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(f, "`name`: solo a-z, 0-9 y guiones simples, sin guion al inicio/fin");
    if (name.length > 64) fail(f, "`name` supera 64 caracteres");
    if (name !== folder) fail(f, `\`name\` (${name}) debe coincidir con la carpeta (${folder})`);
  }
  if (!description) fail(f, "falta `description`");
  else {
    if (description.length > 1024) fail(f, `\`description\` tiene ${description.length} caracteres (máx. 1024)`);
    if (/[<>]/.test(description)) fail(f, "`description` no puede contener < ni >");
  }
  const version = metadata && metadata.version;
  if (!version || !SEMVER.test(version)) fail(f, "`metadata.version` debe ser SemVer (p. ej. \"0.1.0\")");
  skillVersions.set(`./skills/${folder}`, version);
  const bodyLines = text.split("\n").length - fm.bodyStartLine;
  if (bodyLines > 500) fail(f, `el cuerpo tiene ${bodyLines} líneas (recomendado ≤ 500: mueve detalle a references/)`);
}

// ── 2. marketplace.json y versiones ─────────────────────────────────────────
const MARKET = ".claude-plugin/marketplace.json";
let releaseVersion;
if (!existsSync(join(ROOT, MARKET))) fail(MARKET, "no existe");
else {
  let mk;
  try {
    mk = JSON.parse(read(MARKET));
  } catch (e) {
    fail(MARKET, `JSON inválido: ${e.message}`);
  }
  if (!mk || typeof mk !== "object" || Array.isArray(mk)) fail(MARKET, "marketplace debe ser un objeto");
  else {
    if (!mk.name || !/^[A-Za-z0-9._-]+$/.test(mk.name)) fail(MARKET, "`name` inválido");
    if (!mk.owner || !mk.owner.name) fail(MARKET, "falta `owner.name`");
    if (!Array.isArray(mk.plugins) || mk.plugins.length === 0) fail(MARKET, "`plugins` debe ser un array no vacío");
    releaseVersion = mk.metadata && mk.metadata.version;
    if (!releaseVersion || !SEMVER.test(releaseVersion)) fail(MARKET, "`metadata.version` debe ser SemVer");
    for (const p of Array.isArray(mk.plugins) ? mk.plugins : []) {
      if (!p || typeof p !== "object") { fail(MARKET, "plugin inválido"); continue; }
      if (typeof p.name !== "string" || !p.name || typeof p.source !== "string" || !p.source) { fail(MARKET, "cada plugin necesita name y source strings"); continue; }
      if (p.version !== releaseVersion) fail(MARKET, `plugin ${p.name}: version ${p.version} ≠ metadata.version ${releaseVersion}`);
      // Directory policy: components live in the plugin's own plugin.json (or its default
      // folders), never in the marketplace entry ("Move skills into the entry's plugin.json").
      for (const k of ["skills", "commands", "agents", "hooks", "outputStyles", "themes"]) {
        if (k in p) fail(MARKET, `plugin ${p.name}: declara \`${k}\` en la entrada del marketplace; el directorio exige que viva en ${p.source}/.claude-plugin/plugin.json o en su carpeta por defecto`);
      }
      if (!existsSync(join(ROOT, p.source, ".claude-plugin/plugin.json"))) fail(MARKET, `plugin ${p.name}: falta ${p.source}/.claude-plugin/plugin.json`);
      // The plugin's default skills/ scan must find at least one skill at the release version.
      const skillsDir = join(ROOT, p.source, "skills");
      const found = existsSync(skillsDir) ? readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md"))) : [];
      if (found.length === 0) fail(MARKET, `plugin ${p.name}: ${p.source}/skills/ no contiene ninguna SKILL.md`);
      for (const d of found) {
        const v = skillVersions.get(`./skills/${d}`);
        if (v && v !== releaseVersion) fail(MARKET, `${p.source}/skills/${d}: metadata.version ${v} ≠ ${releaseVersion}`);
      }
    }
  }
}
if (releaseVersion) {
  if (!existsSync(join(ROOT, "CHANGELOG.md"))) fail("CHANGELOG.md", "no existe");
  else if (!new RegExp(`^## \\[${releaseVersion.replace(/\./g, "\\.")}\\]`, "m").test(read("CHANGELOG.md")))
    fail("CHANGELOG.md", `falta la entrada "## [${releaseVersion}]"`);
}

// Cross-platform manifests and release assets.
const CLAUDE_MANIFEST = `${PLUGIN}/.claude-plugin/plugin.json`;
const CODEX_MANIFEST = `${PLUGIN}/.codex-plugin/plugin.json`;
for (const f of [CLAUDE_MANIFEST, CODEX_MANIFEST, "plugin.json", "ge" + "mini-extension.json"]) {
  if (!existsSync(join(ROOT, f))) { fail(f, "missing manifest"); continue; }
  const m = parseManifest(f);
  if (!m) continue;
  if (m.version !== releaseVersion) fail(f, `version ${m.version} ≠ ${releaseVersion}`);
  if (m.name !== "cotizave") fail(f, "name must be cotizave");
  if (f === "plugin.json" && m.skills !== `./${PLUGIN}/skills`) fail(f, `skills must point to ./${PLUGIN}/skills`);
  if (f === CLAUDE_MANIFEST && m.skills !== "./skills") fail(f, "skills must point to ./skills");
  if (f === CODEX_MANIFEST && m.skills !== "./skills" && m.skills !== "./skills/") fail(f, "skills must point to ./skills");
  if (f === CODEX_MANIFEST) {
    const ui = m.interface;
    if (!ui || !ui.composerIcon || !ui.logo) fail(f, "missing composerIcon or logo");
    for (const field of ["composerIcon", "logo"]) {
      const value = ui?.[field];
      if (typeof value !== "string" || !/^\.\/assets\/[A-Za-z0-9_-]+\.(png|svg)$/.test(value) || !existsSync(join(ROOT, PLUGIN, value)))
        fail(f, `${field} must point to an included image`);
    }
    for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "category"]) {
      if (typeof ui?.[field] !== "string" || !ui[field]) fail(f, `missing interface.${field}`);
    }
    if (ui?.displayName?.length > 30 || ui?.shortDescription?.length > 30) fail(f, "listing title exceeds 30 characters");
  }
}
function parseManifest(f) {
  try { return JSON.parse(read(f)); } catch (e) { fail(f, `invalid JSON: ${e.message}`); return null; }
}
for (const image of [`${PLUGIN}/assets/cotizave-icon.png`, `${PLUGIN}/assets/cotizave-logo.png`]) {
  if (!existsSync(join(ROOT, image))) fail(image, "missing image");
  else {
    const b = readFileSync(join(ROOT, image));
    if (b.length > 5 * 1024 * 1024 || b.toString("hex", 0, 8) !== "89504e470d0a1a0a" || b.readUInt32BE(16) !== b.readUInt32BE(20) || b.readUInt32BE(16) < 48)
      fail(image, "must be a square PNG of at least 48 px and at most 5 MiB");
  }
}

// Requisitos del directorio de Claude sobre la carpeta del plugin (ver docs/plugins/pre-submission-checklist).
for (const f of files.filter((f) => f.startsWith(`${PLUGIN}/`))) {
  if (!PLUGIN_ALLOWED.test(basename(f))) fail(f, "tipo de archivo no permitido en la carpeta del plugin (política del directorio)");
  if (PLUGIN_PACKAGE_CONFIG.test(basename(f))) fail(f, "configuración de gestor de paquetes no permitida en la carpeta del plugin");
  const bytes = readFileSync(join(ROOT, f));
  if (bytes.subarray(0, 2).toString() === "#!") fail(f, "un archivo del plugin no puede empezar por #!");
  if (!PLUGIN_IMAGE.test(basename(f))) {
    if (bytes.includes(0)) fail(f, "archivo de texto con bytes NUL");
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { fail(f, "archivo de texto no codificado en UTF-8 válido"); }
  }
}
const PLUGIN_README = `${PLUGIN}/README.md`;
if (!existsSync(join(ROOT, PLUGIN_README))) fail(PLUGIN_README, "el directorio exige un README en la carpeta del plugin");
else if (read(PLUGIN_README).replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length < 40)
  fail(PLUGIN_README, "el README del plugin necesita al menos 40 palabras fuera de bloques de código");
if (!existsSync(join(ROOT, `${PLUGIN}/LICENSE`))) fail(`${PLUGIN}/LICENSE`, "el directorio exige LICENSE en la carpeta del plugin");
const SKILLS_SH = "skills.sh.json";
if (!existsSync(join(ROOT, SKILLS_SH))) fail(SKILLS_SH, "falta (rutas de skills para el skills CLI)");
else {
  const sh = parseManifest(SKILLS_SH);
  if (!Array.isArray(sh?.paths) || sh.paths.length === 0) fail(SKILLS_SH, "`paths` debe ser un array no vacío");
  for (const p of sh?.paths ?? []) if (typeof p !== "string" || !p.startsWith("./") || !existsSync(join(ROOT, p))) fail(SKILLS_SH, `ruta inválida o inexistente: ${p}`);
}

// ── 3. Links relativos y anclas ─────────────────────────────────────────────
function slugs(markdown) {
  const seen = new Map();
  const out = new Set();
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^```/.test(line)) inFence = !inFence;
    const h = !inFence && line.match(/^#{1,6}\s+(.*)$/);
    if (!h) continue;
    let slug = h[1].trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    out.add(n ? `${slug}-${n}` : slug);
  }
  return out;
}
const mdFiles = files.filter((f) => f.endsWith(".md"));
for (const f of mdFiles) {
  const text = read(f).replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [path, anchor] = target.split("#");
    const abs = path ? resolve(ROOT, dirname(f), path) : join(ROOT, f);
    const skillRoot = f.startsWith(`${PLUGIN}/skills/`) ? resolve(ROOT, f.split("/").slice(0, 4).join("/")) : null;
    if (relative(ROOT, abs).startsWith("..") || (skillRoot && !abs.startsWith(skillRoot + sep))) {
      fail(f, "link fuera del paquete o repositorio"); continue;
    }
    if (!existsSync(abs)) {
      fail(f, `link roto: ${target}`);
      continue;
    }
    if (anchor && abs.endsWith(".md") && !slugs(readFileSync(abs, "utf8")).has(anchor))
      fail(f, `ancla inexistente: ${target}`);
  }
}

// ── 4. Evals: JSON válido y con la forma esperada ─────────────────────────
const parseJson = (f) => {
  try {
    return JSON.parse(read(f));
  } catch (e) {
    fail(f, `JSON inválido: ${e.message}`);
  }
};
if (existsSync(join(ROOT, "evals/evals.json"))) {
  const ev = parseJson("evals/evals.json");
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) fail("evals/evals.json", "debe ser un objeto");
  else {
    if (!skillFiles.some((f) => f === `${PLUGIN}/skills/${ev.skill_name}/SKILL.md`)) fail("evals/evals.json", `skill_name desconocido: ${ev.skill_name}`);
    const ids = new Set();
    if (!Array.isArray(ev.evals) || ev.evals.length === 0) fail("evals/evals.json", "evals debe ser un array no vacío");
    for (const e of Array.isArray(ev.evals) ? ev.evals : []) {
      if (!e || typeof e !== "object") { fail("evals/evals.json", "escenario inválido"); continue; }
      if (typeof e.id !== "string" || !e.id || typeof e.prompt !== "string" || !e.prompt || !Array.isArray(e.expectations) || e.expectations.length === 0 || !e.expectations.every(x => typeof x === "string" && x.trim()))
        fail("evals/evals.json", `eval ${e.id ?? "?"}: necesita id, prompt y expectations`);
      if (ids.has(e.id)) fail("evals/evals.json", `id duplicado: ${e.id}`);
      ids.add(e.id);
    }
  }
}
if (existsSync(join(ROOT, "evals/trigger-evals.json"))) {
  const tr = parseJson("evals/trigger-evals.json");
  if (!(Array.isArray(tr) && tr.length > 0 && tr.every((t) => t && typeof t.query === "string" && t.query.trim() && typeof t.should_trigger === "boolean")))
    fail("evals/trigger-evals.json", "debe ser [{ query, should_trigger }]");
}

// Fixtures empaquetadas: envoltorio HTTP válido, sin afirmar correspondencia con producción.
const fixtureFiles = files.filter(f => new RegExp(`^${PLUGIN}/skills/[^/]+/assets/fixtures/.*\\.json$`).test(f));
if (!fixtureFiles.length) fail("fixtures", "faltan fixtures instalables");
for (const f of fixtureFiles) {
  const value = parseJson(f);
  if (!value || typeof value !== "object" || Array.isArray(value)) { fail(f, "fixture debe ser un objeto"); continue; }
  if (!Number.isInteger(value.status) || value.status < 100 || value.status > 599) fail(f, "status HTTP inválido");
  if (!value.headers || typeof value.headers !== "object" || Array.isArray(value.headers) ||
      !Object.entries(value.headers).every(([k,v]) => /^[A-Za-z0-9-]+$/.test(k) && typeof v === "string" && !/[\r\n]/.test(v))) fail(f, "headers inválidos");
  if (Object.hasOwn(value, "body") === Object.hasOwn(value, "raw") ||
      (Object.hasOwn(value, "raw") && typeof value.raw !== "string")) fail(f, "fixture necesita body o raw, exclusivamente");
}

// ── 5. Secretos y términos no publicables ───────────────────────────────────
for (const f of files) {
  if (!TEXT_EXT.test(basename(f)) || f.endsWith("package-lock.json")) continue;
  scanText(f, read(f));
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log(`✓ validación OK (${skillFiles.length} skill(s), ${mdFiles.length} markdown, versión ${releaseVersion})`);

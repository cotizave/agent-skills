// Copia aislada del paquete; --codex añade descubrimiento real sin inferencia.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseFrontmatter } from './frontmatter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'cotizave-install-'));
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), 'El paquete no debe depender de symlinks');
    const path = join(prefix, entry.name);
    return entry.isDirectory() ? files(join(dir, entry.name), path) : [path];
  }).sort();
}

async function discover(cwd, expectedPath) {
  const child = spawn('codex', ['app-server', '--stdio'], { cwd, stdio: ['pipe', 'pipe', 'ignore'] });
  const pending = new Map();
  const lines = createInterface({ input: child.stdout });
  const rejectAll = error => { for (const { reject } of pending.values()) reject(error); pending.clear(); };
  child.on('error', rejectAll);
  child.on('exit', () => rejectAll(new Error('Codex terminó antes de responder')));
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error('Codex rechazó la consulta de descubrimiento'));
    else request.resolve(message.result);
  });
  const timer = setTimeout(() => {
    rejectAll(new Error('Timeout de descubrimiento (20 s)'));
    child.kill();
  }, 20_000);
  let id = 0;
  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      child.stdin.write(JSON.stringify({ id: key, method, params }) + '\n');
    });
  }
  try {
    await rpc('initialize', { clientInfo: { name: 'cotizave-install-check', version: '1.0.0' } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const result = await rpc('skills/list', { cwds: [cwd], forceReload: true });
    const entries = result.data.flatMap(entry => entry.skills);
    const skill = entries.find(entry => entry.name === 'cotizave' && realpathSync(entry.path) === realpathSync(expectedPath));
    assert(skill, 'Codex no descubrió la copia instalada');
    assert.equal(skill.enabled, true, 'La skill instalada debe estar habilitada');
    console.log('OK Codex skills/list: cotizave descubierta y habilitada (sin turno de modelo)');
  } finally {
    clearTimeout(timer);
    lines.close();
    child.stdin.end();
    child.kill();
  }
}

try {
  const source = join(root, 'skills/cotizave');
  const paths = files(source);
  for (const target of ['.agents/skills', '.claude/skills']) {
    const installed = join(temp, target, 'cotizave');
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(source, installed, { recursive: true });
    assert.deepEqual(files(installed), paths);
    for (const file of paths) assert.deepEqual(readFileSync(join(installed, file)), readFileSync(join(source, file)));
    assert.equal(parseFrontmatter(readFileSync(join(installed, 'SKILL.md'), 'utf8')).data.name, 'cotizave');
    for (const file of paths.filter(path => path.endsWith('.md'))) {
      const body = readFileSync(join(installed, file), 'utf8').replace(/```[\s\S]*?```/g, '');
      for (const [, target] of body.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const dest = resolve(installed, dirname(file), target.split('#')[0]);
        assert(!relative(installed, dest).startsWith('..'), 'Referencia fuera del paquete');
        assert(existsSync(dest), `Recurso ausente: ${file} -> ${target}`);
      }
    }
    console.log(`OK copia ${target}: ${paths.length} archivos idénticos y referencias autocontenidas`);
  }
  if (process.argv.includes('--codex')) await discover(temp, join(temp, '.agents/skills/cotizave/SKILL.md'));
} finally {
  rmSync(temp, { recursive: true, force: true });
}

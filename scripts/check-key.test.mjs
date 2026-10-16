import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../skills/cotizave/scripts/check-key.sh', import.meta.url));
const fixtures = new URL('../skills/cotizave/assets/fixtures/', import.meta.url);
const key = 'ctz_live_test';
function run(origin, overrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', [script], {
      env: { PATH: '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin',
        COTIZAVE_API_KEY: key, COTIZAVE_BASE_URL: origin, ...overrides },
      timeout: 20000,
    });
    let output = '';
    child.stdout.on('data', b => output += b);
    child.stderr.on('data', b => output += b);
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, output }));
  });
}
async function server(t, handler) {
  const http = createServer(handler);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { http.close(resolve); http.closeAllConnections(); }));
  return `http://127.0.0.1:${http.address().port}`;
}
function fixture(name) { return JSON.parse(readFileSync(new URL(name, fixtures), 'utf8')); }
function reply(res, value) { res.writeHead(value.status, value.headers); res.end(value.raw ?? JSON.stringify(value.body)); }

test('check-key valida contrato, trim y un solo request sin heredar curlrc', async t => {
  let calls = 0;
  const origin = await server(t, (req,res) => {
    calls++;
    assert.equal(req.headers['x-api-key'], key);
    assert.equal(req.url, '/v1/fx/rates/reference');
    reply(res, fixture('rate-reference.200.json'));
  });
  const dir = mkdtempSync(join(tmpdir(), 'cotizave-curlrc-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const trace = join(dir, 'trace');
  writeFileSync(join(dir, '.curlrc'), `location\ninsecure\ntrace = "${trace}"\nurl = "${origin}/extra"\n`);
  const result = await run(origin, { COTIZAVE_API_KEY: ` \t${key}\r\n`, CURL_HOME: dir });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /key verificada/);
  assert.equal(calls, 1);
  assert.equal(existsSync(trace), false);
  assert.equal(result.output.includes(key), false);
});

test('check-key rechaza redirects y no revela Location ni key reflejada', async t => {
  let sinkCalls = 0;
  const sink = await server(t, (req,res) => { sinkCalls++; res.end(); });
  const origin = await server(t, (req,res) => {
    res.writeHead(302, { Location: `${sink}/${key}`, 'X-RateLimit-Limit': key });
    res.end(JSON.stringify({ message: key }));
  });
  const result = await run(origin);
  assert.equal(result.code, 1);
  assert.equal(sinkCalls, 0);
  assert.equal(result.output.includes(key), false);
});

test('check-key no confunde HTTP 200 con key verificada', async t => {
  for (const body of ['<html>proxy</html>', '{}', '{"mid":1}', 'null',
    JSON.stringify(fixture('rate-reference.200.json').body) + '\n{}']) {
    await t.test(body.slice(0, 30), async t => {
      const origin = await server(t, (req,res) => res.end(body));
      const result = await run(origin);
      assert.equal(result.code, 1, result.output);
      assert.doesNotMatch(result.output, /OK:/);
    });
  }
});

test('check-key clasifica monthly del body sin imprimir contenido remoto', async t => {
  const origin = await server(t, (req,res) => {
    res.writeHead(429); res.end(JSON.stringify({ details: { kind: 'monthly' }, message: key, code: key }));
  });
  const result = await run(origin);
  assert.equal(result.code, 1);
  assert.match(result.output, /cuota mensual/);
  assert.equal(result.output.includes(key), false);
});

test('check-key acota respuesta chunked sin Content-Length', async t => {
  const origin = await server(t, (req,res) => {
    res.writeHead(200, { 'Transfer-Encoding': 'chunked' });
    res.end('x'.repeat(1048577));
  });
  const result = await run(origin);
  assert.equal(result.code, 3, result.output);
});

test('check-key rechaza destino/credenciales antes de enviar', async t => {
  let calls = 0;
  const origin = await server(t, (req,res) => { calls++; res.end(); });
  for (const [url, value] of [
    [origin, ''], [origin, 'ctz_live_test\nInjected'],
    [origin, 'ctz_live_' + 'A'.repeat(38)],
    [`${origin}/path`, key], [`${origin}?q=x`, key],
    ['https://example.invalid', key], ['https://api.cotizave.com', key],
    ['https://api.cotizave.com@evil.invalid', key],
  ]) {
    const result = await run(url, { COTIZAVE_API_KEY: value });
    assert.equal(result.code, 2, result.output);
    assert.equal(result.output.includes(key), false);
  }
  assert.equal(calls, 0);
});

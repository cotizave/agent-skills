import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from './client.mjs';
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
function setup(sequence, options = {}) {
  let now = Date.parse('2026-10-15T03:32:00Z');
  let calls = 0; const waits = [], timers = new Set();
  const clock = { now: () => now, schedule(ms, fn) { const timer = { at:now+ms, fn }; timers.add(timer); return () => timers.delete(timer); },
    async sleep(ms, signal) { if(signal.aborted) throw new DOMException('Canceled','AbortError'); waits.push(ms); now+=ms; } };
  const cache = new Map();
  const client = createClient({ account:'test-account', clock, cache, ttlMs:1000,
    displayTolerance: { reference:10000, parallel:10000 }, attestBCV: ({validatedAt, now}) => now-validatedAt <= 1000,
    transport: async request => { calls++; assert.equal(request.path, '/v1/fx/rates'); const item = sequence.shift(); if(typeof item === 'function') return item(request); if(!item) throw new Error('Unexpected call'); return fixture(item); }, ...options });
  return { client, cache, waits, calls:()=>calls, advance(ms) { now+=ms; for(const t of [...timers]) if(t.at<=now) { timers.delete(t); t.fn(); } }, now:()=>now };
}
const good = 'rates.200', down = 'error-503-service-unavailable';
test('fallback same market, metadata, bounded retries and recovery', async () => {
  const h=setup([good,down,down,down,good]);
  const initial=await h.client.getRate('reference'); h.advance(1001);
  const fallback=await h.client.getRate('reference');
  assert.equal(fallback.mid,initial.mid); assert.equal(fallback.state,'fallback');
  assert.equal(fallback.effective_date,'2026-10-14'); assert.equal(fallback.source,'Cotizave');
  assert.deepEqual(h.waits,[1000,1000]); assert.equal(h.calls(),4);
  const recovered=await h.client.getRate('reference'); assert.equal(recovered.state,'current'); assert.equal(h.calls(),5);
});
test('display limit inclusive and expired value unavailable',async()=>{
  const h=setup([good,'malformed.200','malformed.200']); await h.client.getRate('reference'); h.advance(10000);
  assert.equal((await h.client.getRate('reference')).state,'fallback'); h.advance(1);
  await assert.rejects(h.client.getRate('reference'),{code:'unavailable'});
});
test('empty cache cannot invent a rate',async()=>{
  const h=setup([down,down,down]); await assert.rejects(h.client.getRate('reference'),{code:'unavailable'});
});
test('invalid response preserves last good snapshot then recovers',async()=>{
  const h=setup([good,'malformed.200',good]); const first=await h.client.getRate('parallel'); h.advance(1001);
  const second=await h.client.getRate('parallel'); assert.equal(second.mid,first.mid); assert.equal(second.error,'protocol');
  assert.equal((await h.client.getRate('parallel')).state,'current');
});
test('monthly blocks all markets until exact reset and resumes',async()=>{
  const h=setup([good,'error-429-monthly',good]); await h.client.getRate('reference'); h.advance(1001);
  assert.equal((await h.client.getRate('reference')).state,'fallback');
  await h.client.getRate('parallel'); assert.equal(h.calls(),2);
  await assert.rejects(h.client.getRate('reference',{use:'invoice'}),{code:'unproven_bcv_validity'});
  h.advance(Date.parse('2026-11-03T00:00:00Z')-h.now());
  await h.client.getRate('reference'); assert.equal(h.calls(),3);
});
test('parallel alone cannot replace missing BCV for display or invoice',async()=>{
  const body=fixture(good); body.body.rates=body.body.rates.filter(r=>r.market==='parallel');
  const h=setup([()=>body]); assert.equal((await h.client.getRate('parallel')).market,'parallel');
  await assert.rejects(h.client.getRate('reference'),{code:'unavailable'});
  await assert.rejects(h.client.getRate('reference',{use:'invoice'}),{code:'unavailable'});
});
test('unproven BCV cannot fix invoice; required provenance retained when attested',async()=>{
  const h=setup([good,down,down,down]); const quote=await h.client.getRate('reference',{use:'invoice'});
  assert.equal(quote.effective_date,'2026-10-14'); assert.equal(quote.market,'reference');
  h.advance(1001); await assert.rejects(h.client.getRate('reference',{use:'invoice'}),{code:'unproven_bcv_validity'});
  assert.equal(quote.mid,877.9023);
});
test('abort before call and during transport never returns cached success; recovery',async()=>{
  let resolve; const h=setup([good,()=>new Promise(r=>resolve=r),good]); await h.client.getRate('reference');
  const canceled=new AbortController(); canceled.abort(); await assert.rejects(h.client.getRate('reference',{signal:canceled.signal}),{name:'AbortError'}); assert.equal(h.calls(),1);
  h.advance(1001); const controller=new AbortController(); const pending=h.client.getRate('reference',{signal:controller.signal});
  await Promise.resolve(); await Promise.resolve(); controller.abort(); await assert.rejects(pending,{name:'AbortError'});
  resolve(fixture(good)); await Promise.resolve(); assert.equal((await h.client.getRate('reference')).state,'current');
});
test('concurrent consumers share refresh and cancellation is individual',async()=>{
  let resolve; const h=setup([()=>new Promise(r=>resolve=r)]); const controller=new AbortController();
  const a=h.client.getRate('reference',{signal:controller.signal}), b=h.client.getRate('parallel');
  await Promise.resolve(); await Promise.resolve(); controller.abort(); await assert.rejects(a,{name:'AbortError'});
  resolve(fixture(good)); assert.equal((await b).market,'parallel'); assert.equal(h.calls(),1);
});
test('credential errors surface rather than hiding behind fallback',async()=>{
  const h=setup([good,'error-401-invalid-api-key']); await h.client.getRate('reference'); h.advance(1001);
  await assert.rejects(h.client.getRate('reference'),{status:401,code:'invalid_api_key'}); assert.equal(h.calls(),2);
});
test('burst waits, no-scope blocks, excessive wait is never shortened',async()=>{
  const h=setup(['error-429-burst',good]); await h.client.getRate('reference'); assert.deepEqual(h.waits,[40]);
  const k=setup(['error-429-no-scope']); await assert.rejects(k.client.getRate('reference')); await assert.rejects(k.client.getRate('parallel')); assert.equal(k.calls(),1);
  const m=setup(['error-503-retry-after-long']); await assert.rejects(m.client.getRate('reference')); assert.equal(m.calls(),1); assert.deepEqual(m.waits,[]);
});
test('cancel during backoff sends no retry',async()=>{
  const controller=new AbortController(); let calls=0, started;
  const inSleep=new Promise(r=>started=r);
  const clock={now:()=>Date.parse('2026-10-15T03:32:00Z'),schedule:()=>()=>{},sleep:async(ms,signal)=>{started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')),{once:true}));}};
  const client=createClient({account:'test',clock,transport:async()=>{calls++;return fixture(down);}});
  const pending=client.getRate('reference',{signal:controller.signal}); await inSleep; controller.abort();
  await assert.rejects(pending,{name:'AbortError'}); assert.equal(calls,1);
});
test('hanging transport is bounded by attempt deadline',async()=>{
  let upstreamSignal; const h=setup([({signal})=>{upstreamSignal=signal;return new Promise(()=>{});} ],{maxAttempts:1});
  const pending=h.client.getRate('reference'); await Promise.resolve(); await Promise.resolve(); h.advance(3000);
  await assert.rejects(pending, e=>e.code==='unavailable' && e.cause.code==='timeout'); assert.equal(upstreamSignal.aborted,true);
});
test('monthly with absent reset suspends calls for operator review',async()=>{
  const response=fixture('error-429-monthly'); delete response.headers['X-RateLimit-Reset']; delete response.body.details.resets_at;
  const h=setup([()=>response]); await assert.rejects(h.client.getRate('reference')); h.advance(100000000000);
  await assert.rejects(h.client.getRate('reference')); assert.equal(h.calls(),1);
});

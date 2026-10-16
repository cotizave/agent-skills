// Evaluation-only consumer policy module. Transport owns credentials/TLS/body limits.
export class ClientError extends Error {
  constructor(code, info = {}) { super(code); this.name = 'ClientError'; this.code = code; Object.assign(this, info); }
}
const abortError = () => new DOMException('Operation canceled', 'AbortError');
const check = signal => { if (signal?.aborted) throw abortError(); };
const defaults = { reference: 132*3600, eur_reference: 132*3600, parallel: 26*3600, p2p: 1800, remittance: 21600, cash: 10800, exchange_house: 93600 };
export function createClient({ transport, cache = new Map(), clock, account, ttlMs = 1800000,
  displayTolerance = {}, attestBCV = () => false, observe = () => {}, maxAttempts = 3,
  attemptMs = 3000, totalMs = 10000, maxWaitMs = 2000, jitter = () => 0 }) {
  if (!account || !clock || typeof transport !== 'function') throw new ClientError('configuration');
  const key = `${account}:https://api.cotizave.com:/v1/fx/rates`;
  const quotaKey = `${account}:https://api.cotizave.com:quota`;
  let flight;
  function bounded(work, ms, signal) {
    check(signal);
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const finish = (fn, value) => { clear(); signal?.removeEventListener('abort', canceled); fn(value); };
      const canceled = () => { controller.abort(); finish(reject, abortError()); };
      const clear = clock.schedule(ms, () => { controller.abort(); finish(reject, new ClientError('timeout')); });
      signal?.addEventListener('abort', canceled, { once: true });
      Promise.resolve().then(() => { check(controller.signal); return work(controller.signal); }).then(v => finish(resolve, v), e => finish(reject, e));
    });
  }
  function validate(body) {
    if (!body || body.currency !== 'VES' || !Array.isArray(body.rates) || !Number.isFinite(Date.parse(body.fetched_at))) throw new ClientError('protocol');
    const rates = new Map();
    for (const r of body.rates) {
      if (!r || typeof r.market !== 'string' || rates.has(r.market) || !Number.isFinite(r.mid) || r.mid <= 0 || !Number.isFinite(Date.parse(r.updated_at))) throw new ClientError('protocol');
      if (r.stale_after_sec !== undefined && (!Number.isFinite(r.stale_after_sec) || r.stale_after_sec < 0)) throw new ClientError('protocol');
      if (['reference','eur_reference'].includes(r.market) && (!/^\d{4}-\d{2}-\d{2}$/.test(r.effective_date ?? '') || !Number.isFinite(Date.parse(r.effective_date)))) throw new ClientError('protocol');
      rates.set(r.market, Object.freeze({ ...r, base: r.base ?? (r.market === 'eur_reference' ? 'EUR' : 'USD') }));
    }
    return { rates, fetchedAt: body.fetched_at, validatedAt: clock.now() };
  }
  async function refresh(signal) {
    const deadline = clock.now() + totalMs;
    for (let n = 0; n < maxAttempts; n++) {
      check(signal);
      const blocked = cache.get(quotaKey);
      if (blocked && clock.now() < blocked.until) throw new ClientError(blocked.code, { reset: blocked.reset });
      let err, wait;
      try {
        const response = await bounded(s => transport({ method: 'GET', path: '/v1/fx/rates', signal: s, redirect: 'error' }), Math.min(attemptMs, deadline-clock.now()), signal);
        check(signal);
        const headers = Object.fromEntries(Object.entries(response.headers ?? {}).map(([k,v]) => [k.toLowerCase(), v]));
        let body;
        try { body = response.raw !== undefined ? JSON.parse(response.raw) : response.body; } catch {}
        if (response.status >= 200 && response.status < 300) {
          const data = validate(body);
          cache.set(key, data);
          if (headers['x-ratelimit-remaining'] === '0') {
            const reset = headers['x-ratelimit-reset'];
            cache.set(quotaKey, { code:'monthly', reset, until: Date.parse(reset) > clock.now() ? Date.parse(reset) : Infinity });
          }
          return data;
        }
        const scope = headers['x-ratelimit-scope'] ?? body?.details?.kind;
        err = new ClientError(typeof body?.code === 'string' && /^[a-z_]+$/.test(body.code) ? body.code : 'http_error', { status: response.status, scope, reset: headers['x-ratelimit-reset'] });
        const retry = headers['retry-after'];
        const retryMs = /^\d+$/.test(retry ?? '') ? Number(retry)*1000 : undefined;
        if (response.status === 429 && scope !== 'burst') {
          const reset = headers['x-ratelimit-reset'] ?? body?.details?.resets_at;
          const until = scope === 'monthly' ? (Date.parse(reset) > clock.now() ? Date.parse(reset) : Infinity) : clock.now() + (retryMs ?? 60000);
          cache.set(quotaKey, { code: scope === 'monthly' ? 'monthly' : 'rate_limited', until, reset });
          observe({ code: err.code, status: err.status, scope, reset });
          throw err;
        }
        if (response.status === 429 && scope === 'burst') {
          const exact = headers['x-ratelimit-retry-after-ms'];
          wait = /^\d+$/.test(exact ?? '') ? Number(exact) : retryMs;
        } else if (response.status >= 500 && body?.code !== 'query_timeout') wait = retryMs;
        else throw err;
      } catch (e) {
        check(signal);
        if (e.name === 'AbortError') throw e;
        if (e === err || (e.code !== 'timeout' && e.transient !== true)) throw e;
        err = e;
      }
      wait = (wait ?? 500 * 2**n) + Math.max(0,jitter());
      if (n + 1 === maxAttempts || wait > maxWaitMs || wait >= deadline-clock.now()) throw err;
      await bounded(s => clock.sleep(wait, s), deadline-clock.now(), signal);
    }
    throw new ClientError('configuration');
  }
  function sharedRefresh(signal) {
    check(signal);
    if (!flight) {
      const controller = new AbortController();
      const f = { controller, users: 0 };
      f.promise = refresh(controller.signal).finally(() => { if (flight === f) flight = undefined; });
      flight = f;
    }
    const f = flight;
    f.users++;
    return bounded(() => f.promise, totalMs, signal).finally(() => {
      if (--f.users === 0) { f.controller.abort(); if (flight === f) flight = undefined; }
    });
  }
  return {
    async getRate(market, { use = 'display', base = 'USD', signal } = {}) {
      check(signal);
      if (!['display','invoice'].includes(use) || (use === 'invoice' && market !== 'reference')) throw new ClientError('invalid_use');
      let data = cache.get(key), failure;
      if (!data || clock.now()-data.validatedAt >= ttlMs) {
        try { data = await sharedRefresh(signal); }
        catch (e) { check(signal); if (e.name === 'AbortError') throw e; failure = e; data = cache.get(key); }
      }
      check(signal);
      if (failure?.status && [400,401,402,403].includes(failure.status)) throw failure;
      const rate = data?.rates.get(market);
      if (!rate || rate.base !== base) throw new ClientError('unavailable', { cause: failure });
      const cacheAge = clock.now()-data.validatedAt;
      const isBCV = ['reference','eur_reference'].includes(market);
      const current = isBCV ? attestBCV({ rate, now: clock.now(), validatedAt: data.validatedAt }) === true :
        rate.stale !== true && clock.now()-Date.parse(rate.updated_at) <= (rate.stale_after_sec ?? defaults[market] ?? defaults[rate.type] ?? 0)*1000;
      const degraded = !!failure || !current;
      if (use === 'invoice' && !current) throw new ClientError('unproven_bcv_validity', { cause: failure });
      if (use === 'display' && degraded && !(Number.isFinite(displayTolerance[market]) && cacheAge <= displayTolerance[market])) throw new ClientError('unavailable', { cause: failure });
      return { ...rate, quote: 'VES', source: 'Cotizave', fetched_at: data.fetchedAt, validated_at: data.validatedAt, state: degraded ? 'fallback' : 'current', error: failure?.code };
    }
  };
}

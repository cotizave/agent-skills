# TypeScript (Node 18+, Deno, Bun, edge runtimes)

Cliente pequeño, sin dependencias, basado en `fetch`. Incluye:

- key leída de `COTIZAVE_API_KEY` (solo servidor),
- cache en memoria con TTL + single-flight (cámbialo por un cache compartido si
  tienes varias instancias),
- manejo de 429 `burst` (reintento con espera) vs `monthly` (sin reintento),
- errores tipados por `code`,
- fallback al último valor bueno ante 5xx / red.

```ts
// cotizave.ts — uso exclusivo del lado servidor
export type MarketType =
  | "reference" | "parallel" | "p2p" | "remittance" | "cash" | "exchange_house" | (string & {});

export interface FXRate {
  market: string;
  type: MarketType;
  base?: "USD" | "EUR";
  ask?: number;
  bid?: number;
  mid: number;
  updated_at: string;
  effective_date?: string; // solo reference / eur_reference (fecha valor YYYY-MM-DD)
  stale_after_sec?: number;
}

export interface RatesResponse {
  country: "VE";
  currency: "VES";
  base: string;
  rates: FXRate[];
  index?: { value: number; version: string; as_of: string; flags: Record<string, unknown> };
  fetched_at: string;
}

export interface ConvertResponse {
  from: { currency: string; amount: number };
  to: { currency: string; amount: number };
  rate: number;
  market: string;
  type: MarketType;
  updated_at: string;
  effective_date?: string;
  staleness_sec: number;
  stale: boolean;
}

export class CotizaveError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
    readonly details?: Record<string, unknown>,
    readonly headers?: Headers,
  ) {
    super(message);
    this.name = "CotizaveError";
  }
  /** 429 por cuota mensual: no reintentar hasta X-RateLimit-Reset. */
  get isMonthlyQuota(): boolean {
    return this.status === 429 && this.headers?.get("X-RateLimit-Scope") === "monthly";
  }
}

const BASE_URL = "https://api.cotizave.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Cotizave {
  private readonly key: string;
  private cache = new Map<string, { value: unknown; expires: number }>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(apiKey: string | undefined = process.env.COTIZAVE_API_KEY) {
    if (!apiKey) throw new Error("Falta COTIZAVE_API_KEY en el entorno del servidor");
    this.key = apiKey;
  }

  /** GET con reintentos: 429 burst y 5xx se reintentan; 429 monthly, 4xx y 402 no. */
  private async request<T>(path: string, init: RequestInit = {}, attempts = 3): Promise<T> {
    for (let i = 0; ; i++) {
      let res: Response;
      try {
        res = await fetch(BASE_URL + path, {
          ...init,
          headers: { "X-API-Key": this.key, Accept: "application/json", ...init.headers },
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        if (i + 1 >= attempts) throw err;
        await sleep(2 ** i * 500 + Math.random() * 250);
        continue;
      }

      if (res.ok) return (await res.json()) as T;

      const body = (await res.json().catch(() => ({}))) as {
        code?: string; message?: string; field?: string; details?: Record<string, unknown>;
      };
      const error = new CotizaveError(
        res.status, body.code ?? "unknown_error", body.message ?? res.statusText,
        body.field, body.details, res.headers,
      );

      const scope = res.headers.get("X-RateLimit-Scope");
      const retryable = (res.status === 429 && scope === "burst") || res.status >= 500;
      if (!retryable || i + 1 >= attempts) throw error;

      const ms = Number(res.headers.get("X-RateLimit-Retry-After-Ms"))
        || Number(res.headers.get("Retry-After")) * 1000
        || 2 ** i * 500;
      await sleep(ms + Math.random() * 250); // jitter
    }
  }

  /** Cache con TTL + single-flight + último valor bueno si la API falla. */
  private async cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const p = load()
      .then((value) => {
        this.cache.set(key, { value, expires: Date.now() + ttlMs });
        return value;
      })
      .catch((err) => {
        if (hit && !(err instanceof CotizaveError && err.status < 429)) {
          console.warn("Cotizave no disponible; sirviendo último valor bueno", err);
          return hit.value as T; // stale-if-error
        }
        throw err;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  /** Snapshot completo. TTL 5 min por defecto (súbelo si tu plan tiene poca cuota). */
  rates(ttlMs = 5 * 60_000): Promise<RatesResponse> {
    return this.cached("rates", ttlMs, () => this.request<RatesResponse>("/v1/fx/rates"));
  }

  /** Busca un market por nombre (el orden de rates[] no está garantizado). */
  async rate(market: string): Promise<FXRate | undefined> {
    const { rates } = await this.rates();
    return rates.find((r) => r.market === market);
  }

  /** Conversión puntual. Sin `via` usa la tasa oficial BCV. Un lado debe ser VES. */
  convert(from: "USD" | "EUR" | "VES", to: "USD" | "EUR" | "VES", amount: number, via?: string) {
    const q = new URLSearchParams({ from, to, amount: String(amount) });
    if (via) q.set("via", via);
    return this.request<ConvertResponse>(`/v1/fx/convert?${q}`);
  }
}

// ── Ejemplo de uso ────────────────────────────────────────────────
export async function priceInBs(priceUSD: number) {
  const cz = new Cotizave();
  const bcv = await cz.rate("reference");
  if (!bcv) throw new Error("Tasa BCV no disponible");
  return {
    ves: Math.round(priceUSD * bcv.mid * 100) / 100,
    rate: bcv.mid,
    effectiveDate: bcv.effective_date, // guárdalo si emites factura
  };
}

export async function convertWithErrorHandling() {
  const cz = new Cotizave();
  try {
    return await cz.convert("USD", "VES", 100, "binance");
  } catch (err) {
    if (err instanceof CotizaveError) {
      if (err.isMonthlyQuota) {
        // No reintentar: alerta a una persona y sirve el último valor cacheado.
        console.error("Cuota mensual agotada hasta", err.headers?.get("X-RateLimit-Reset"));
      } else if (err.code === "feature_not_in_plan") {
        console.error("Requiere upgrade:", err.details?.feature);
      }
    }
    throw err;
  }
}
```

## Endpoint propio para el frontend (Next.js App Router)

El navegador llama a tu ruta; la key nunca sale del servidor.

```ts
// app/api/rates/route.ts
import { Cotizave } from "@/lib/cotizave";

const cz = new Cotizave();

export async function GET() {
  const { rates, fetched_at } = await cz.rates();
  const pick = (m: string) => rates.find((r) => r.market === m);
  return Response.json(
    { bcv: pick("reference"), parallel: pick("parallel"), binance: pick("binance"), fetched_at },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
  );
}
```

En serverless/edge cada instancia tiene su propio `Map`: apóyate en el cache HTTP
(`s-maxage`) o en un cache compartido para no multiplicar las llamadas.

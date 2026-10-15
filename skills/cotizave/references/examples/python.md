# Python (requests)

Requiere `pip install requests`. Para `httpx` el código es casi idéntico
(`httpx.Client(...)`, `response.json()`, mismos headers).

```python
"""cotizave.py — cliente mínimo para uso en servidor."""
from __future__ import annotations

import os
import random
import threading
import time
from typing import Any, Optional

import requests

BASE_URL = "https://api.cotizave.com"


class CotizaveError(Exception):
    def __init__(self, status: int, code: str, message: str,
                 field: Optional[str] = None, details: Optional[dict] = None,
                 headers: Optional[dict] = None) -> None:
        super().__init__(f"{status} {code}: {message}")
        self.status = status
        self.code = code
        self.field = field
        self.details = details or {}
        self.headers = headers or {}

    @property
    def is_monthly_quota(self) -> bool:
        """429 por cuota mensual: no reintentar hasta X-RateLimit-Reset."""
        return self.status == 429 and self.headers.get("X-RateLimit-Scope") == "monthly"


class Cotizave:
    def __init__(self, api_key: Optional[str] = None, timeout: float = 10.0) -> None:
        key = api_key or os.environ.get("COTIZAVE_API_KEY")
        if not key:
            raise RuntimeError("Falta COTIZAVE_API_KEY en el entorno del servidor")
        self._session = requests.Session()
        self._session.headers.update({"X-API-Key": key, "Accept": "application/json"})
        self._timeout = timeout
        self._cache: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def _get(self, path: str, params: Optional[dict] = None, attempts: int = 3) -> Any:
        for i in range(attempts):
            try:
                r = self._session.get(BASE_URL + path, params=params, timeout=self._timeout)
            except requests.RequestException:
                if i + 1 >= attempts:
                    raise
                time.sleep(2 ** i * 0.5 + random.random() * 0.25)
                continue

            if r.ok:
                return r.json()

            try:
                body = r.json()
            except ValueError:
                body = {}
            err = CotizaveError(r.status_code, body.get("code", "unknown_error"),
                                body.get("message", r.reason), body.get("field"),
                                body.get("details"), dict(r.headers))

            scope = r.headers.get("X-RateLimit-Scope")
            retryable = (r.status_code == 429 and scope == "burst") or r.status_code >= 500
            if not retryable or i + 1 >= attempts:
                raise err

            wait_ms = (r.headers.get("X-RateLimit-Retry-After-Ms")
                       or int(r.headers.get("Retry-After", "0")) * 1000
                       or 2 ** i * 500)
            time.sleep(int(wait_ms) / 1000 + random.random() * 0.25)  # jitter
        raise RuntimeError("unreachable")

    def rates(self, ttl: float = 300.0) -> dict:
        """Snapshot completo con cache TTL y fallback al último valor bueno."""
        with self._lock:
            hit = self._cache.get("rates")
            if hit and hit[0] > time.time():
                return hit[1]
            try:
                data = self._get("/v1/fx/rates")
            except (CotizaveError, requests.RequestException) as exc:
                client_error = isinstance(exc, CotizaveError) and exc.status < 429
                if hit and not client_error:
                    return hit[1]  # stale-if-error
                raise
            self._cache["rates"] = (time.time() + ttl, data)
            return data

    def rate(self, market: str) -> Optional[dict]:
        """Busca por nombre: el orden de rates[] no está garantizado."""
        return next((r for r in self.rates()["rates"] if r["market"] == market), None)

    def convert(self, frm: str, to: str, amount: float, via: Optional[str] = None) -> dict:
        """Sin `via` usa la tasa oficial BCV. Uno de los dos lados debe ser VES."""
        params: dict[str, Any] = {"from": frm, "to": to, "amount": amount}
        if via:
            params["via"] = via
        return self._get("/v1/fx/convert", params)


if __name__ == "__main__":
    cz = Cotizave()
    bcv = cz.rate("reference")
    if bcv:
        print(f"BCV: {bcv['mid']:.2f} Bs/USD, vigente desde {bcv.get('effective_date')}")
    try:
        res = cz.convert("USD", "VES", 100, via="binance")
        print(f"100 USD = {res['to']['amount']:.2f} Bs (stale={res['stale']})")
    except CotizaveError as e:
        if e.is_monthly_quota:
            print("Cuota mensual agotada hasta", e.headers.get("X-RateLimit-Reset"))
        elif e.code == "feature_not_in_plan":
            print("Requiere upgrade:", e.details.get("feature"))
        else:
            raise
```

Notas:

- En Django/FastAPI con varios workers, usa el cache compartido del framework
  (`django.core.cache`, un key-value store) en vez del `dict` en memoria.
- Para facturas, guarda `rate` y `effective_date` del resultado de `convert()`.
- Redondea con `decimal.Decimal(...).quantize(Decimal("0.01"), ROUND_HALF_EVEN)` si
  necesitas redondeo bancario.

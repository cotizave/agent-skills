#!/usr/bin/env bash
# check-key.sh — verifica que COTIZAVE_API_KEY funciona y muestra la cuota del plan.
#
# Uso:
#   COTIZAVE_API_KEY=ctz_live_... ./check-key.sh
#
# Hace UNA llamada a GET /v1/fx/rates/reference (consume 1 request de la cuota).
# Nunca imprime la key. Requiere curl; usa jq solo si está instalado.
# Sale con 0 si la key es válida (2xx), distinto de 0 en cualquier otro caso.

set -euo pipefail

BASE_URL="${COTIZAVE_BASE_URL:-https://api.cotizave.com}"
ENDPOINT="/v1/fx/rates/reference"

if ! command -v curl >/dev/null 2>&1; then
  echo "error: se necesita curl" >&2
  exit 2
fi

key="${COTIZAVE_API_KEY:-}"
if [[ -z "$key" ]]; then
  echo "error: la variable de entorno COTIZAVE_API_KEY no está definida." >&2
  echo "       Créala en https://app.cotizave.com (API Keys) y expórtala:" >&2
  echo "       export COTIZAVE_API_KEY=ctz_live_..." >&2
  exit 2
fi

if [[ ! "$key" =~ ^ctz_live_[0-9A-Za-z]{38}$ ]]; then
  echo "aviso: la key no tiene el formato esperado (ctz_live_ + 38 caracteres base62)." >&2
  echo "       Revisa que no tenga espacios, comillas o saltos de línea. Se intenta igual." >&2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# La key viaja por stdin (-H @-) para que no aparezca en la lista de procesos.
set +e
status="$(printf 'X-API-Key: %s\n' "$key" | curl -sS \
  --max-time 15 \
  -H @- \
  -H 'Accept: application/json' \
  -D "$tmp/headers" \
  -o "$tmp/body" \
  -w '%{http_code}' \
  "${BASE_URL}${ENDPOINT}")"
curl_rc=$?
set -e

if [[ $curl_rc -ne 0 ]]; then
  echo "error: no se pudo conectar con ${BASE_URL} (curl exit ${curl_rc})." >&2
  exit 3
fi

header() {
  # Búsqueda case-insensitive de un header en la respuesta.
  grep -i "^$1:" "$tmp/headers" | tail -n 1 | cut -d':' -f2- | tr -d '\r' | sed 's/^ *//'
}

field() {
  # Extrae un campo string/número de primer nivel del JSON (jq si existe).
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg f "$1" '.[$f] // empty' "$tmp/body" 2>/dev/null
  else
    sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",}]*\).*/\1/p" "$tmp/body" | head -n 1
  fi
}

echo "GET ${ENDPOINT} -> HTTP ${status}"
echo "  X-RateLimit-Limit:     $(header X-RateLimit-Limit)"
echo "  X-RateLimit-Remaining: $(header X-RateLimit-Remaining)"
echo "  X-RateLimit-Reset:     $(header X-RateLimit-Reset)"

if [[ "$status" =~ ^2 ]]; then
  echo "OK: la key es válida. BCV mid=$(field mid) effective_date=$(field effective_date)"
  exit 0
fi

code="$(field code)"
message="$(field message)"
echo "error: ${code:-sin código} — ${message:-sin mensaje}" >&2
case "$status" in
  401) echo "       Key inválida, mal copiada o revocada." >&2 ;;
  402) echo "       Tu plan no incluye este recurso." >&2 ;;
  403) echo "       Cuenta inactiva o recurso no disponible." >&2 ;;
  429)
    scope="$(header X-RateLimit-Scope)"
    echo "       Rate limit (${scope:-?}). Retry-After: $(header Retry-After)s." >&2
    if [[ "$scope" == "monthly" ]]; then
      echo "       Cuota mensual agotada: no reintentes hasta X-RateLimit-Reset." >&2
    fi
    ;;
  5*) echo "       Error del lado de Cotizave; reintenta más tarde." >&2 ;;
esac
exit 1

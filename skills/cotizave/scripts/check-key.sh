#!/usr/bin/env bash
# Comprueba una key SOLO cuando el usuario pide ese diagnóstico. Consume una request.
# Requisitos: bash 3.2+, curl 8.4+ (límite de bytes incluso sin Content-Length), jq.
# COTIZAVE_API_KEY: se recorta whitespace exterior; nunca se muestra.
# COTIZAVE_BASE_URL: origen oficial o loopback con la key ficticia ctz_live_test.
# Códigos: 0 contrato válido; 1 HTTP/protocolo; 2 configuración; 3 transporte/límite.
# No ejecutar con bash -x: el trazado del shell puede exponer credenciales.
set +x
set -euo pipefail
umask 077

BASE_URL="${COTIZAVE_BASE_URL:-https://api.cotizave.com}"
BASE_URL="${BASE_URL%/}"
ENDPOINT="/v1/fx/rates/reference"
local_test=false
case "$BASE_URL" in
  https://api.cotizave.com|https://api.cotizave.com:443) ;;
  *)
    if [[ "$BASE_URL" =~ ^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]]; then
      local_test=true
    else
      echo 'error: destino inválido; solo origen oficial o loopback para tests.' >&2
      exit 2
    fi
    ;;
esac

for tool in curl jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: se necesita ${tool}; no se envió ninguna solicitud." >&2
    exit 2
  fi
done
curl_version="$(curl -q --version | head -n 1)"
if [[ "$curl_version" =~ ^curl\ ([0-9]+)\.([0-9]+)\. ]]; then
  if (( BASH_REMATCH[1] < 8 || (BASH_REMATCH[1] == 8 && BASH_REMATCH[2] < 4) )); then
    echo 'error: se necesita curl 8.4 o posterior para limitar el cuerpo descargado.' >&2
    exit 2
  fi
else
  echo 'error: no se pudo verificar la versión de curl.' >&2
  exit 2
fi

key="${COTIZAVE_API_KEY:-}"
unset COTIZAVE_API_KEY
key="${key#"${key%%[![:space:]]*}"}"
key="${key%"${key##*[![:space:]]}"}"
if [[ -z "$key" || "$key" =~ [^A-Za-z0-9_] ]]; then
  echo 'error: falta la key o contiene caracteres inválidos; no se envió.' >&2
  exit 2
fi
if [[ "$local_test" == true ]]; then
  if [[ "$key" != ctz_live_test ]]; then
    echo 'error: loopback solo admite la key ficticia documentada.' >&2
    exit 2
  fi
elif [[ ! "$key" =~ ^ctz_live_[0-9A-Za-z]{38}$ ]]; then
  echo 'error: formato de key inválido; no se envió.' >&2
  exit 2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# -q debe ser el primer argumento: ignora curlrc (TLS, redirects, trace, URLs extra).
# La key va por stdin, no por argv. No imprimir stderr ni cuerpos remotos sin filtrar.
proxy_args=()
if [[ "$local_test" == true ]]; then proxy_args=(--noproxy '*'); fi
set +e
status="$(printf 'X-API-Key: %s\n' "$key" | curl -q -sS \
  --no-location --proto '=https,http' --connect-timeout 5 --max-time 15 \
  --max-filesize 1048576 \
  ${proxy_args[@]+"${proxy_args[@]}"} \
  -H @- -H 'Accept: application/json' \
  -D "$tmp/headers" -o "$tmp/body" -w '%{http_code}' \
  "${BASE_URL}${ENDPOINT}" 2>/dev/null)"
curl_rc=$?
set -e
unset key
if [[ $curl_rc -ne 0 ]]; then
  echo "error: transporte o límite de respuesta (curl exit ${curl_rc}); no se reintentó." >&2
  exit 3
fi

header() {
  awk -v name="$1" '
    BEGIN { name = tolower(name) ":" }
    /^HTTP\// { value = ""; next }
    { line = $0; sub(/\r$/, "", line)
      if (tolower(substr(line, 1, length(name))) == name) {
        value = substr(line, length(name) + 1); sub(/^[ \t]+/, "", value)
      }
    }
    END { print value }' "$tmp/headers"
}

# Solo se muestran campos numéricos/fechas validados; ni message, code, Location
# ni valores arbitrarios de headers: un upstream podría reflejar la credencial.
echo "GET ${ENDPOINT} -> HTTP ${status}"
for name in X-RateLimit-Limit X-RateLimit-Remaining; do
  value="$(header "$name")"
  if [[ "$value" =~ ^[0-9]{1,16}$ ]]; then echo "  ${name}: ${value}"; fi
done
value="$(header X-RateLimit-Reset)"
if [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$ ]]; then
  echo "  X-RateLimit-Reset: ${value}"
fi

if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
  if ! jq -e -s 'length == 1 and (.[0] | type == "object" and
      .market == "reference" and (.mid | type == "number" and . > 0 and . < 1e308) and
      (.effective_date | type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")))' \
      "$tmp/body" >/dev/null 2>&1; then
    echo 'error: respuesta exitosa sin el contrato esperado; key no verificada.' >&2
    exit 1
  fi
  jq -r '"OK: key verificada. BCV mid=\(.mid) effective_date=\(.effective_date)"' "$tmp/body"
  exit 0
fi
case "$status" in
  3*) echo 'error: redirección rechazada; no se reenvió la key.' >&2 ;;
  401) echo 'error: key ausente, inválida o revocada.' >&2 ;;
  402) echo 'error: recurso no incluido en el plan.' >&2 ;;
  403) echo 'error: acceso no permitido; revisa la cuenta.' >&2 ;;
  429)
    scope="$(header X-RateLimit-Scope)"
    if [[ -z "$scope" ]]; then
      scope="$(jq -r 'if type == "object" then .details.kind // empty else empty end' "$tmp/body" 2>/dev/null || true)"
    fi
    case "$scope" in
      monthly) echo 'error: cuota mensual agotada; no reintentar hasta el reset.' >&2 ;;
      burst) echo 'error: límite de ráfaga; espera antes de volver a llamar.' >&2 ;;
      *) echo 'error: límite temporal; respeta Retry-After.' >&2 ;;
    esac
    ;;
  *) echo 'error: respuesta HTTP no exitosa; consulta el contrato de errores.' >&2 ;;
esac
exit 1

# PHP (8.1+, ext-curl, sin dependencias)

```php
<?php
// Cotizave.php — uso exclusivo del lado servidor.
declare(strict_types=1);

final class CotizaveException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?string $field = null,
        public readonly array $details = [],
        public readonly array $headers = [],
    ) {
        parent::__construct("{$status} {$errorCode}: {$message}");
    }

    public function isMonthlyQuota(): bool
    {
        return $this->status === 429 && ($this->headers['x-ratelimit-scope'] ?? '') === 'monthly';
    }
}

final class Cotizave
{
    private const BASE_URL = 'https://api.cotizave.com';
    private string $apiKey;

    public function __construct(?string $apiKey = null)
    {
        $key = $apiKey ?? getenv('COTIZAVE_API_KEY');
        if (!is_string($key) || $key === '') {
            throw new RuntimeException('Falta COTIZAVE_API_KEY en el entorno del servidor');
        }
        $this->apiKey = $key;
    }

    /** @return array<string, mixed> */
    public function get(string $path, array $query = [], int $attempts = 3): array
    {
        $url = self::BASE_URL . $path . ($query ? '?' . http_build_query($query) : '');

        for ($i = 0; ; $i++) {
            $headers = [];
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => ['X-API-Key: ' . $this->apiKey, 'Accept: application/json'],
                CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$headers): int {
                    $parts = explode(':', $line, 2);
                    if (count($parts) === 2) {
                        $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                    return strlen($line);
                },
            ]);
            $raw = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);

            if ($raw === false) {
                if ($i + 1 >= $attempts) {
                    throw new RuntimeException('Error de red al llamar a Cotizave');
                }
                usleep((int) ((2 ** $i) * 500_000 + random_int(0, 250_000)));
                continue;
            }

            $body = json_decode((string) $raw, true) ?? [];
            if ($status >= 200 && $status < 300) {
                return $body;
            }

            $error = new CotizaveException(
                $status,
                $body['code'] ?? 'unknown_error',
                $body['message'] ?? 'HTTP ' . $status,
                $body['field'] ?? null,
                $body['details'] ?? [],
                $headers,
            );

            $retryable = ($status === 429 && ($headers['x-ratelimit-scope'] ?? '') === 'burst') || $status >= 500;
            if (!$retryable || $i + 1 >= $attempts) {
                throw $error;
            }
            $waitMs = (int) ($headers['x-ratelimit-retry-after-ms'] ?? 0)
                ?: ((int) ($headers['retry-after'] ?? 0)) * 1000
                ?: (2 ** $i) * 500;
            usleep(($waitMs + random_int(0, 250)) * 1000); // jitter
        }
    }

    /** Snapshot completo. Cachea el resultado (APCu, tu framework o un key-value store). */
    public function rates(): array
    {
        return $this->get('/v1/fx/rates');
    }

    /** Sin $via usa la tasa oficial BCV. Uno de los dos lados debe ser VES. */
    public function convert(string $from, string $to, float $amount, ?string $via = null): array
    {
        $query = ['from' => $from, 'to' => $to, 'amount' => $amount];
        if ($via !== null) {
            $query['via'] = $via;
        }
        return $this->get('/v1/fx/convert', $query);
    }
}

// ── Ejemplo con cache APCu (si está disponible) ──────────────────────
function bcvRate(Cotizave $cz): array
{
    $cacheKey = 'cotizave:rates';
    if (function_exists('apcu_fetch')) {
        $hit = apcu_fetch($cacheKey, $ok);
        if ($ok) {
            $rates = $hit;
        }
    }
    if (!isset($rates)) {
        $rates = $cz->rates();
        if (function_exists('apcu_store')) {
            apcu_store($cacheKey, $rates, 300); // 5 min
        }
    }
    foreach ($rates['rates'] as $r) {
        if ($r['market'] === 'reference') {
            return $r; // mid, updated_at, effective_date
        }
    }
    throw new RuntimeException('Tasa BCV no disponible');
}

try {
    $cz = new Cotizave();
    $bcv = bcvRate($cz);
    printf("BCV: %.2f Bs/USD (vigente desde %s)\n", $bcv['mid'], $bcv['effective_date'] ?? '-');
} catch (CotizaveException $e) {
    if ($e->isMonthlyQuota()) {
        error_log('Cuota mensual de Cotizave agotada hasta ' . ($e->headers['x-ratelimit-reset'] ?? '?'));
    } elseif ($e->errorCode === 'feature_not_in_plan') {
        error_log('Requiere upgrade: ' . ($e->details['feature'] ?? ''));
    } else {
        throw $e;
    }
}
```

En Laravel: guarda la key en `.env` (`COTIZAVE_API_KEY=ctz_live_...`), léela vía
`config()` y envuelve `rates()` con `Cache::remember('cotizave:rates', 300, ...)`.

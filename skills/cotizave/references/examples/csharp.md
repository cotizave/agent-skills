# C# (.NET 8+, `HttpClient` + `System.Text.Json`, sin dependencias)

```csharp
// CotizaveClient.cs — uso exclusivo del lado servidor.
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Cotizave;

public sealed record Rate(
    [property: JsonPropertyName("market")] string Market,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("base")] string? Base,
    [property: JsonPropertyName("ask")] double? Ask,
    [property: JsonPropertyName("bid")] double? Bid,
    [property: JsonPropertyName("mid")] double Mid,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt,
    [property: JsonPropertyName("effective_date")] string? EffectiveDate); // fecha valor (solo BCV)

public sealed record Rates(
    [property: JsonPropertyName("country")] string Country,
    [property: JsonPropertyName("currency")] string Currency,
    [property: JsonPropertyName("base")] string Base,
    [property: JsonPropertyName("rates")] List<Rate> Items,
    [property: JsonPropertyName("fetched_at")] DateTimeOffset FetchedAt)
{
    /// <summary>Busca por nombre: el orden de rates[] no está garantizado.</summary>
    public Rate? Find(string market) => Items.FirstOrDefault(r => r.Market == market);
}

public sealed record Amount(
    [property: JsonPropertyName("currency")] string Currency,
    [property: JsonPropertyName("amount")] double Value);

public sealed record Conversion(
    [property: JsonPropertyName("from")] Amount From,
    [property: JsonPropertyName("to")] Amount To,
    [property: JsonPropertyName("rate")] double Rate,
    [property: JsonPropertyName("market")] string Market,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("updated_at")] string UpdatedAt,
    [property: JsonPropertyName("effective_date")] string? EffectiveDate,
    [property: JsonPropertyName("staleness_sec")] int StalenessSec,
    [property: JsonPropertyName("stale")] bool Stale);

/// <summary>Error de la API: {code, message, field, details}.</summary>
public sealed class CotizaveException(
    HttpStatusCode status, string code, string message, string? field,
    JsonElement? details, HttpResponseMessage response)
    : Exception($"{(int)status} {code}: {message}")
{
    public HttpStatusCode Status { get; } = status;
    public string Code { get; } = code;
    public string? Field { get; } = field;
    public JsonElement? Details { get; } = details;

    public string? Header(string name) =>
        response.Headers.TryGetValues(name, out var v) ? v.FirstOrDefault() : null;

    /// <summary>429 por cuota mensual: no reintentar hasta X-RateLimit-Reset.</summary>
    public bool IsMonthlyQuota =>
        Status == HttpStatusCode.TooManyRequests && Header("X-RateLimit-Scope") == "monthly";
}

public sealed class CotizaveClient
{
    private readonly HttpClient _http;
    private readonly TimeSpan _ttl;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private Rates? _cached;
    private DateTimeOffset _cachedAt = DateTimeOffset.MinValue;

    /// <param name="http">Inyéctalo con IHttpClientFactory en ASP.NET Core.</param>
    public CotizaveClient(HttpClient http, TimeSpan? ttl = null)
    {
        var key = Environment.GetEnvironmentVariable("COTIZAVE_API_KEY");
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException("Falta COTIZAVE_API_KEY en el entorno del servidor");

        _http = http;
        _http.BaseAddress = new Uri("https://api.cotizave.com");
        _http.Timeout = TimeSpan.FromSeconds(10);
        _http.DefaultRequestHeaders.Add("X-API-Key", key);
        _http.DefaultRequestHeaders.Add("Accept", "application/json");
        _ttl = ttl ?? TimeSpan.FromMinutes(5);
    }

    private async Task<T> GetAsync<T>(string pathAndQuery, CancellationToken ct)
    {
        const int attempts = 3;
        for (var i = 0; ; i++)
        {
            HttpResponseMessage res;
            try
            {
                res = await _http.GetAsync(pathAndQuery, ct);
            }
            catch (HttpRequestException) when (i + 1 < attempts)
            {
                await Task.Delay(Backoff(i), ct);
                continue;
            }

            if (res.IsSuccessStatusCode)
                return (await res.Content.ReadFromJsonAsync<T>(ct))!;

            JsonElement body = default;
            try { body = await res.Content.ReadFromJsonAsync<JsonElement>(ct); }
            catch (JsonException) { }

            string? Str(string name) =>
                body.ValueKind == JsonValueKind.Object && body.TryGetProperty(name, out var p) &&
                p.ValueKind == JsonValueKind.String ? p.GetString() : null;
            JsonElement? details = body.ValueKind == JsonValueKind.Object &&
                body.TryGetProperty("details", out var d) ? d : null;

            var error = new CotizaveException(res.StatusCode, Str("code") ?? "unknown_error",
                Str("message") ?? res.ReasonPhrase ?? "error", Str("field"), details, res);

            var scope = error.Header("X-RateLimit-Scope");
            var retryable = (res.StatusCode == HttpStatusCode.TooManyRequests && scope == "burst")
                            || (int)res.StatusCode >= 500;
            if (!retryable || i + 1 >= attempts) throw error;

            var wait = int.TryParse(error.Header("X-RateLimit-Retry-After-Ms"), out var ms)
                ? TimeSpan.FromMilliseconds(ms)
                : res.Headers.RetryAfter?.Delta ?? Backoff(i);
            await Task.Delay(wait + TimeSpan.FromMilliseconds(Random.Shared.Next(250)), ct); // jitter
        }
    }

    private static TimeSpan Backoff(int attempt) =>
        TimeSpan.FromMilliseconds(500 * (1 << attempt) + Random.Shared.Next(250));

    /// <summary>Snapshot con cache TTL y último valor bueno si la API falla.</summary>
    public async Task<Rates> GetRatesAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_cached is not null && DateTimeOffset.UtcNow - _cachedAt < _ttl) return _cached;
            try
            {
                _cached = await GetAsync<Rates>("/v1/fx/rates", ct);
                _cachedAt = DateTimeOffset.UtcNow;
                return _cached;
            }
            catch (Exception e) when (_cached is not null &&
                (e is HttpRequestException || e is TaskCanceledException ||
                 (e is CotizaveException ce && (int)ce.Status >= 429)))
            {
                return _cached; // stale-if-error
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>Sin via usa la tasa oficial BCV. Uno de los dos lados debe ser VES.</summary>
    public Task<Conversion> ConvertAsync(string from, string to, decimal amount,
        string? via = null, CancellationToken ct = default)
    {
        var q = $"/v1/fx/convert?from={from}&to={to}&amount={amount.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
        if (via is not null) q += $"&via={Uri.EscapeDataString(via)}";
        return GetAsync<Conversion>(q, ct);
    }
}
```

Uso (por ejemplo, en un endpoint de ASP.NET Core o en una app de consola):

```csharp
var cz = new CotizaveClient(new HttpClient());
var bcv = (await cz.GetRatesAsync()).Find("reference");
if (bcv is not null)
    Console.WriteLine($"BCV: {bcv.Mid:F2} Bs/USD, vigente desde {bcv.EffectiveDate}");

try
{
    var c = await cz.ConvertAsync("USD", "VES", 100m, via: "binance");
    Console.WriteLine($"100 USD = {c.To.Value:F2} Bs (stale={c.Stale})");
}
catch (CotizaveException e) when (e.IsMonthlyQuota)
{
    // No reintentar: avisar y servir el último valor guardado.
    Console.Error.WriteLine($"Cuota mensual agotada hasta {e.Header("X-RateLimit-Reset")}");
}
catch (CotizaveException e) when (e.Code == "feature_not_in_plan")
{
    Console.Error.WriteLine($"Requiere upgrade: {e.Details?.GetProperty("feature")}");
}
```

Notas:

- En ASP.NET Core registra el cliente con `builder.Services.AddHttpClient<CotizaveClient>()`
  (singleton/typed client) y, con varias instancias, cachea en `IDistributedCache`.
- La key va en una variable de entorno o en el gestor de secretos (`dotnet
  user-secrets` en desarrollo), nunca en `appsettings.json` del repo.
- Usa `decimal` para montos y `Math.Round(x, 2, MidpointRounding.ToEven)` al redondear.

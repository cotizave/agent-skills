# Java (17+, `java.net.http` + Jackson)

Única dependencia: Jackson para JSON (`com.fasterxml.jackson.core:jackson-databind`).

```xml
<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
  <version>2.17.2</version>
</dependency>
```

```java
// CotizaveClient.java — uso exclusivo del lado servidor.
package com.example.cotizave;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

public final class CotizaveClient {

    private static final String BASE_URL = "https://api.cotizave.com";

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Rate(
            String market,
            String type,
            String base,
            Double ask,
            Double bid,
            double mid,
            @JsonProperty("updated_at") String updatedAt,
            @JsonProperty("effective_date") String effectiveDate) { // fecha valor (solo BCV)
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Rates(String country, String currency, String base, List<Rate> rates,
                        @JsonProperty("fetched_at") String fetchedAt) {
        /** Busca por nombre: el orden de rates[] no está garantizado. */
        public Optional<Rate> find(String market) {
            return rates.stream().filter(r -> r.market().equals(market)).findFirst();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Amount(String currency, double amount) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Conversion(Amount from, Amount to, double rate, String market, String type,
                             @JsonProperty("updated_at") String updatedAt,
                             @JsonProperty("effective_date") String effectiveDate,
                             @JsonProperty("staleness_sec") int stalenessSec,
                             boolean stale) {
    }

    /** Error de la API: {code, message, field, details}. */
    public static final class CotizaveException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final int status;
        private final String code;
        private final String field;
        private final transient JsonNode details;
        private final transient HttpResponse<String> response;

        CotizaveException(int status, String code, String message, String field,
                          JsonNode details, HttpResponse<String> response) {
            super(status + " " + code + ": " + message);
            this.status = status;
            this.code = code;
            this.field = field;
            this.details = details;
            this.response = response;
        }

        public int status() { return status; }
        public String code() { return code; }
        public String field() { return field; }
        public JsonNode details() { return details; }

        public String header(String name) {
            return response.headers().firstValue(name).orElse(null);
        }

        /** 429 por cuota mensual: no reintentar hasta X-RateLimit-Reset. */
        public boolean isMonthlyQuota() {
            return status == 429 && "monthly".equals(header("X-RateLimit-Scope"));
        }
    }

    private final String apiKey;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private final Duration ttl;

    private Rates cachedRates;
    private Instant cachedAt = Instant.EPOCH;

    public CotizaveClient(Duration ttl) {
        String key = System.getenv("COTIZAVE_API_KEY");
        if (key == null || key.isBlank()) {
            throw new IllegalStateException("Falta COTIZAVE_API_KEY en el entorno del servidor");
        }
        this.apiKey = key;
        this.ttl = ttl;
    }

    private <T> T get(String path, Map<String, String> query, Class<T> type)
            throws IOException, InterruptedException {
        String qs = query.isEmpty() ? "" : "?" + query.entrySet().stream()
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        HttpRequest request = HttpRequest.newBuilder(URI.create(BASE_URL + path + qs))
                .timeout(Duration.ofSeconds(10))
                .header("X-API-Key", apiKey)
                .header("Accept", "application/json")
                .GET()
                .build();

        final int attempts = 3;
        for (int i = 0; ; i++) {
            HttpResponse<String> res;
            try {
                res = http.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                if (i + 1 >= attempts) throw e;
                Thread.sleep(backoffMs(i));
                continue;
            }

            if (res.statusCode() / 100 == 2) {
                return json.readValue(res.body(), type);
            }

            JsonNode body = safeParse(res.body());
            CotizaveException error = new CotizaveException(res.statusCode(),
                    body.path("code").asText("unknown_error"),
                    body.path("message").asText("HTTP " + res.statusCode()),
                    body.path("field").asText(null),
                    body.path("details"),
                    res);

            String scope = res.headers().firstValue("X-RateLimit-Scope").orElse("");
            boolean retryable = (res.statusCode() == 429 && scope.equals("burst")) || res.statusCode() >= 500;
            if (!retryable || i + 1 >= attempts) throw error;

            long waitMs = res.headers().firstValue("X-RateLimit-Retry-After-Ms").map(Long::parseLong)
                    .or(() -> res.headers().firstValue("Retry-After").map(s -> Long.parseLong(s) * 1000))
                    .orElse(backoffMs(i));
            Thread.sleep(waitMs + ThreadLocalRandom.current().nextLong(250)); // jitter
        }
    }

    private JsonNode safeParse(String raw) {
        try {
            return json.readTree(raw);
        } catch (IOException e) {
            return json.createObjectNode();
        }
    }

    private static long backoffMs(int attempt) {
        return 500L * (1L << attempt) + ThreadLocalRandom.current().nextLong(250);
    }

    /** Snapshot con cache TTL y último valor bueno si la API falla. */
    public synchronized Rates rates() throws IOException, InterruptedException {
        if (cachedRates != null && Instant.now().isBefore(cachedAt.plus(ttl))) {
            return cachedRates;
        }
        try {
            cachedRates = get("/v1/fx/rates", Map.of(), Rates.class);
            cachedAt = Instant.now();
            return cachedRates;
        } catch (CotizaveException e) {
            if (cachedRates != null && e.status() >= 429) return cachedRates; // stale-if-error
            throw e;
        } catch (IOException e) {
            if (cachedRates != null) return cachedRates;
            throw e;
        }
    }

    /** Sin via usa la tasa oficial BCV. Uno de los dos lados debe ser VES. */
    public Conversion convert(String from, String to, double amount, String via)
            throws IOException, InterruptedException {
        Map<String, String> q = new java.util.LinkedHashMap<>();
        q.put("from", from);
        q.put("to", to);
        q.put("amount", java.math.BigDecimal.valueOf(amount).toPlainString());
        if (via != null) q.put("via", via);
        return get("/v1/fx/convert", q, Conversion.class);
    }

    public static void main(String[] args) throws Exception {
        CotizaveClient cz = new CotizaveClient(Duration.ofMinutes(5));
        cz.rates().find("reference").ifPresent(bcv ->
                System.out.printf("BCV: %.2f Bs/USD, vigente desde %s%n", bcv.mid(), bcv.effectiveDate()));
        try {
            Conversion c = cz.convert("USD", "VES", 100, "binance");
            System.out.printf("100 USD = %.2f Bs (stale=%s)%n", c.to().amount(), c.stale());
        } catch (CotizaveException e) {
            if (e.isMonthlyQuota()) {
                System.err.println("Cuota mensual agotada hasta " + e.header("X-RateLimit-Reset"));
            } else if ("feature_not_in_plan".equals(e.code())) {
                System.err.println("Requiere upgrade: " + e.details().path("feature").asText());
            } else {
                throw e;
            }
        }
    }
}
```

Notas:

- En Spring Boot, registra el cliente como `@Bean` singleton y usa `@Cacheable` con un
  cache compartido si tienes varias instancias. Guarda la key en una variable de
  entorno o en el gestor de secretos, nunca en `application.properties` del repo.
- Para montos usa `BigDecimal` con `RoundingMode.HALF_EVEN` al redondear.

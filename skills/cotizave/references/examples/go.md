# Go (stdlib)

```go
// Package cotizave es un cliente mínimo de la API de Cotizave para uso en servidor.
package cotizave

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"sync"
	"time"
)

const baseURL = "https://api.cotizave.com"

// Rate es un elemento de rates[] o la respuesta de /v1/fx/rates/:market.
type Rate struct {
	Market        string    `json:"market"`
	Type          string    `json:"type"`
	Base          string    `json:"base,omitempty"`
	Ask           float64   `json:"ask,omitempty"`
	Bid           float64   `json:"bid,omitempty"`
	Mid           float64   `json:"mid"`
	UpdatedAt     time.Time `json:"updated_at"`
	EffectiveDate string    `json:"effective_date,omitempty"` // fecha valor (solo BCV)
	StaleAfterSec int       `json:"stale_after_sec,omitempty"`
}

// Rates es la respuesta de GET /v1/fx/rates.
type Rates struct {
	Country   string    `json:"country"`
	Currency  string    `json:"currency"`
	Base      string    `json:"base"`
	Rates     []Rate    `json:"rates"`
	FetchedAt time.Time `json:"fetched_at"`
}

// Find busca por nombre: el orden de rates[] no está garantizado.
func (r *Rates) Find(market string) (Rate, bool) {
	for _, x := range r.Rates {
		if x.Market == market {
			return x, true
		}
	}
	return Rate{}, false
}

// Conversion es la respuesta de GET /v1/fx/convert.
type Conversion struct {
	From          Amount  `json:"from"`
	To            Amount  `json:"to"`
	Rate          float64 `json:"rate"`
	Market        string  `json:"market"`
	Type          string  `json:"type"`
	UpdatedAt     string  `json:"updated_at"`
	EffectiveDate string  `json:"effective_date,omitempty"`
	StalenessSec  int     `json:"staleness_sec"`
	Stale         bool    `json:"stale"`
}

type Amount struct {
	Currency string  `json:"currency"`
	Amount   float64 `json:"amount"`
}

// Error es un error de la API ({code, message, field, details}).
type Error struct {
	Status  int            `json:"-"`
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Field   string         `json:"field,omitempty"`
	Details map[string]any `json:"details,omitempty"`
	Header  http.Header    `json:"-"`
}

func (e *Error) Error() string {
	return fmt.Sprintf("cotizave: %d %s: %s", e.Status, e.Code, e.Message)
}

// MonthlyQuota indica un 429 por cuota mensual: no reintentar hasta X-RateLimit-Reset.
func (e *Error) MonthlyQuota() bool {
	return e.Status == http.StatusTooManyRequests && e.Header.Get("X-RateLimit-Scope") == "monthly"
}

type Client struct {
	key  string
	http *http.Client

	mu       sync.Mutex
	cached   *Rates
	cachedAt time.Time
	TTL      time.Duration
}

// New lee la key de COTIZAVE_API_KEY.
func New() (*Client, error) {
	key := os.Getenv("COTIZAVE_API_KEY")
	if key == "" {
		return nil, errors.New("falta COTIZAVE_API_KEY en el entorno del servidor")
	}
	return &Client{key: key, http: &http.Client{Timeout: 10 * time.Second}, TTL: 5 * time.Minute}, nil
}

func (c *Client) get(ctx context.Context, path string, q url.Values, out any) error {
	u := baseURL + path
	if len(q) > 0 {
		u += "?" + q.Encode()
	}
	const attempts = 3
	for i := 0; ; i++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return err
		}
		req.Header.Set("X-API-Key", c.key)
		req.Header.Set("Accept", "application/json")

		resp, err := c.http.Do(req)
		if err != nil {
			if i+1 >= attempts {
				return err
			}
			sleep(ctx, backoff(i))
			continue
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			defer resp.Body.Close()
			return json.NewDecoder(resp.Body).Decode(out)
		}

		apiErr := &Error{Status: resp.StatusCode, Header: resp.Header}
		_ = json.NewDecoder(resp.Body).Decode(apiErr)
		resp.Body.Close()

		retryable := (resp.StatusCode == http.StatusTooManyRequests &&
			resp.Header.Get("X-RateLimit-Scope") == "burst") || resp.StatusCode >= 500
		if !retryable || i+1 >= attempts {
			return apiErr
		}
		wait := backoff(i)
		if ms, err := strconv.Atoi(resp.Header.Get("X-RateLimit-Retry-After-Ms")); err == nil {
			wait = time.Duration(ms) * time.Millisecond
		} else if s, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil {
			wait = time.Duration(s) * time.Second
		}
		sleep(ctx, wait+time.Duration(rand.IntN(250))*time.Millisecond) // jitter
	}
}

func backoff(i int) time.Duration { return time.Duration(500*(1<<i)) * time.Millisecond }

func sleep(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

// Rates devuelve el snapshot con cache TTL y el último valor bueno si la API falla.
func (c *Client) Rates(ctx context.Context) (*Rates, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cached != nil && time.Since(c.cachedAt) < c.TTL {
		return c.cached, nil
	}
	var r Rates
	if err := c.get(ctx, "/v1/fx/rates", nil, &r); err != nil {
		var apiErr *Error
		clientErr := errors.As(err, &apiErr) && apiErr.Status < 429
		if c.cached != nil && !clientErr {
			return c.cached, nil // stale-if-error
		}
		return nil, err
	}
	c.cached, c.cachedAt = &r, time.Now()
	return &r, nil
}

// Convert: sin via usa la tasa oficial BCV. Uno de los dos lados debe ser VES.
func (c *Client) Convert(ctx context.Context, from, to string, amount float64, via string) (*Conversion, error) {
	q := url.Values{"from": {from}, "to": {to}, "amount": {strconv.FormatFloat(amount, 'f', -1, 64)}}
	if via != "" {
		q.Set("via", via)
	}
	var out Conversion
	if err := c.get(ctx, "/v1/fx/convert", q, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
```

Uso:

```go
cz, err := cotizave.New()
if err != nil { log.Fatal(err) }
rates, err := cz.Rates(ctx)
if err != nil {
	var apiErr *cotizave.Error
	if errors.As(err, &apiErr) && apiErr.MonthlyQuota() {
		// No reintentar: alertar y servir el último valor guardado.
	}
	return err
}
if bcv, ok := rates.Find("reference"); ok {
	fmt.Printf("BCV %.2f Bs/USD vigente desde %s\n", bcv.Mid, bcv.EffectiveDate)
}
```

Con varias réplicas, reemplaza el cache del struct por uno compartido.

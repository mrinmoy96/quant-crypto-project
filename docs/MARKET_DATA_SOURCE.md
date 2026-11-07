# Real Market Data Source (Phase 8)

## What's used and why

**Yahoo Finance's public chart endpoint**, not NSE/BSE's own public APIs.

The project initially targeted NSE's `/api/allIndices` for NIFTY and a
BSE endpoint for SENSEX. Both were dropped in favor of Yahoo Finance
because:

- **NSE requires a two-cookie-domain session dance** (`www.nseindia.com`
  for quotes, a *separate* `charting.nseindia.com` session for intraday
  candles) that's fragile and was not something this project could
  verify end-to-end (see "What could not be tested" below).
- **BSE has no single well-documented index-quote endpoint** — what
  exists is thinly documented across community sources, with real
  uncertainty about the exact response field names.
- **Yahoo Finance needs no cookies, no session, no auth** — one GET
  request returns both a live quote *and* real intraday candles in one
  call. Confirmed via multiple independent, recently-published (2026)
  sources.

## Endpoint

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval={interval}
```

| Instrument | Yahoo symbol |
|---|---|
| NIFTY 50 | `^NSEI` |
| SENSEX | `^BSESN` |

Response shape (`chart.result[0]`):
- `meta.regularMarketPrice`, `meta.chartPreviousClose` — used for quotes
- `timestamp` — array of Unix seconds
- `indicators.quote[0].{open,high,low,close,volume}` — parallel arrays;
  Yahoo puts `null` in bars with no trades (e.g. outside market hours),
  which `YahooFinanceProvider.getCandles()` filters out

Timeframe → Yahoo interval/range mapping (in `YahooFinanceProvider.js`),
chosen to respect Yahoo's known intraday history limits:

| Our timeframe | Yahoo interval | Range used |
|---|---|---|
| `1m` | `1m` | `5d` (Yahoo only keeps ~7 days of 1m data) |
| `5m` | `5m` | `1mo` |
| `15m` | `15m` | `1mo` |
| `1h` | `60m` | `6mo` |
| `1d` | `1d` | `2y` |

## What could NOT be tested, and why

This is important: **no request to `query1.finance.yahoo.com` was
actually executed successfully from the environment that built this
integration.** Two separate tools were tried:

1. A sandboxed shell with network access restricted to package
   registries (npm/pypi/github) — `query1.finance.yahoo.com` isn't on
   that allowlist.
2. A web-fetch tool — blocked by Yahoo's `robots.txt`.

When the running backend itself (which has normal outbound network
access) tried it, the request completed but got **HTTP 403** — plausibly
the hosting environment's own egress rules, not necessarily a Yahoo
block. Either way: **the exact current response shape has not been
confirmed by a real successful call**, only by cross-referencing several
independent, recently-published (2026) sources that agree with each
other on the URL pattern, symbols, and JSON structure.

**You should verify this yourself** by running the backend somewhere
with normal internet access and checking `/api/market/nifty` returns
`"source": "yahoo-finance"` (not `"mock-fallback"`) with a plausible
NIFTY 50 price.

## What WAS actually verified

Everything that doesn't require reaching the real Yahoo endpoint:

- **Parsing and error handling**, against a local fixture HTTP server
  serving a realistic response shape — `backend/test/providers.test.js`,
  10 tests, all passing (`npm test` in `backend/`). This proves the
  *code* is mechanically correct against the shape multiple sources
  agree on; it does not prove Yahoo's *actual current* shape matches.
- **Graceful fallback to mock data on failure**, end-to-end, for real —
  the backend's real attempt to reach Yahoo failed with HTTP 403, and
  every endpoint (`/api/market/nifty`, `/api/market/nifty/candles`,
  `/api/market/indices`, `/api/engine/nifty`) correctly fell back to
  mock data and returned a valid `200` response instead of hanging or
  crashing, with `source`/`dataSource` correctly reporting
  `"mock-fallback"`.
- **No hangs** — the 8-second timeout (`AbortSignal.timeout`) meant the
  failed request returned in well under a second, not stuck waiting.

## The `source` field

Every response that goes through the provider layer carries a `source`
(market/engine responses use `dataSource`) field:

- `"yahoo-finance"` — real data, live fetch succeeded.
- `"mock-fallback"` — the live fetch failed for any reason (network
  error, timeout, HTTP error, unexpected response shape) and mock data
  was used instead.

**This app never silently presents mock data as real.** Check this field
before trusting a number, especially since Yahoo's response format is
unofficial and could change without notice.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `MARKET_DATA_PROVIDER` | `live` | `live` tries Yahoo first, falls back to mock. `mock` skips the live fetch entirely (useful offline or in CI). |

## Known limitations

- **Delayed, not real-time.** Yahoo's index pages show anywhere from
  real-time to ~15 minutes delayed depending on the index and time of
  day — treat it as indicative, not tick-accurate. Not suitable for
  anything beyond research/education, which matches this project's
  stated scope.
- **Unofficial and undocumented.** Yahoo doesn't publish a contract for
  this endpoint. It can change shape, rate-limit, or stop working
  without notice. The `source: "mock-fallback"` behavior exists
  specifically so that doesn't take the whole app down.
- **Legal/ToS**: this is the same category of caveat as the original
  NSE/BSE plan — unofficial scraping of a public endpoint not intended
  for third-party programmatic use. Fine for personal research and
  education (this project's stated scope); not something to build a
  commercial product on without a licensed data provider.
- **Candle history for the C++ engine now comes from the same provider
  layer** (`engine.service.js` uses `getProviderCandles`), so when live
  data is working, the engine's `analysis`/`signal` output is computed
  on real prices, not synthetic ones. When it falls back to mock, the
  engine still runs — just on synthetic data, clearly flagged via
  `dataSource`.

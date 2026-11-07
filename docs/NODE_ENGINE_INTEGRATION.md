# Node.js ↔ C++ Integration (Phase 7)

This documents how the Node.js backend actually calls the compiled C++
engine, per the contract in `docs/ENGINE_CONTRACT.md`.

## How it works

`backend/src/services/engine.service.js`:

1. Generates mock OHLCV candles (same generator the Market API uses) and
   converts them to the engine's CSV format (epoch-second timestamps).
2. Writes them to a temp file: `os.tmpdir()/engine-candles-<uuid>.csv`.
3. Spawns the compiled engine binary via `child_process.execFile` — args
   are passed as an array, not a shell string, so there's no shell
   injection risk even though the path is built dynamically.
4. Parses the engine's single-line JSON stdout.
5. Deletes the temp file in a `finally` block, whether the run succeeded
   or failed.

## Endpoint

```
GET /api/engine/:symbol?timeframe=5m&limit=250
```

- `:symbol` — `nifty` or `sensex`.
- `timeframe` — same options as the Market API (`1m`, `5m`, `15m`, `1h`, `1d`).
- `limit` — candle count; floored at 250 regardless of what's requested,
  since EMA200 needs that much data to be meaningful (see the note in
  `docs/ENGINE_CONTRACT.md`).

Response is the engine's own `analysis` and `signal` objects, plus a
little request context:

```json
{
  "symbol": "NIFTY 50",
  "timeframe": "5m",
  "candleCount": 250,
  "analysis": { "...": "..." },
  "signal": { "...": "..." }
}
```

This is intentionally a **separate endpoint** from `/api/signals`
(Phase 3's mock data) rather than a replacement — `/api/signals` stays as
a fixed, hand-written mock for reference/comparison, while `/api/engine`
is the real C++-computed output. A later phase can retire the mock
endpoint once the frontend fully switches over.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `ENGINE_BINARY_PATH` | `<project root>/engine/build/trading_engine` | Path to the compiled binary |
| `ENGINE_TIMEOUT_MS` | `5000` | Kill the engine process if it hasn't responded in this long |

Override `ENGINE_BINARY_PATH` if your build output lands somewhere else
(for example a multi-config CMake generator that nests a `Release/`
folder, or `trading_engine.exe` on Windows).

## Error handling

Three distinct failure modes, each mapped to a different HTTP status so
a caller (or the future React dashboard) can tell them apart:

| Situation | Status | Error class |
|---|---|---|
| Binary not found (not built yet) | `503` | `EngineUnavailableError` |
| Engine didn't respond within `ENGINE_TIMEOUT_MS` | `504` | `EngineTimeoutError` |
| Engine exited non-zero, or stdout wasn't valid JSON | `502` | `EngineExecutionError` |
| Unknown symbol | `404` | `NotFoundError` (existing) |
| Invalid timeframe | `400` | `BadRequestError` (existing) |

The `503` message includes the exact `cmake` build command, since "binary
not built yet" is the most common thing to hit when setting this project
up fresh.

## Verified behavior (not just written — actually tested)

- Real request against the compiled binary → real `analysis`/`signal` JSON.
- Binary temporarily removed → `503` with the build-it-yourself message.
- Binary swapped for a script that sleeps 10s → `504` after
  `ENGINE_TIMEOUT_MS` (tested at 1500ms, request returned in ~1.5s, not 10s).
- Temp CSV files are deleted after every request, success or failure —
  verified no files remain in `os.tmpdir()` after a batch of requests.

## What this does NOT do yet

- No caching — every request spawns a fresh process and generates fresh
  mock candles. Fine for research/demo traffic; would need attention
  before any real load (see Phase 10's Redis discussion).
- No live market data — candles are still the Phase 3 mock generator,
  not a real feed (Phase 8).
- The frontend dashboard doesn't call `/api/engine` yet — it still shows
  the Phase 3 mock `/api/signals` data. Wiring the dashboard to the real
  endpoint is part of finishing Phase 2's full UI.

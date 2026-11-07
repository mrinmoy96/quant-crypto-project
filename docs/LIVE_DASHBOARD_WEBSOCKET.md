# Live Dashboard + WebSocket (Phase 9)

## Architecture

```
Backend: single tick loop (every WS_TICK_INTERVAL_MS, default 15s)
  → getEngineSignal("nifty")   (provider fetch + C++ engine spawn)
  → getEngineSignal("sensex")  (provider fetch + C++ engine spawn)
  → broadcast one JSON message to every connected WebSocket client

Frontend: useLiveMarketData() hook
  → connects to ws://.../ws (derived from VITE_API_URL)
  → updates React state on each "tick" message
  → reconnects with exponential backoff if the connection drops
```

**The critical design decision**: there is exactly **one** server-side
tick loop, not one per connected client. A tick computes each
instrument's data once and broadcasts the same result to everyone. This
was deliberately verified (see "What was tested" below) — the risk with
a naive implementation is that N connected browser tabs would each spawn
their own polling loop, meaning N× as many C++ engine process spawns per
interval. That doesn't happen here.

## WebSocket endpoint

```
ws://localhost:5015/ws
```

Attached to the same HTTP server Express uses (`server.js` captures
`app.listen()`'s return value and passes it to
`attachLiveMarketFeed()`) — no separate port.

## Message format

```json
{
  "type": "tick",
  "timestamp": "2026-09-14T05:12:41.028Z",
  "instruments": {
    "nifty": {
      "symbol": "NIFTY 50",
      "dataSource": "mock-fallback",
      "analysis": { "price": 25200.0, "trend": "Bullish", "...": "..." },
      "signal": { "signal": "WAIT", "reason": "...", "...": "..." },
      "error": null
    },
    "sensex": { "...": "same shape" }
  }
}
```

If a single instrument's engine run fails (e.g. the C++ binary isn't
built), that instrument's entry gets `analysis: null, signal: null,
error: "<message>"` — **the other instrument's data still comes
through**. One instrument failing never blocks the whole tick.

A new connection immediately receives the most recently cached tick
(not a wait until the next interval), so the page isn't blank while
the first interval is still ticking down.

## Reconnection (frontend)

`useLiveMarketData` reconnects with exponential backoff (1s, 2s, 4s...
capped at 15s) if the socket closes for any reason. `connected` in the
hook's return value reflects live connection state, so the UI can show
a "Connecting…" state rather than silently going stale.

## Heartbeat (backend)

Every `WS_HEARTBEAT_INTERVAL_MS` (default 30s), the server pings every
connected client and terminates any that didn't respond to the previous
ping — this catches connections that disappeared without a clean close
(e.g. a laptop closing its lid) instead of leaking them into the
broadcast list forever.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `WS_TICK_INTERVAL_MS` | `15000` | How often to re-fetch + re-run the engine and broadcast |
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | Dead-connection detection interval |

15 seconds was chosen deliberately conservative — each tick spawns the
C++ engine process twice (once per instrument) and hits the market data
provider twice. A shorter interval trades server load for "liveness";
adjust via `WS_TICK_INTERVAL_MS` if needed.

## What was actually tested

- **Single client**: connected, received the cached tick immediately,
  then a second tick ~3s later (tested at `WS_TICK_INTERVAL_MS=3000`).
- **Two concurrent clients**: both received messages with **identical
  timestamps** on every tick — confirming they got the same broadcast,
  not separately computed data. Cross-checked against the server's log:
  exactly 2 fallback-log lines per tick (one per instrument), not 4 —
  confirming the tick runs once regardless of client count.
- **Per-instrument failure isolation**: exercised via the same fallback
  path proven in Phase 8 (Yahoo unreachable in this environment) — both
  instruments' `dataSource: "mock-fallback"` came through correctly in
  every tick rather than the whole tick failing.

All of the above was tested with a real Node.js `ws` client connecting
to the real running server — not a mock or a unit test in isolation.

## What could NOT be tested

- **No real browser was available in this environment**, so
  `useLiveMarketData`'s actual behavior inside a browser (React state
  updates causing re-renders, `WebSocket` API quirks across browsers,
  visible reconnect UI) was not visually confirmed — only reasoned about
  from the WebSocket protocol being standard and the message shape
  matching exactly what the backend really sends (verified above).
  **Open the dashboard in an actual browser and confirm the connection
  indicator, live price updates, and signal cards render as expected.**
- The reconnect backoff logic (exponential delay, capped) was written
  and reviewed but not driven through an actual dropped-connection
  scenario end-to-end in a browser.

# Project Phases

This project is being built incrementally. Each phase must be completed and
verified before moving to the next one.

1. **Project Foundation** — Repo structure, React/Vite shell, Express shell,
   C++17 + CMake shell, base docs. ✅ Complete
2. **React Dashboard** — Real dashboard UI: watchlist, candle charts, signal
   panel, layout/routing. 🔶 Partially done — the app now fetches live
   indices/signals from the Node.js API, but the full dashboard (charts,
   watchlist, layout) is still pending.
3. **Node.js Backend / API** — REST API design (market + signal endpoints),
   request validation, centralized error handling, CORS, config management.
   ✅ Complete (mock data only — no live provider yet)
4. **C++ Quantitative Engine** — Core engine scaffolding: candle ingestion,
   internal data pipeline, engine ↔ CLI I/O contract. ✅ Complete — see
   `docs/ENGINE_CONTRACT.md`. `CandleFeed` loads real CSV candles or
   generates deterministic sample data; the engine prints exactly one
   JSON line to stdout (the future Node.js integration point). Still no
   real strategy logic — `Strategy::evaluate()` remains a WAIT-only stub.
5. **Indicators & Market Structure** — Moving averages, RSI, volume
   profile, support/resistance, trend/structure detection. ✅ Complete —
   `Indicators` (EMA 20/50/200, RSI(14), ATR(14), session VWAP) and
   `MarketStructure` (swing high/low detection, Higher-High/Higher-Low
   vs. Lower-High/Lower-Low classification, volume state, trend, nearest
   support/resistance) are combined into one `AnalysisResult` per run,
   included in the engine's JSON output under `"analysis"`. Still makes
   no trading decision — `Strategy::evaluate()` remains WAIT-only.
6. **Entry / Stop-Loss / Target Engine** — Rule-based entry conditions,
   stop-loss and target calculation, risk parameters (research only).
   ✅ Complete — see `docs/STRATEGY_RULES.md` for the exact rules.
   `Strategy::evaluate()` now reads `AnalysisResult` and returns a real
   BUY/SELL/WAIT decision with Entry/SL/Target1/Target2/R:R for BUY/SELL,
   or a specific unmet-condition reason for WAIT. Rule-based and
   transparent — not yet backtested (Phase 11) and not a guarantee of
   profit.
7. **Node.js ↔ C++ Integration** — ✅ Complete — see
   `docs/NODE_ENGINE_INTEGRATION.md`. `backend/src/services/engine.service.js`
   writes mock candles to a temp CSV, spawns the compiled `trading_engine`
   binary via `execFile`, parses its JSON stdout, and returns it from
   `GET /api/engine/:symbol`. Distinct error handling for binary-not-built
   (503), timeout (504), and bad exit/output (502) — all three verified
   by actually breaking the binary and confirming the right status came
   back, not just written and assumed to work.
8. **Real NIFTY 50 + SENSEX Market Data** — ✅ Complete — see
   `docs/MARKET_DATA_SOURCE.md` for the full reasoning, endpoint details,
   and — importantly — what could and couldn't actually be tested from
   this environment (the live Yahoo Finance call itself could not be
   executed successfully here; parsing/fallback logic was verified
   against local fixtures and a real, confirmed-working fallback path).
   A `MarketDataProvider` abstraction (`backend/src/providers/`) now
   sits in front of both the Market API and the C++ engine integration,
   trying Yahoo Finance first and falling back to Phase 3's mock
   generator on any failure — every response is tagged `source`/
   `dataSource` so mock data is never silently presented as real.
9. **Live Dashboard + Directional C++ Risk Engine + WebSocket** — ✅ Complete — see
   `docs/LIVE_DASHBOARD_WEBSOCKET.md`. The upgraded C++ engine now scores bullish/bearish setups and returns candidate Entry/SL/TP plans for both directions. A single server-side tick loop
   (`backend/src/ws/liveMarketFeed.js`, default every 15s) runs the
   engine once per instrument and broadcasts to every connected
   WebSocket client — verified with real concurrent Node.js WS clients
   to confirm one tick serves all clients rather than spawning the
   engine per connection. The React dashboard (`useLiveMarketData` hook)
   connects, shows a live connection indicator, and reconnects with
   backoff on disconnect. **Not verified in an actual browser** — see
   the doc's "What could NOT be tested" section.
10. **PostgreSQL + Signal History** — Persist candles, signals, and
    engine runs; migrations and query layer.
11. **Backtesting + Paper Trading** — Historical strategy evaluation and
    simulated (non-real-money) trade tracking.
12. **Alerts + Production Deployment** — Notifications, monitoring,
    deployment pipeline, hardening.

## Notes

- This is a research and educational trading-signal application.
- No real-money order execution or broker connectivity is implemented at
  any phase unless explicitly revisited and re-scoped later.
- No signal produced by this system should be read as a guarantee of
  profitability.

## Phase 10 — PostgreSQL + history

Phase 10 adds PostgreSQL persistence for C++ engine evaluations, bullish/bearish candidate plans, paper trades, signal events and basic P&L analytics. Live broker execution remains out of scope.

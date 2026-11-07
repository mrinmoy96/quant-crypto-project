# Project Summary — NIFTY 50 + SENSEX Trading Signal System

## What this is

A research/educational trading-signal application for NIFTY 50 and
SENSEX. It analyzes market data and produces BUY/SELL/WAIT signals with
Entry/Stop-Loss/Target levels using transparent, rule-based logic.

**What it explicitly does NOT do**: place real trades, connect to a
broker, or guarantee profit. No signal it produces should be treated as
financial advice.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (JavaScript) |
| Backend | Node.js + Express |
| Quant engine | C++17 + CMake |
| Live updates | WebSocket (`ws` package) |
| Market data | Yahoo Finance (unofficial), mock fallback |
| Database | PostgreSQL (planned, not yet wired up — Phase 10) |

## Architecture

```
Yahoo Finance (real, unofficial)  ─┐
                                    ├─► MarketDataProvider ─► Node.js API ─► React
Mock generator (fallback)         ─┘         │                   │           │
                                              │                   │      WebSocket
                                              ▼                   │      (live push)
                                     temp CSV file                │           │
                                              │                   │           ▼
                                              ▼                   │      useLiveMarketData
                                     C++ engine (spawned)          │           hook
                                     Indicators → Structure         │
                                     → Strategy → Signal            │
                                              │                     │
                                              └────── JSON ─────────┘
                                              (analysis + signal)
```

## Phase-by-phase status

| # | Phase | Status | Key doc |
|---|---|---|---|
| 1 | Project Foundation | ✅ Complete | — |
| 2 | React Dashboard | 🔶 Partial — live data wired in, full UI (charts/watchlist) still pending | — |
| 3 | Node.js Backend/API | ✅ Complete | — |
| 4 | C++ Quantitative Engine (scaffolding) | ✅ Complete | `docs/ENGINE_CONTRACT.md` |
| 5 | Indicators & Market Structure | ✅ Complete | `docs/ENGINE_CONTRACT.md` |
| 6 | Entry/Stop-Loss/Target Engine | ✅ Complete | `docs/STRATEGY_RULES.md` |
| 7 | Node.js ↔ C++ Integration | ✅ Complete | `docs/NODE_ENGINE_INTEGRATION.md` |
| 8 | Real NIFTY 50 + SENSEX Market Data | ✅ Complete (with caveats) | `docs/MARKET_DATA_SOURCE.md` |
| 9 | Live Dashboard + WebSocket | ✅ Complete (with caveats) | `docs/LIVE_DASHBOARD_WEBSOCKET.md` |
| 10 | PostgreSQL + Signal History | ⬜ Not started | — |
| 11 | Backtesting + Paper Trading | ⬜ Not started | — |
| 12 | Alerts + Production Deployment | ⬜ Not started | — |

### Phase 1 — Project Foundation
React+Vite frontend shell, Express backend shell, C++17+CMake engine
shell, `.gitignore`, base docs, `docker-compose.yml`.

### Phase 3 — Node.js Backend/API
Layered architecture: `routes → controllers → services → data`. Market
API (`/api/market/*`) and a mock Signal API (`/api/signals/*`), CORS,
centralized error handling, `/api/health`.

### Phase 4 — C++ Engine Scaffolding
`Candle`, `Signal`, `Strategy` data structures. `CandleFeed` loads real
CSV candles or generates deterministic sample data. Engine's stdout is
exactly one line of JSON — the contract the Node.js integration (Phase
7) later relies on.

### Phase 5 — Indicators & Market Structure
`Indicators`: EMA(20/50/200), RSI(14), ATR(14), session VWAP.
`MarketStructure`: swing high/low detection, Higher-High/Higher-Low vs.
Lower-High/Lower-Low classification, volume state, trend, nearest
support/resistance. Combined into one `AnalysisResult` per run — no
trading decision yet.

### Phase 6 — Entry/Stop-Loss/Target Engine
`Strategy::evaluate()` turns `AnalysisResult` into a real BUY/SELL/WAIT
decision:
- **BUY**: Bullish trend + Higher-High/Higher-Low + High/Spike volume +
  price above VWAP + RSI 40–75
- **SELL**: the mirror image
- **Stop-loss**: the *wider* (more conservative) of a structure-based
  level and 1.5× ATR
- **Targets**: 1:2 / 1:3 risk-reward, capped by the next
  resistance/support if closer

Rule-based and transparent, **not backtested**. WAIT signals name the
specific unmet condition(s).

### Phase 7 — Node.js ↔ C++ Integration
`engine.service.js` writes candles to a temp CSV, spawns the compiled
binary via `execFile`, parses its JSON stdout. `GET /api/engine/:symbol`
returns the real result. Three distinct, tested failure modes: binary
not built (503), timeout (504), bad exit/output (502).

### Phase 8 — Real Market Data
Pivoted from NSE/BSE's unofficial APIs (too fragile — NSE needs a
two-session cookie dance) to **Yahoo Finance's public chart endpoint**
(`^NSEI`, `^BSESN` — no auth needed, returns real intraday candles
directly). A `MarketDataProvider` abstraction
(`backend/src/providers/`) tries Yahoo first, falls back to mock data on
any failure, and tags every response with `source`/`dataSource`.

**Honesty note**: the live Yahoo call was never successfully executed
from the environment that built this (network-restricted sandbox; got
HTTP 403 on the real attempt). The response shape is corroborated by
multiple independent sources, and the parsing/fallback logic is verified
by 10 passing tests against a local fixture server — but you should
confirm `"source": "yahoo-finance"` (not `"mock-fallback"`) yourself in
an environment with normal internet access.

### Phase 9 — Live Dashboard + WebSocket
A single server-side tick loop (`backend/src/ws/liveMarketFeed.js`,
default every 15s) runs the engine once per instrument and **broadcasts**
to every connected client — verified with real concurrent WebSocket
clients to confirm one tick serves all clients (not one engine spawn per
client). React's `useLiveMarketData` hook connects, shows a live
indicator, and reconnects with exponential backoff.

**Honesty note**: not verified in an actual browser (none available in
the build environment) — the WebSocket protocol itself was tested for
real with a Node.js client, but visual rendering/reconnect-in-browser
behavior wasn't seen firsthand.

## What's NOT built yet

- **PostgreSQL persistence** (Phase 10) — no signal history is stored;
  everything is computed fresh per request/tick
- **Backtesting** (Phase 11) — the Phase 6 strategy rules have never
  been run against historical data to check if they'd actually have
  worked
- **Full React dashboard** (Phase 2 completion) — charts, a real
  watchlist, layout/routing are still pending; the current UI is
  functional but minimal
- **Alerts / production deployment** (Phase 12)
- **Broker integration, real-money execution** — explicitly out of
  scope for this entire project

## Testing summary

| Component | Tests | Status |
|---|---|---|
| C++ engine | 24 dependency-free tests (`engine/tests/engine_tests.cpp`) | All passing |
| Backend providers | 10 fixture-server tests (`backend/test/providers.test.js`) | All passing |
| Full-stack integration | Manual end-to-end verification at every phase (fresh installs, real process spawns, real WebSocket clients) | Verified, not automated |

## How to run everything

```bash
# 1. C++ engine
cd engine && mkdir -p build && cd build && cmake .. && cmake --build .

# 2. Backend
cd backend && npm install && cp .env.example .env && npm run dev

# 3. Frontend
cd frontend && npm install && cp .env.example .env && npm run dev
```

Then open the frontend dev URL (typically http://localhost:5173).

## Key honesty threads running through this project

1. **No signal is a guarantee of profit** — stated at Phase 1 and
   repeated at every phase since.
2. **The strategy is rule-based, not backtested.** It's designed to be
   transparent (every condition is a named `if`, not a black box), but
   "transparent" isn't the same as "validated."
3. **Market data is from an unofficial source** and can be delayed,
   rate-limited, or break without notice — that's why the mock-fallback
   layer exists, and why every response is tagged with its `source`.
4. **Several things were built and documented as "could not be tested
   from this environment"** rather than silently assumed to work —
   Phase 8's live Yahoo call and Phase 9's browser-side WebSocket
   behavior, specifically. Both are called out explicitly in their
   respective docs with exactly what to check yourself.


# Phase 11 — Backtesting + Paper Trading

## Added
- Historical replay backtest runner using the same compiled C++ engine.
- Chronological prefix-only engine evaluation to avoid look-ahead bias.
- Next-candle-open entry simulation.
- Conservative same-candle SL-before-target handling.
- Risk-based position sizing.
- Configurable slippage and fixed fee assumptions.
- PostgreSQL `backtest_runs` and `backtest_trades` persistence.
- PostgreSQL `paper_trades` and `paper_trade_events` persistence.
- Paper-trade creation from the current C++ signal.
- Optional live paper-position monitoring from the existing WebSocket feed.
- React Backtesting and Paper Trading panels.
- Demo synthetic 600-candle dataset for pipeline testing.
- Phase 11 runbook and documentation.

## Important
The included demo dataset is synthetic. It is not historical exchange data and should not be used to make performance claims.
Phase 11 does not place real broker orders.

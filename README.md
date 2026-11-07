# NIFTY 50 + SENSEX Trading Signal System

Phase 11: Live Dashboard + Directional C++ Risk Engine + PostgreSQL History + Backtesting + Paper Trading

This project is a research and educational NIFTY 50 / SENSEX trading-signal
application. It does not execute real-money trades, does not connect to a
broker, and does not use live market data. No signal it produces is a
guarantee of profitability.

## Planned architecture

Market Data Provider
        ↓
Node.js Data Collector
        ↓
C++ Quant Engine
        ↓
Signal
        ↓
Node.js API/WebSocket
        ↓
React Dashboard
        ↓
PostgreSQL

## Phase 8 status

Implemented:
- React + Vite frontend (Phase 1)
- Node.js + Express backend: routes → controllers → services → mock data
  (Phase 3), Market API, mock Signal API, CORS, error handling
- React dashboard fetching live data from the Node.js API (Phase 3)
- C++ engine: candle ingestion + I/O contract, indicators & market
  structure, score-based bullish/bearish signal selection, candidate
  Entry/SL/Target plans for both directions, and real Node.js ↔ C++
  integration
- **Real market data via Yahoo Finance (Phase 8)** — see
  `docs/MARKET_DATA_SOURCE.md`:
  - `backend/src/providers/` — a `MarketDataProvider` abstraction with
    `YahooFinanceProvider` (real) and `MockProvider` (Phase 3's
    generator), both behind the same `getQuote`/`getCandles` interface
  - Automatic fallback to mock data on ANY failure (network error,
    timeout, HTTP error, bad shape) — verified for real: this sandbox's
    own attempt to reach Yahoo failed (HTTP 403) and every endpoint
    fell back correctly instead of crashing
  - Every response tagged `source`/`dataSource`: `"yahoo-finance"` or
    `"mock-fallback"` — never silently presents mock data as real
  - The C++ engine integration now also runs on real candle data when
    available (`engine.service.js` uses the same provider layer)
  - **Important**: the actual live Yahoo call could not be executed
    successfully from the environment that built this — see
    `docs/MARKET_DATA_SOURCE.md` for exactly what was and wasn't
    verified, and test this yourself with real internet access before
    relying on it

Not implemented yet:
- Open-position exit/trailing-stop monitoring
- Futures contract selection / execution layer
- Options-chain selector (strike/expiry/Greeks/liquidity)
- Backtesting / validation of the strategy rules (Phase 11)
- Broker integration / real-money execution
- PostgreSQL persistence (Phase 10)
- **Backtesting + paper trading (Phase 11)** — backtest runner, PostgreSQL backtest history, optional live paper-position monitoring
- Broker integration, automatic real trading, AI/ML, authentication

**Important**: the Phase 6 strategy is rule-based and transparent, but it
is NOT backtested or validated. Market data is delayed and from an
unofficial source. No signal this project produces is a guarantee of
profitability.

## Requirements

- Node.js 18+ recommended
- npm
- Git
- CMake 3.16+
- A C++17-compatible compiler
- PostgreSQL (optional for Phase 1; no database connection is required yet)

Docker is optional and is not required for local development.

## Run backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Run the Phase 8 provider tests (local fixture server, no real network needed):

```bash
npm test
```

Backend health check:

http://localhost:5015/api/health

### API endpoints

```text
GET /api/health
GET /api/market/indices
GET /api/market/:symbol              (symbol: nifty | sensex)
GET /api/market/:symbol/candles?timeframe=5m&limit=50
GET /api/signals                     (mock signals — Phase 3, kept as a fixed reference)
GET /api/signals/:symbol             (mock signal — Phase 3)
GET /api/engine/:symbol?timeframe=5m&limit=250   (REAL C++ engine output — Phase 7/8)
```

Timeframes supported: `1m`, `5m`, `15m`, `1h`, `1d`.

**Phase 8**: `/api/market/*` and `/api/engine/*` now try real Yahoo
Finance data first (`source`/`dataSource: "yahoo-finance"`), falling
back to mock data (`"mock-fallback"`) on any failure — see
`docs/MARKET_DATA_SOURCE.md`. Set `MARKET_DATA_PROVIDER=mock` to skip
the live fetch entirely.

`/api/engine/:symbol` requires the C++ engine to be built first (see
"Run C++ engine" below) — it spawns `engine/build/trading_engine` as a
child process. If it isn't built yet, the endpoint returns `503` with
the exact build command to run.

All market and signal data above is generated mock data. No live provider
or broker is connected in Phase 3.

## Run frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default Vite URL: http://localhost:5173

The frontend reads `VITE_API_URL` (defaults to `http://localhost:5015`) and
fetches indices + signals from the backend above — start the backend first.

## Build C++ engine

```bash
cd engine
mkdir -p build
cd build
cmake ..
cmake --build .

# Demo mode (250 generated sample candles - enough for EMA200):
./trading_engine

# With real CSV candle data:
./trading_engine ../../data/sample_nifty_candles.csv

# Run the test suite (24 tests, if built):
./engine_tests
```

Expected stdout (exactly one JSON line — see `docs/ENGINE_CONTRACT.md` and
`docs/STRATEGY_RULES.md`):

```json
{"analysis":{"price":25200.00,"ema20":25190.00,"ema50":25150.00,"ema200":25050.00,"rsi":58.00,"atr":20.00,"vwap":25150.00,"priceVsVwap":"Above","trend":"Bullish","volume":"High","structure":"Higher High / Higher Low","support":25150.00,"resistance":25400.00},"signal":{"timestamp":1700000000,"signal":"BUY","entry":25200.00,"stopLoss":25150.00,"target1":25300.00,"target2":25350.00,"riskReward":"1:2.00","reason":null}}
```

(Startup/status messages like `NIFTY/SENSEX C++ Engine — Phase 6` are
printed to stderr, not stdout — this keeps stdout parseable as pure JSON.)

## Project structure

```text
trading-signal-system/
├── frontend/
│   └── src/
│       ├── services/api.js      (fetch wrapper for the backend)
│       ├── App.jsx
│       └── styles.css
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/env.js
│   │   ├── routes/               (health, market, signal, engine)
│   │   ├── controllers/          (market, signal, engine)
│   │   ├── services/             (market, signal, engine)
│   │   ├── providers/            (YahooFinanceProvider, MockProvider — Phase 8)
│   │   ├── data/mockMarketData.js
│   │   ├── middleware/errorHandler.js
│   │   └── utils/errors.js
│   └── test/providers.test.js    (Phase 8 fixture-server tests)
├── engine/
│   ├── include/         Candle.h, Signal.h, Strategy.h, CandleFeed.h,
│   │                    Indicators.h, MarketStructure.h, Analysis.h
│   ├── src/             main.cpp, Strategy.cpp, CandleFeed.cpp,
│   │                    Indicators.cpp, MarketStructure.cpp, Analysis.cpp
│   ├── tests/           engine_tests.cpp (24 tests)
│   └── CMakeLists.txt
├── data/
│   └── sample_nifty_candles.csv
├── database/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PHASES.md
│   ├── ENGINE_CONTRACT.md          (C++ engine stdin/stdout I/O contract)
│   ├── STRATEGY_RULES.md           (Phase 6 Entry/SL/Target rules)
│   ├── NODE_ENGINE_INTEGRATION.md  (Phase 7 Node.js <-> C++ wiring)
│   ├── MARKET_DATA_SOURCE.md       (Phase 8 Yahoo Finance integration)
│   └── LIVE_DASHBOARD_WEBSOCKET.md (Phase 9 live WebSocket feed)
├── .gitignore
├── README.md
└── docker-compose.yml
```

## Phase 11

Backtesting and paper trading are now implemented. See `RUN_PHASE11.md` and `docs/PHASE11_BACKTESTING_PAPER_TRADING.md`.

The included `data/demo_backtest_nifty_5m.csv` is synthetic and exists only to verify the software pipeline. Replace it with validated historical data before doing any research conclusions.

New APIs:

```text
POST /api/backtest/run
GET  /api/backtest/runs
GET  /api/backtest/runs/:id
GET  /api/paper-trades
POST /api/paper-trades
POST /api/paper-trades/from-signal/:symbol
POST /api/paper-trades/:id/close
```

`PAPER_TRADING_ENABLED` defaults to `false`. No broker order is ever sent by Phase 11.

## Future phases

1. Project foundation ✅
2. React dashboard (in progress — live data wired in, full UI later)
3. Node.js API ✅
4. C++ quantitative engine ✅ (scaffolding — see docs/ENGINE_CONTRACT.md)
5. Indicators & market structure ✅ (EMA/RSI/ATR/VWAP + structure/trend/volume)
6. Entry / Stop-Loss / Target engine ✅ (rule-based — see docs/STRATEGY_RULES.md)
7. Node.js ↔ C++ integration ✅ (see docs/NODE_ENGINE_INTEGRATION.md)
8. Real NIFTY 50 / SENSEX market data ✅ (see docs/MARKET_DATA_SOURCE.md)
9. Live dashboard + WebSocket ✅ (see docs/LIVE_DASHBOARD_WEBSOCKET.md)
10. PostgreSQL signal/trade history
11. Backtesting + paper trading ✅
12. Alerts + production deployment

This project is an analytical software project. Trading signals are not guarantees of profit.


## Phase 10 — PostgreSQL + History

Phase 10 adds persistent PostgreSQL storage for engine signals, bullish/bearish candidate plans, paper trades, signal events and basic P&L analytics. See `docs/PHASE10_POSTGRESQL.md`.

Backend history endpoints: `/api/history/signals`, `/api/history/plans`, `/api/history/trades`, `/api/history/analytics`. Paper-trade endpoints: `POST /api/trades` and `POST /api/trades/:id/close`.


## Phase 11A multi-horizon forecast

The C++ engine and React dashboard now expose research forecasts for the next **5m / 15m / 30m / 1h**, anchored to an exact timestamp and expiry window. The live dashboard shows the start/end time, Bull/Bear scores, strength, and a countdown. These are directional research forecasts, not guaranteed outcomes or probabilities.

API: `GET /api/forecasts/:symbol` (uses 5m candles) and `GET /api/forecasts/history`.

# RUN PHASE 11 (Mac)

Phase 11 = Phase 10 + Backtesting + Paper Trading.

## 1. Install dependencies

From project root:

```bash
npm install
```

The backend now requires the PostgreSQL `pg` package.

## 2. Configure PostgreSQL

Copy:

```bash
cp backend/.env.example backend/.env
```

Set your PostgreSQL URL:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trading_system
```

Phase 11 paper trading is disabled by default:

```env
PAPER_TRADING_ENABLED=false
```

Enable only when you intentionally want virtual positions monitored by the live feed:

```env
PAPER_TRADING_ENABLED=true
```

## 3. Build C++

```bash
cmake -S engine -B engine/build
cmake --build engine/build
./engine/build/engine_tests
```

Expected:

```text
All tests passed
```

## 4. Run all migrations

```bash
npm run db:migrate --workspace backend
```

New Phase 11 tables:

```text
backtest_runs
backtest_trades
paper_trades
paper_trade_events
```

## 5. Start backend + frontend

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:frontend
```

Open:

http://localhost:5173

## 6. Run a backtest

The dashboard uses:

```text
data/demo_backtest_nifty_5m.csv
```

This is a deterministic synthetic dataset for testing the software pipeline. It is NOT real historical market data.

Backtest API:

```bash
curl -X POST http://localhost:5015/api/backtest/run   -H 'Content-Type: application/json'   -d '{
    "symbol":"NIFTY",
    "timeframe":"5m",
    "initialCapital":100000,
    "riskPerTrade":0.01,
    "slippageBps":1,
    "feePerTrade":20
  }'
```

The runner feeds the C++ engine only the historical prefix available at each decision candle, then evaluates the next/future candles for SL/target exits. It never passes future candles to the engine.

## 7. Paper trading

Enable it:

```env
PAPER_TRADING_ENABLED=true
```

Restart backend.

From an actionable signal card, click:

```text
OPEN PAPER TRADE
```

Or use:

```bash
curl -X POST http://localhost:5015/api/paper-trades/from-signal/nifty   -H 'Content-Type: application/json'   -d '{"timeframe":"5m"}'
```

The live WebSocket loop monitors open paper trades against the latest dashboard prices and closes them on:

```text
STOP_LOSS
TARGET_1
TARGET_2
```

No broker API is called.

## Important backtesting rules

- Historical data is processed in chronological order.
- The C++ engine sees only the candles available at the decision time.
- Entry is simulated on the next candle open.
- If SL and target are both touched within the same candle, the simulator assumes the stop happened first (conservative assumption).
- Slippage and a fixed per-trade fee can be configured.
- Quantity is risk-based using current simulated capital and `riskPerTrade`.
- F&O contract lot sizes, option premiums/Greeks, brokerage/taxes and market impact are NOT modeled yet.

## APIs

```text
POST /api/backtest/run
GET  /api/backtest/runs
GET  /api/backtest/runs/:id

GET  /api/paper-trades
POST /api/paper-trades
POST /api/paper-trades/from-signal/:symbol
POST /api/paper-trades/:id/close
```

This phase is still research/paper-trading software. Backtest results depend on the dataset and assumptions and do not establish future profitability.


## Phase 11A forecast smoke test

After building the C++ engine and starting the backend, open:

```text
GET /api/forecasts/nifty
```

You should receive four forecast windows (5, 15, 30, 60 minutes) when at least 20 five-minute candles are available. The response includes exact `startTimestamp` and `endTimestamp` fields.

The WebSocket `/ws` tick payload also includes `signal.forecasts`, so the React dashboard updates the countdown with the same server-side signal snapshot.

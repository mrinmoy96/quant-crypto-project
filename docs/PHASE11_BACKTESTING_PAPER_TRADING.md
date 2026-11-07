# Phase 11 — Backtesting + Paper Trading

## Goal

Phase 11 adds two independent validation layers on top of the Phase 9 C++ engine and Phase 10 PostgreSQL history.

### Backtesting

```text
Historical candles
      ↓
Prefix up to decision candle
      ↓
C++ Phase 9 engine
      ↓
BUY / SELL + plan
      ↓
Next candle entry simulation
      ↓
Future candle SL / TP evaluation
      ↓
P&L / drawdown / R-multiple
      ↓
PostgreSQL backtest_runs + backtest_trades
```

The engine never receives future candles while generating a signal. This is designed to prevent look-ahead bias.

### Paper Trading

```text
Live C++ signal
      ↓
Virtual trade
      ↓
PostgreSQL paper_trades
      ↓
Live WebSocket price updates
      ↓
SL / TP monitoring
      ↓
Virtual close
      ↓
paper_trade_events
```

Paper trading is disabled by default and must be explicitly enabled with `PAPER_TRADING_ENABLED=true`.

## Tables

### backtest_runs
Stores one test run and aggregate statistics.

### backtest_trades
Stores each simulated trade.

### paper_trades
Stores open/closed virtual positions.

### paper_trade_events
Stores open/close/SL/target audit events.

## Limitations

The Phase 11 implementation intentionally does not claim to model real derivatives trading. In particular, it does not yet model:

- options chain selection,
- historical option premiums,
- implied volatility,
- Greeks,
- expiry,
- futures/options contract lot-size rules,
- broker-specific charges,
- exchange/order-book microstructure,
- partial fills,
- real order latency.

The included demo backtest dataset is synthetic and is only for verifying that the software pipeline works.


## Phase 11A — Multi-Horizon Market Forecast

The live C++ engine now also emits four fixed-horizon directional research forecasts: **5 minutes, 15 minutes, 30 minutes, and 60 minutes**. Each forecast contains:

- `startTimestamp` — the exact candle timestamp used as the forecast anchor.
- `endTimestamp` — the exact end of the forecast window.
- `direction` — `BULLISH`, `BEARISH`, or `NEUTRAL`.
- `bullishScore` / `bearishScore` — directional scores from 0-100.
- `strength` — a signal-strength value, not a probability.
- `basis` — a short explanation of the current-score + momentum calculation.

The Node.js forecast endpoint deliberately uses **5-minute candles** as the base resolution so that a 5-minute horizon is not derived from a coarser bar.

### Exact time example

If the latest completed 5-minute candle is timestamped **11:00:00**, the UI displays:

```text
Next 5 min   11:00 → 11:05
Next 15 min  11:00 → 11:15
Next 30 min  11:00 → 11:30
Next 1 hour  11:00 → 12:00
```

Each card also shows a live countdown and becomes **EXPIRED** after `endTimestamp`.

### Calculation note

This first implementation is a deterministic research heuristic, not a trained predictive model. It combines the existing Phase 9 bullish/bearish directional score with normalized recent-price momentum over a horizon-specific lookback. The weighting changes by horizon: shorter horizons rely more on recent momentum, while longer horizons lean more on the current directional score.

For a production-quality forecasting system, Phase 11 should later add a historical walk-forward evaluation table and calibrate the horizon thresholds using out-of-sample data.

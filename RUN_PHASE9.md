# Phase 9 Upgrade — Run Guide

This upgrade changes the C++ strategy from an all-or-nothing five-filter
rule into a directional scoring engine with risk plans for both bullish and
bearish directions.

## 1. Build C++

```bash
cd engine
cmake -S . -B build
cmake --build build
./build/engine_tests
```

Expected final line:

```text
All tests passed
```

## 2. Start backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The default engine path is:

```text
engine/build/trading_engine
```

## 3. Start frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://localhost:5173
```

## 4. What the upgraded dashboard shows

Each instrument now exposes:

- Bullish score / 100
- Bearish score / 100
- Confidence score
- Active BUY/SELL Entry, Stop Loss, TP1 and TP2 when qualified
- Bullish candidate plan
- Bearish candidate plan
- Risk:Reward
- Data source

`CANDIDATE` plans are informational. They do not mean that a position is
open. `TP1` and `TP2` are planned exit levels; open-position exit monitoring
comes later.

## 5. Important

Yahoo Finance is an unofficial data source and can fail or be delayed. The
application explicitly labels fallback data as `mock-fallback`.

This project does not place real-money orders. Before any future broker
integration, add backtesting, slippage/fees, walk-forward validation and
paper trading.

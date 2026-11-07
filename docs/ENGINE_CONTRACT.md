# Engine I/O Contract (Phase 9)

This documents how anything (a shell, Node.js in Phase 7, a test script)
should invoke the C++ engine and interpret its output. Establishing this
in Phase 4 — before Phase 7 wires it up for real — is the point of this
contract; Phase 5 added indicator/structure analysis, and Phase 6 added
the actual Entry/Stop-Loss/Target decision (see `docs/STRATEGY_RULES.md`
for exactly how that decision is made).

## Invocation

```bash
./trading_engine [path/to/candles.csv]
```

- If a CSV path is given, the engine loads candles from it.
- If no path is given, the engine generates 250 deterministic sample
  candles internally (250, not 30, so EMA200 has enough data to be
  meaningful in demo mode). Never used as a stand-in for real market
  data in later phases.

## Input format (CSV)

```text
timestamp,open,high,low,close,volume
1700000000,25180.00,25195.50,25172.30,25190.10,112340
...
```

- `timestamp` is a Unix epoch integer (seconds).
- A header row is optional — the parser skips a first row whose first
  field isn't numeric.
- Malformed rows (fewer than 6 fields) are skipped, not fatal.
- A sample file lives at `data/sample_nifty_candles.csv` (only 5 rows —
  enough to exercise the CSV path, but too short for RSI/ATR/EMA200 to
  be meaningful; use demo mode or a longer file to see real indicator
  values).
- **Note**: EMA20/50/200 are seeded from a simple average of whatever
  data is available. If you supply fewer than 200 candles, EMA50 and
  EMA200 can come out identical (both seeded the same way), which makes
  `trend` read `"Sideways"` even in an otherwise clear move. Use at
  least ~200 candles for a meaningful trend read.

## Output format (stdout)

The engine writes exactly one line of JSON to stdout and nothing else:

```json
{
  "analysis": {
    "price": 25200.00,
    "ema20": 25190.00,
    "ema50": 25150.00,
    "ema200": 25050.00,
    "rsi": 58.00,
    "atr": 20.00,
    "vwap": 25150.00,
    "priceVsVwap": "Above",
    "trend": "Bullish",
    "volume": "High",
    "structure": "Higher High / Higher Low",
    "support": 25150.00,
    "resistance": 25400.00
  },
  "signal": {
    "timestamp": 1700000000,
    "signal": "BUY",
    "setup": "STRONG",
    "bullishScore": 100.00,
    "bearishScore": 15.00,
    "confidence": 100.00,
    "entry": 25200.00,
    "stopLoss": 25150.00,
    "target1": 25300.00,
    "target2": 25350.00,
    "riskReward": "1:2.00",
    "plans": {
      "bullish": {
        "entry": 25200.00,
        "stopLoss": 25150.00,
        "target1": 25300.00,
        "target2": 25350.00,
        "riskReward": "1:2.00"
      },
      "bearish": {
        "entry": 25200.00,
        "stopLoss": 25230.00,
        "target1": 25140.00,
        "target2": 25110.00,
        "riskReward": "1:2.00"
      }
    },
    "forecasts": [
      {
        "horizonMinutes": 5,
        "startTimestamp": 1700000000,
        "endTimestamp": 1700000300,
        "direction": "BULLISH",
        "bullishScore": 63.95,
        "bearishScore": 36.05,
        "strength": 62.55,
        "basis": "Current directional score + 1-bar momentum (return 0.05%)."
      },
      {
        "horizonMinutes": 15,
        "startTimestamp": 1700000000,
        "endTimestamp": 1700000900,
        "direction": "BULLISH",
        "bullishScore": 62.21,
        "bearishScore": 37.79,
        "strength": 60.99,
        "basis": "Current directional score + 3-bar momentum (return 0.08%)."
      },
      {
        "horizonMinutes": 30,
        "startTimestamp": 1700000000,
        "endTimestamp": 1700001800,
        "direction": "NEUTRAL",
        "bullishScore": 53.64,
        "bearishScore": 46.36,
        "strength": 53.27,
        "basis": "Current directional score + 6-bar momentum (return 0.10%)."
      },
      {
        "horizonMinutes": 60,
        "startTimestamp": 1700000000,
        "endTimestamp": 1700003600,
        "direction": "NEUTRAL",
        "bullishScore": 55.21,
        "bearishScore": 44.79,
        "strength": 54.69,
        "basis": "Current directional score + 12-bar momentum (return 0.16%)."
      }
    ],
    "reason": "Bullish setup qualified: 5/5 conditions passed."
  }
}
```

For a non-qualified snapshot, the main levels are null, but both candidate
plans may still be present:

```json
{
  "signal": {
    "signal": "WAIT",
    "setup": "WATCH",
    "bullishScore": 60.00,
    "bearishScore": 40.00,
    "confidence": 60.00,
    "entry": null,
    "stopLoss": null,
    "target1": null,
    "target2": null,
    "riskReward": null,
    "plans": {
      "bullish": { "entry": 25200.00, "stopLoss": 25150.00, "target1": 25300.00, "target2": 25350.00, "riskReward": "1:2.00" },
      "bearish": { "entry": 25200.00, "stopLoss": 25250.00, "target1": 25100.00, "target2": 25050.00, "riskReward": "1:2.00" }
    },
    "reason": "WAIT — Bullish score 60.00/100. Missing/failed: structure is ..."
  }
}
```

### `analysis` fields

These remain the Phase 5 market measurements: EMA20/50/200, RSI(14),
ATR(14), VWAP, trend, volume state, structure, support and resistance.

### `signal` fields

- `signal` — `BUY`, `SELL`, or `WAIT`.
- `setup` — `STRONG`, `QUALIFIED`, `WATCH`, or `WAIT`.
- `bullishScore` / `bearishScore` — independent 0–100 directional scores.
- `confidence` — the score of the selected/closest direction for this
  snapshot; it is a strategy score, not a probability of profit.
- `entry`, `stopLoss`, `target1`, `target2`, `riskReward` — populated only
  for an actionable BUY/SELL.
- `plans.bullish` / `plans.bearish` — candidate risk plans for both
  directions when a valid plan can be constructed. Candidate plans are not
  simultaneous signals.
- `forecasts` — up to four directional research forecasts for 5/15/30/60 minutes. Each
  forecast is anchored to the latest candle timestamp and has an exact end timestamp.
  `strength` is a signal-strength value, not a probability.
- `reason` — explanation for the selected action/closest setup.

`target1` and `target2` are planned exit levels. They are not proof that a
position exists and are not an automated exit command.

## Exit codes

- `0` — success (a JSON line was printed).
- `1` — the input file path was given but could not be read.

## Current limitations

- Multi-horizon forecasts are deterministic research heuristics, not trained forecasts or probabilities.
- Forecast direction is calibrated only as a 0-100 directional score until historical walk-forward validation is added.
- The forecast endpoint intentionally uses 5-minute candles as the base resolution.
- No futures contract or options-chain selector yet.
- No broker order execution.
- Yahoo Finance remains an unofficial market-data source and may be delayed, incomplete or unavailable.

## Exit codes

- `0` — success (a JSON line was printed).
- `1` — the input file path was given but could not be read.

## What this contract does NOT do yet

- **No live market data** — CSV/sample only (Phase 8).
- **No process spawning from Node.js yet** — that wiring is Phase 7.
  This contract exists so Phase 7 has something stable to call against.
- **No exit/trailing-stop monitoring of an open position** — every run
  is a fresh, independent snapshot decision (see
  `docs/STRATEGY_RULES.md` "Known simplifications").
- **No backtesting or validation of the strategy rules** — Phase 11.

# Strategy Rules — Phase 9 Upgrade

This phase upgrades the original all-or-nothing Phase 6 strategy into a
transparent **directional scoring + risk-plan engine** for research and
paper-trading development. It does not place broker orders and has not been
validated for profitability.

## Direction scores

Both directions are evaluated independently on every engine run:

| Condition | Weight |
|---|---:|
| Trend agrees with direction | 25 |
| Market structure agrees | 25 |
| Price vs VWAP agrees | 20 |
| Volume is High or Spike | 15 |
| RSI is in the direction's healthy range | 15 |
| **Total** | **100** |

Bullish RSI range: 40–75.
Bearish RSI range: 25–60.

## Actionable signal gates

A BUY/SELL requires:

1. Directional trend agrees (`Bullish` or `Bearish`).
2. Market structure agrees (`Higher High / Higher Low` or
   `Lower High / Lower Low`).
3. RSI is available and inside the corresponding healthy range.
4. Direction score is at least **70/100**.
5. A valid risk plan can be constructed.

Volume is therefore a quality factor rather than a hard gate. This makes the
live engine less brittle than Phase 6 while still requiring the core trend,
structure and momentum filters.

If neither direction qualifies, the main signal is `WAIT`. The JSON still
contains both candidate plans whenever enough price/volatility information is
available, so the dashboard can explain what a bullish or bearish setup would
look like without treating either candidate as an active trade.

## Bullish plan

```text
entry = current price
volatility stop = entry - ATR(14) * 1.5
stopLoss = farther of volatility stop and valid support
risk = entry - stopLoss
target1 = 2R, optionally capped by a meaningful resistance
target2 = 3R
```

Target 1 is not capped by a resistance that would reduce the achieved R:R
below 1.5. This prevents a nearby resistance from creating an unattractive
first target.

## Bearish plan

```text
entry = current price
volatility stop = entry + ATR(14) * 1.5
stopLoss = farther of volatility stop and valid resistance
risk = stopLoss - entry
target1 = 2R, optionally capped by a meaningful support
target2 = 3R
```

The same minimum 1.5R rule applies to Target 1.

## EXIT terminology

The engine currently returns **exit levels**, not an open-position exit
command. `target1` and `target2` are planned exit/target levels. A future
Position Manager should monitor an actual paper/live position and emit
states such as `TARGET1_HIT`, `TARGET2_HIT`, `STOP_LOSS_HIT`, or
`REVERSAL_EXIT`.

This distinction is intentional: a snapshot signal cannot know whether the
user actually entered a position.

## Futures and options architecture

The Phase 9 signal is an **underlying-direction engine**. It should not
hard-code a particular option strike or expiry.

Future derivative layers should consume:

```text
Underlying direction
        ↓
Futures execution plan OR Options selector
        ↓
Strike / expiry / premium / Greeks / liquidity checks
        ↓
Derivative-specific risk plan
```

The underlying Entry/SL/Targets and an option premium's Entry/SL/Targets are
not interchangeable.

## Safety / research note

This is software-engineering infrastructure for research, backtesting and
paper trading. The scoring thresholds and multipliers are design parameters,
not evidence of a profitable strategy. Backtesting, walk-forward testing,
transaction-cost modeling, slippage modeling and paper trading are required
before considering any real-money integration.

# C++ Quantitative Engine

Phase 1 contains only the CMake project and a startup executable.

Future responsibilities:
- Candle processing
- Technical indicators
- Market structure
- Strategy evaluation
- Entry calculation
- Stop-loss calculation
- Target calculation
- Risk management
- Backtesting


## Phase 11A: multi-horizon forecast

`trading_engine` also emits `signal.forecasts` for 5, 15, 30 and 60 minutes. Each item has the exact start/end Unix timestamps, BULLISH/BEARISH/NEUTRAL direction, Bull/Bear scores, strength, and a short calculation basis. The feature is a deterministic research heuristic; it does not claim a probability of future movement.

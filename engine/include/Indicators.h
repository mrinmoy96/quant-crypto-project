#pragma once

#include <vector>

#include "Candle.h"

// Phase 5: pure numeric indicator functions. No trading decisions here —
// these just compute values from candle data (see Strategy.h for the
// still-stub decision logic, filled in properly in Phase 6).
namespace indicators {

// Exponential moving average, one value per input candle (same length as
// `candles`). The first `period - 1` values are seeded with a simple
// moving average of what's available so the series has no gaps. Returns
// an empty vector if `candles` is empty.
std::vector<double> ema(const std::vector<Candle>& candles, int period);

// Latest RSI (Wilder's smoothing), 0-100. Returns -1 if there isn't
// enough data (need at least `period + 1` candles).
double rsi(const std::vector<Candle>& candles, int period = 14);

// Latest ATR (Wilder's smoothing) in price units. Returns -1 if there
// isn't enough data (need at least `period + 1` candles).
double atr(const std::vector<Candle>& candles, int period = 14);

// Cumulative VWAP over every candle provided. Assumes the whole vector is
// one continuous session — real session/day boundaries are added when
// live data arrives in Phase 8. Returns 0 if `candles` is empty.
double vwap(const std::vector<Candle>& candles);

} // namespace indicators

#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "Candle.h"

enum class Trend {
    BULLISH,
    BEARISH,
    SIDEWAYS
};

enum class VolumeState {
    WEAK,
    NORMAL,
    HIGH,
    SPIKE
};

std::string toString(Trend trend);
std::string toString(VolumeState state);

// A local swing high or swing low, detected with a simple fractal rule:
// a candle is a swing high if its high is the highest within `lookback`
// candles on both sides (swing low is the mirror image for lows).
struct SwingPoint {
    int64_t timestamp;
    double price;
    bool isHigh;
};

namespace structure {

std::vector<SwingPoint> findSwingPoints(const std::vector<Candle>& candles, int lookback = 2);

// Compares the two most recent swing highs and the two most recent swing
// lows to label the structure. Falls back to "Insufficient data" if fewer
// than two of each are found.
std::string classifyStructure(const std::vector<SwingPoint>& swings);

// Compares the latest candle's volume to the average of the preceding
// `lookback` candles.
VolumeState classifyVolume(const std::vector<Candle>& candles, int lookback = 20);

// Combines EMA alignment with the structure label. EMAs must be strictly
// stacked (20 > 50 > 200, or reverse) to call a trend — otherwise Sideways.
Trend classifyTrend(double ema20, double ema50, double ema200, const std::string& structureLabel);

// Nearest swing low below the current price (support) / swing high above
// the current price (resistance). Falls back to the min/close or
// max/close of the provided candles when no usable swing exists.
double nearestSupport(const std::vector<SwingPoint>& swings, const std::vector<Candle>& candles, double currentPrice);
double nearestResistance(const std::vector<SwingPoint>& swings, const std::vector<Candle>& candles, double currentPrice);

} // namespace structure

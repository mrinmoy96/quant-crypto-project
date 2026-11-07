#include "MarketStructure.h"

#include <algorithm>
#include <limits>

std::string toString(Trend trend) {
    switch (trend) {
        case Trend::BULLISH: return "Bullish";
        case Trend::BEARISH: return "Bearish";
        case Trend::SIDEWAYS: return "Sideways";
    }
    return "Sideways";
}

std::string toString(VolumeState state) {
    switch (state) {
        case VolumeState::WEAK: return "Weak";
        case VolumeState::NORMAL: return "Normal";
        case VolumeState::HIGH: return "High";
        case VolumeState::SPIKE: return "Spike";
    }
    return "Normal";
}

namespace structure {

std::vector<SwingPoint> findSwingPoints(const std::vector<Candle>& candles, int lookback) {
    std::vector<SwingPoint> swings;
    int n = static_cast<int>(candles.size());
    if (n < lookback * 2 + 1) return swings;

    for (int i = lookback; i < n - lookback; ++i) {
        bool isSwingHigh = true;
        bool isSwingLow = true;

        for (int j = i - lookback; j <= i + lookback; ++j) {
            if (j == i) continue;
            if (candles[j].high >= candles[i].high) isSwingHigh = false;
            if (candles[j].low <= candles[i].low) isSwingLow = false;
        }

        if (isSwingHigh) {
            swings.push_back({candles[i].timestamp, candles[i].high, true});
        }
        if (isSwingLow) {
            swings.push_back({candles[i].timestamp, candles[i].low, false});
        }
    }

    return swings;
}

std::string classifyStructure(const std::vector<SwingPoint>& swings) {
    std::vector<SwingPoint> highs;
    std::vector<SwingPoint> lows;
    for (const auto& swing : swings) {
        if (swing.isHigh) highs.push_back(swing);
        else lows.push_back(swing);
    }

    if (highs.size() < 2 || lows.size() < 2) {
        return "Insufficient data";
    }

    const auto& lastHigh = highs[highs.size() - 1];
    const auto& prevHigh = highs[highs.size() - 2];
    const auto& lastLow = lows[lows.size() - 1];
    const auto& prevLow = lows[lows.size() - 2];

    bool higherHigh = lastHigh.price > prevHigh.price;
    bool higherLow = lastLow.price > prevLow.price;
    bool lowerHigh = lastHigh.price < prevHigh.price;
    bool lowerLow = lastLow.price < prevLow.price;

    if (higherHigh && higherLow) return "Higher High / Higher Low";
    if (lowerHigh && lowerLow) return "Lower High / Lower Low";
    return "Consolidation / Mixed Structure";
}

VolumeState classifyVolume(const std::vector<Candle>& candles, int lookback) {
    if (candles.empty()) return VolumeState::NORMAL;

    int n = static_cast<int>(candles.size());
    int start = std::max(0, n - 1 - lookback);
    int end = n - 1; // exclusive of the latest candle

    if (end <= start) return VolumeState::NORMAL;

    double sum = 0.0;
    for (int i = start; i < end; ++i) sum += candles[i].volume;
    double average = sum / (end - start);

    if (average <= 0.0) return VolumeState::NORMAL;

    double latest = candles.back().volume;
    double ratio = latest / average;

    if (ratio >= 2.0) return VolumeState::SPIKE;
    if (ratio >= 1.3) return VolumeState::HIGH;
    if (ratio < 0.7) return VolumeState::WEAK;
    return VolumeState::NORMAL;
}

Trend classifyTrend(double ema20, double ema50, double ema200, const std::string& structureLabel) {
    bool emaBullStack = ema20 > ema50 && ema50 > ema200;
    bool emaBearStack = ema20 < ema50 && ema50 < ema200;

    if (emaBullStack && structureLabel == "Higher High / Higher Low") return Trend::BULLISH;
    if (emaBearStack && structureLabel == "Lower High / Lower Low") return Trend::BEARISH;

    // EMA alignment alone (structure inconclusive/insufficient) still
    // gives a directional read, just a softer one.
    if (emaBullStack && structureLabel != "Lower High / Lower Low") return Trend::BULLISH;
    if (emaBearStack && structureLabel != "Higher High / Higher Low") return Trend::BEARISH;

    return Trend::SIDEWAYS;
}

double nearestSupport(const std::vector<SwingPoint>& swings, const std::vector<Candle>& candles, double currentPrice) {
    double best = -std::numeric_limits<double>::infinity();
    bool found = false;

    for (const auto& swing : swings) {
        if (!swing.isHigh && swing.price <= currentPrice && swing.price > best) {
            best = swing.price;
            found = true;
        }
    }

    if (found) return best;
    if (candles.empty()) return currentPrice;

    double lowest = candles.front().low;
    for (const auto& candle : candles) lowest = std::min(lowest, candle.low);
    return lowest;
}

double nearestResistance(const std::vector<SwingPoint>& swings, const std::vector<Candle>& candles, double currentPrice) {
    double best = std::numeric_limits<double>::infinity();
    bool found = false;

    for (const auto& swing : swings) {
        if (swing.isHigh && swing.price >= currentPrice && swing.price < best) {
            best = swing.price;
            found = true;
        }
    }

    if (found) return best;
    if (candles.empty()) return currentPrice;

    double highest = candles.front().high;
    for (const auto& candle : candles) highest = std::max(highest, candle.high);
    return highest;
}

} // namespace structure

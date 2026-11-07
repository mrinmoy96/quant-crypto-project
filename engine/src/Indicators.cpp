#include "Indicators.h"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace indicators {

std::vector<double> ema(const std::vector<Candle>& candles, int period) {
    std::vector<double> result;
    if (candles.empty() || period <= 0) return result;

    result.resize(candles.size());
    const double multiplier = 2.0 / (period + 1.0);
    int seedCount = std::min<int>(period, static_cast<int>(candles.size()));
    double seedSum = 0.0;
    for (int i = 0; i < seedCount; ++i) seedSum += candles[i].close;
    double rollingSum = 0.0;
    for (int i = 0; i < seedCount; ++i) {
        rollingSum += candles[i].close;
        result[i] = rollingSum / (i + 1);
    }

    double previous = seedSum / seedCount;
    for (size_t i = static_cast<size_t>(seedCount); i < candles.size(); ++i) {
        previous = (candles[i].close - previous) * multiplier + previous;
        result[i] = previous;
    }

    return result;
}

double rsi(const std::vector<Candle>& candles, int period) {
    if (period <= 0 || static_cast<int>(candles.size()) < period + 1) return -1.0;

    double avgGain = 0.0;
    double avgLoss = 0.0;

    for (int i = 1; i <= period; ++i) {
        double change = candles[i].close - candles[i - 1].close;
        if (change > 0) avgGain += change;
        else avgLoss += -change;
    }
    avgGain /= period;
    avgLoss /= period;

    for (size_t i = period + 1; i < candles.size(); ++i) {
        double change = candles[i].close - candles[i - 1].close;
        double gain = change > 0 ? change : 0.0;
        double loss = change < 0 ? -change : 0.0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgGain == 0.0 && avgLoss == 0.0) return 50.0;
    if (avgLoss == 0.0) return 100.0;

    double rs = avgGain / avgLoss;
    return 100.0 - (100.0 / (1.0 + rs));
}

double atr(const std::vector<Candle>& candles, int period) {
    if (period <= 0 || static_cast<int>(candles.size()) < period + 1) return -1.0;

    std::vector<double> trueRanges;
    trueRanges.reserve(candles.size() - 1);

    for (size_t i = 1; i < candles.size(); ++i) {
        double highLow = candles[i].high - candles[i].low;
        double highPrevClose = std::fabs(candles[i].high - candles[i - 1].close);
        double lowPrevClose = std::fabs(candles[i].low - candles[i - 1].close);
        trueRanges.push_back(std::max({highLow, highPrevClose, lowPrevClose}));
    }

    double atrValue = std::accumulate(trueRanges.begin(), trueRanges.begin() + period, 0.0) / period;
    for (size_t i = period; i < trueRanges.size(); ++i) {
        atrValue = (atrValue * (period - 1) + trueRanges[i]) / period;
    }

    return atrValue;
}

double vwap(const std::vector<Candle>& candles) {
    if (candles.empty()) return 0.0;

    double cumulativePV = 0.0;
    double cumulativeVolume = 0.0;

    for (const auto& candle : candles) {
        double typicalPrice = (candle.high + candle.low + candle.close) / 3.0;
        cumulativePV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
    }

    if (cumulativeVolume == 0.0) return candles.back().close;
    return cumulativePV / cumulativeVolume;
}

} // namespace indicators

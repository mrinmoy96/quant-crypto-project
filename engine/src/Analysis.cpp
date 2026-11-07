#include "Analysis.h"

#include <cstdio>

#include "Indicators.h"

AnalysisResult analyze(const std::vector<Candle>& candles) {
    AnalysisResult result;
    if (candles.empty()) return result;

    result.price = candles.back().close;

    auto ema20Series = indicators::ema(candles, 20);
    auto ema50Series = indicators::ema(candles, 50);
    auto ema200Series = indicators::ema(candles, 200);

    result.ema20 = ema20Series.empty() ? result.price : ema20Series.back();
    result.ema50 = ema50Series.empty() ? result.price : ema50Series.back();
    result.ema200 = ema200Series.empty() ? result.price : ema200Series.back();

    result.rsi = indicators::rsi(candles);
    result.atr = indicators::atr(candles);
    result.vwap = indicators::vwap(candles);
    result.aboveVwap = result.price > result.vwap;

    auto swings = structure::findSwingPoints(candles);
    result.structureLabel = structure::classifyStructure(swings);
    result.volume = structure::classifyVolume(candles);
    result.trend = structure::classifyTrend(result.ema20, result.ema50, result.ema200, result.structureLabel);

    result.support = structure::nearestSupport(swings, candles, result.price);
    result.resistance = structure::nearestResistance(swings, candles, result.price);

    return result;
}

namespace {
std::string formatNumber(double value) {
    if (value < 0) return "null"; // used for rsi/atr when not enough data
    char buffer[64];
    std::snprintf(buffer, sizeof(buffer), "%.2f", value);
    return buffer;
}
} // namespace

std::string toJson(const AnalysisResult& result) {
    std::string rsiField = result.rsi < 0 ? "null" : formatNumber(result.rsi);
    std::string atrField = result.atr < 0 ? "null" : formatNumber(result.atr);

    return "{"
        "\"price\":" + formatNumber(result.price) + ","
        "\"ema20\":" + formatNumber(result.ema20) + ","
        "\"ema50\":" + formatNumber(result.ema50) + ","
        "\"ema200\":" + formatNumber(result.ema200) + ","
        "\"rsi\":" + rsiField + ","
        "\"atr\":" + atrField + ","
        "\"vwap\":" + formatNumber(result.vwap) + ","
        "\"priceVsVwap\":\"" + (result.aboveVwap ? "Above" : "Below") + "\","
        "\"trend\":\"" + toString(result.trend) + "\","
        "\"volume\":\"" + toString(result.volume) + "\","
        "\"structure\":\"" + result.structureLabel + "\","
        "\"support\":" + formatNumber(result.support) + ","
        "\"resistance\":" + formatNumber(result.resistance) +
        "}";
}

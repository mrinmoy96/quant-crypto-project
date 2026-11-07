#pragma once

#include <string>
#include <vector>

#include "Candle.h"
#include "MarketStructure.h"

// Phase 5 output: everything the future Phase 6 entry/exit engine will
// read to decide Entry/SL/Target. Phase 5 itself makes no trading
// decisions — it only measures and classifies the market.
struct AnalysisResult {
    double ema20 = 0.0;
    double ema50 = 0.0;
    double ema200 = 0.0;
    double rsi = -1.0;
    double atr = -1.0;
    double vwap = 0.0;
    double price = 0.0;
    bool aboveVwap = false;

    Trend trend = Trend::SIDEWAYS;
    VolumeState volume = VolumeState::NORMAL;
    std::string structureLabel = "Insufficient data";

    double support = 0.0;
    double resistance = 0.0;
};

// Runs every Phase 5 indicator + structure check over `candles` and
// returns one combined result. Safe to call with short candle vectors —
// individual fields fall back to sane defaults (e.g. rsi/atr = -1) when
// there isn't enough data rather than throwing.
AnalysisResult analyze(const std::vector<Candle>& candles);

std::string toJson(const AnalysisResult& result);

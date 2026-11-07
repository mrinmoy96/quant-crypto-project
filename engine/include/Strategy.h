#pragma once

#include <vector>

#include "Analysis.h"
#include "Candle.h"
#include "Signal.h"

// Phase 9 upgrade: score-based directional signal + risk plan engine.
//
// The engine evaluates bullish and bearish evidence independently, creates
// candidate Entry/SL/Target plans for both directions, and emits an
// actionable BUY/SELL only when the directional trend + structure agree and
// the score clears the configured threshold. Otherwise it emits WAIT while
// still returning both candidate plans for dashboard/debugging purposes.
class Strategy {
public:
    Strategy() = default;

    Signal evaluate(const std::vector<Candle>& candles, const AnalysisResult& analysis) const;
};

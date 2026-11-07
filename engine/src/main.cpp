#include <iostream>
#include <vector>
#include "Analysis.h"
#include "Candle.h"
#include "CandleFeed.h"
#include "Signal.h"
#include "Strategy.h"

// Phase 11 CLI contract (see docs/ENGINE_CONTRACT.md):
//   ./trading_engine [path/to/candles.csv]
//
// - stdout: EXACTLY one line of JSON — {"analysis": {...}, "signal": {...}}.
//   "signal" now includes entry/stopLoss/target1/target2/riskReward when
//   type is BUY or SELL (null when WAIT). Nothing else is ever written
//   to stdout.
// - stderr: human-readable logs/diagnostics. Safe to ignore programmatically.
// - exit code: 0 on success, 1 if the input file couldn't be read.
int main(int argc, char** argv) {
    std::cerr << "NIFTY/SENSEX C++ Engine — Phase 11A" << std::endl;

    std::vector<Candle> candles;

    if (argc > 1) {
        const std::string path = argv[1];
        try {
            candles = CandleFeed::loadFromCsv(path);
            std::cerr << "Loaded " << candles.size() << " candles from " << path << std::endl;
        } catch (const std::exception& ex) {
            std::cerr << "Error: " << ex.what() << std::endl;
            return 1;
        }
    } else {
        std::cerr << "No input file given — using generated sample candles" << std::endl;
        // Enough candles for EMA200 to be meaningful in demo mode.
        candles = CandleFeed::generateSample(250);
    }

    AnalysisResult analysis = analyze(candles);

    Strategy strategy;
    Signal signal = strategy.evaluate(candles, analysis);

    // Contract: this is the ONLY line written to stdout.
    std::cout << "{\"analysis\":" << toJson(analysis)
               << ",\"signal\":" << toJson(signal) << "}" << std::endl;

    return 0;
}

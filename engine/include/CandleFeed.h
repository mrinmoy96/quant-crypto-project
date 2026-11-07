#pragma once

#include <string>
#include <vector>

#include "Candle.h"

// Phase 4: candle ingestion.
//
// This is the engine's "front door" for market data. In Phase 4 it only
// knows how to read a CSV file or generate deterministic sample data —
// nothing about a live feed or broker (that's Phase 8). Node.js will
// eventually write a CSV/JSON file of real candles and pass its path to
// the engine (see docs/ENGINE_CONTRACT.md).
class CandleFeed {
public:
    // Loads candles from a CSV file with columns:
    //   timestamp,open,high,low,close,volume
    // A header row is optional and auto-detected (a row is treated as a
    // header if its first field doesn't parse as a number).
    // Throws std::runtime_error if the file cannot be opened.
    static std::vector<Candle> loadFromCsv(const std::string& path);

    // Generates deterministic sample candles for demo/testing when no
    // input file is supplied. Same seeded-random approach as the Node.js
    // mock data generator, so behavior is easy to reason about.
    static std::vector<Candle> generateSample(int count, double basePrice = 25200.0);
};

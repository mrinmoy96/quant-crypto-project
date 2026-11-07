#pragma once

#include <cstdint>

// Represents a single OHLCV price candle for an instrument
// (e.g. one minute / one day of NIFTY 50 or SENSEX price action).
struct Candle {
    int64_t timestamp; // Unix epoch (seconds)
    double open;
    double high;
    double low;
    double close;
    double volume;
};

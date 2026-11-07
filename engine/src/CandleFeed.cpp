#include "CandleFeed.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace {

std::vector<std::string> splitCsvLine(const std::string& line) {
    std::vector<std::string> fields;
    std::stringstream ss(line);
    std::string field;
    while (std::getline(ss, field, ',')) {
        fields.push_back(field);
    }
    return fields;
}

bool looksNumeric(const std::string& text) {
    if (text.empty()) return false;
    char* end = nullptr;
    std::strtod(text.c_str(), &end);
    return end != text.c_str() && *end == '\0';
}

// Simple deterministic PRNG (linear congruential) so sample data is
// reproducible across runs and languages — mirrors the approach used in
// backend/src/data/mockMarketData.js.
class SeededRandom {
public:
    explicit SeededRandom(unsigned int seed) : state_(seed == 0 ? 1 : seed) {}

    double next() {
        state_ = (state_ * 1103515245u + 12345u) & 0x7fffffffu;
        return static_cast<double>(state_) / static_cast<double>(0x7fffffffu);
    }

private:
    unsigned int state_;
};

} // namespace

std::vector<Candle> CandleFeed::loadFromCsv(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("CandleFeed: could not open file: " + path);
    }

    std::vector<Candle> candles;
    std::string line;
    bool firstLine = true;

    while (std::getline(file, line)) {
        if (line.empty()) continue;

        auto fields = splitCsvLine(line);
        if (firstLine) {
            firstLine = false;
            if (!fields.empty() && !looksNumeric(fields[0])) {
                continue; // header row, skip
            }
        }

        if (fields.size() < 6) continue; // malformed row, skip

        Candle candle;
        candle.timestamp = std::strtoll(fields[0].c_str(), nullptr, 10);
        candle.open = std::strtod(fields[1].c_str(), nullptr);
        candle.high = std::strtod(fields[2].c_str(), nullptr);
        candle.low = std::strtod(fields[3].c_str(), nullptr);
        candle.close = std::strtod(fields[4].c_str(), nullptr);
        candle.volume = std::strtod(fields[5].c_str(), nullptr);

        candles.push_back(candle);
    }

    return candles;
}

std::vector<Candle> CandleFeed::generateSample(int count, double basePrice) {
    std::vector<Candle> candles;
    if (count <= 0) return candles;

    SeededRandom rand(42);
    double close = basePrice;
    const double volatility = basePrice * 0.0015;
    const int64_t stepSeconds = 5 * 60; // 5-minute candles
    const int64_t now = 1'700'000'000; // fixed reference epoch for reproducibility

    for (int i = count - 1; i >= 0; --i) {
        double open = close;
        double drift = (rand.next() - 0.5) * volatility;
        close = open + drift;
        if (close < 1.0) close = 1.0;

        double high = std::max(open, close) + rand.next() * volatility * 0.4;
        double low = std::min(open, close) - rand.next() * volatility * 0.4;
        double volume = 50000.0 + rand.next() * 200000.0;

        Candle candle;
        candle.timestamp = now - static_cast<int64_t>(i) * stepSeconds;
        candle.open = open;
        candle.high = high;
        candle.low = low;
        candle.close = close;
        candle.volume = volume;

        candles.push_back(candle);
    }

    return candles;
}

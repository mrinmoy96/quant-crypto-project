// Minimal, dependency-free smoke tests. No test framework is added in
// Phase 4 to keep the engine's build simple — this just asserts basic
// invariants and exits non-zero on failure, so it plugs into CI later
// without extra setup.

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <sstream>

#include "Analysis.h"
#include "CandleFeed.h"
#include "Indicators.h"
#include "MarketStructure.h"
#include "Signal.h"
#include "Strategy.h"

namespace {

int failures = 0;

void check(bool condition, const char* description) {
    if (!condition) {
        std::fprintf(stderr, "FAILED: %s\n", description);
        failures += 1;
    } else {
        std::fprintf(stderr, "ok: %s\n", description);
    }
}

void testGenerateSample() {
    auto candles = CandleFeed::generateSample(10, 25000.0);
    check(candles.size() == 10, "generateSample returns requested count");
    check(candles.front().timestamp < candles.back().timestamp,
          "generateSample candles are in chronological order");
    check(candles.front().high >= candles.front().open,
          "generated candle high is >= open");
}

void testGenerateSampleIsDeterministic() {
    auto a = CandleFeed::generateSample(5, 25000.0);
    auto b = CandleFeed::generateSample(5, 25000.0);
    check(a.size() == b.size() && a.front().close == b.front().close,
          "generateSample is deterministic across calls");
}

void testLoadFromCsv() {
    const std::string path = "/tmp/candle_feed_test.csv";
    std::ofstream out(path);
    out << "timestamp,open,high,low,close,volume\n";
    out << "1700000000,100,105,95,102,1000\n";
    out << "1700000300,102,108,100,106,1500\n";
    out.close();

    auto candles = CandleFeed::loadFromCsv(path);
    check(candles.size() == 2, "loadFromCsv parses expected row count");
    check(candles[0].close == 102.0, "loadFromCsv parses close correctly");
    check(candles[1].volume == 1500.0, "loadFromCsv parses volume correctly");

    std::remove(path.c_str());
}

void testMissingFileThrows() {
    bool threw = false;
    try {
        CandleFeed::loadFromCsv("/tmp/does-not-exist-candle-feed.csv");
    } catch (const std::exception&) {
        threw = true;
    }
    check(threw, "loadFromCsv throws for a missing file");
}

void testSignalJson() {
    Signal signal;
    signal.timestamp = 123;
    signal.type = SignalType::WAIT;
    signal.reason = "test reason";

    std::string json = toJson(signal);
    check(json.find("\"signal\":\"WAIT\"") != std::string::npos,
          "toJson includes the signal type");
    check(json.find("\"reason\":\"test reason\"") != std::string::npos,
          "toJson includes the reason string");

    AnalysisResult a;
    a.price = 25200.0;
    a.atr = 20.0;
    a.support = 25150.0;
    a.resistance = 25400.0;
    Strategy strategy;
    auto candles = CandleFeed::generateSample(5);
    Signal enriched = strategy.evaluate(candles, a);
    std::string enrichedJson = toJson(enriched);
    check(enrichedJson.find("\"bullishScore\":") != std::string::npos,
          "signal JSON includes bullish score");
    check(enrichedJson.find("\"bearishScore\":") != std::string::npos,
          "signal JSON includes bearish score");
    check(enrichedJson.find("\"plans\":") != std::string::npos,
          "signal JSON includes both directional plans");
}

void testMultiHorizonForecasts() {
    auto candles = CandleFeed::generateSample(250, 25000.0);
    AnalysisResult analysis = analyze(candles);
    Strategy strategy;
    Signal signal = strategy.evaluate(candles, analysis);

    check(signal.forecasts.size() == 4, "5m input produces 4 multi-horizon forecasts");
    if (signal.forecasts.size() == 4) {
        const int expectedHorizon[] = {5, 15, 30, 60};
        for (size_t i = 0; i < signal.forecasts.size(); ++i) {
            check(signal.forecasts[i].horizonMinutes == expectedHorizon[i],
                  "forecast horizon is 5/15/30/60 minutes");
            check(signal.forecasts[i].startTimestamp == candles.back().timestamp,
                  "forecast start is anchored to latest candle");
            check(signal.forecasts[i].endTimestamp ==
                      candles.back().timestamp + static_cast<int64_t>(expectedHorizon[i]) * 60,
                  "forecast end is exact start plus horizon");
            check(signal.forecasts[i].direction == "BULLISH" ||
                  signal.forecasts[i].direction == "BEARISH" ||
                  signal.forecasts[i].direction == "NEUTRAL",
                  "forecast direction is valid");
        }
    }

    std::string json = toJson(signal);
    check(json.find("\"forecasts\":[") != std::string::npos,
          "signal JSON includes multi-horizon forecasts");
}

void testStrategyBuySignal() {
    AnalysisResult a;
    a.price = 25200.0;
    a.ema20 = 25190.0; a.ema50 = 25150.0; a.ema200 = 25050.0;
    a.rsi = 58.0;
    a.atr = 20.0;
    a.vwap = 25150.0;
    a.aboveVwap = true;
    a.trend = Trend::BULLISH;
    a.volume = VolumeState::HIGH;
    a.structureLabel = "Higher High / Higher Low";
    a.support = 25150.0;
    a.resistance = 25400.0;

    std::vector<Candle> candles = CandleFeed::generateSample(5);
    Strategy strategy;
    Signal signal = strategy.evaluate(candles, a);

    check(signal.type == SignalType::BUY, "all bullish conditions met -> BUY");
    check(signal.hasLevels, "BUY signal has levels populated");
    check(signal.entry == a.price, "BUY entry equals current price");
    check(signal.stopLoss < signal.entry, "BUY stop-loss is below entry");
    check(signal.target1 > signal.entry, "BUY target1 is above entry");
    check(signal.target2 > signal.target1, "BUY target2 is farther than target1");
}

void testStrategySellSignal() {
    AnalysisResult a;
    a.price = 25200.0;
    a.ema20 = 25210.0; a.ema50 = 25250.0; a.ema200 = 25350.0;
    a.rsi = 40.0;
    a.atr = 20.0;
    a.vwap = 25250.0;
    a.aboveVwap = false;
    a.trend = Trend::BEARISH;
    a.volume = VolumeState::SPIKE;
    a.structureLabel = "Lower High / Lower Low";
    a.support = 25000.0;
    a.resistance = 25250.0;

    std::vector<Candle> candles = CandleFeed::generateSample(5);
    Strategy strategy;
    Signal signal = strategy.evaluate(candles, a);

    check(signal.type == SignalType::SELL, "all bearish conditions met -> SELL");
    check(signal.hasLevels, "SELL signal has levels populated");
    check(signal.stopLoss > signal.entry, "SELL stop-loss is above entry");
    check(signal.target1 < signal.entry, "SELL target1 is below entry");
    check(signal.target2 < signal.target1, "SELL target2 is farther than target1");
}

void testStrategyWaitsOnWeakVolume() {
    AnalysisResult a;
    a.price = 25200.0;
    a.ema20 = 25190.0; a.ema50 = 25150.0; a.ema200 = 25050.0;
    a.rsi = 58.0;
    a.atr = 20.0;
    a.vwap = 25150.0;
    a.aboveVwap = true;
    a.trend = Trend::BULLISH;
    a.volume = VolumeState::NORMAL; // weak confirmation -> no trade
    a.structureLabel = "Higher High / Higher Low";
    a.support = 25150.0;
    a.resistance = 25400.0;

    std::vector<Candle> candles = CandleFeed::generateSample(5);
    Strategy strategy;
    Signal signal = strategy.evaluate(candles, a);

    check(signal.type == SignalType::WAIT, "normal volume without strong confirmation -> WAIT");
    check(!signal.hasLevels, "WAIT signal should not emit trade levels");
    check(signal.reason.find("volume") != std::string::npos,
          "WAIT reason correctly mentions weak volume as the blocker");
    check(signal.bullishPlan.available, "candidate bullish plan stays available for research display");
    check(signal.bearishPlan.available, "candidate bearish plan stays available for research display");
}

void testStrategyWaitsOnOverboughtRsi() {
    AnalysisResult a;
    a.price = 25200.0;
    a.ema20 = 25190.0; a.ema50 = 25150.0; a.ema200 = 25050.0;
    a.rsi = 88.0; // overbought
    a.atr = 20.0;
    a.vwap = 25150.0;
    a.aboveVwap = true;
    a.trend = Trend::BULLISH;
    a.volume = VolumeState::SPIKE;
    a.structureLabel = "Higher High / Higher Low";
    a.support = 25150.0;
    a.resistance = 25400.0;

    std::vector<Candle> candles = CandleFeed::generateSample(5);
    Strategy strategy;
    Signal signal = strategy.evaluate(candles, a);

    check(signal.type == SignalType::WAIT, "overbought bullish setup -> WAIT");
    check(signal.reason.find("RSI") != std::string::npos,
          "WAIT reason correctly names RSI as the missing condition");
    check(signal.bullishPlan.available, "candidate bullish plan remains available for research display");
}

void testStrategyStopLossUsesWiderOfStructureAndVolatility() {
    // Structural support is very close to price; ATR-based stop should
    // win out so the SL isn't unrealistically tight.
    AnalysisResult a;
    a.price = 25200.0;
    a.ema20 = 25190.0; a.ema50 = 25150.0; a.ema200 = 25050.0;
    a.rsi = 58.0;
    a.atr = 50.0; // large ATR -> volatility stop should be the wider one
    a.vwap = 25150.0;
    a.aboveVwap = true;
    a.trend = Trend::BULLISH;
    a.volume = VolumeState::HIGH;
    a.structureLabel = "Higher High / Higher Low";
    a.support = 25195.0; // only 5 points below price - too tight on its own
    a.resistance = 25400.0;

    std::vector<Candle> candles = CandleFeed::generateSample(5);
    Strategy strategy;
    Signal signal = strategy.evaluate(candles, a);

    check(signal.type == SignalType::BUY, "setup still triggers BUY");
    double expectedVolStop = a.price - a.atr * 1.5;
    check(std::fabs(signal.stopLoss - expectedVolStop) < 0.01,
          "stop-loss uses the wider ATR-based level when structure is too tight");
}

void testEmaTracksPrice() {
    auto candles = CandleFeed::generateSample(250);
    auto series = indicators::ema(candles, 20);
    check(series.size() == candles.size(), "ema series matches candle count");

    // A short EMA should stay close to the closing price on smooth data.
    double diff = std::fabs(series.back() - candles.back().close);
    check(diff < candles.back().close * 0.05, "EMA20 stays within 5% of latest close");
}

void testEmaInitializationAndInvalidPeriod() {
    std::vector<Candle> candles = {
        {1, 10, 10, 10, 10, 1},
        {2, 20, 20, 20, 20, 1},
        {3, 30, 30, 30, 30, 1},
        {4, 40, 40, 40, 40, 1},
    };
    auto series = indicators::ema(candles, 3);
    check(series.size() == 4 && series[0] == 10.0 && series[1] == 15.0 &&
              series[2] == 20.0 && series[3] == 30.0,
          "EMA uses progressive SMA warm-up then exponential smoothing");
    check(indicators::ema(candles, 0).empty(), "EMA rejects a non-positive period");
}

void testRsiRange() {
    auto candles = CandleFeed::generateSample(100);
    double value = indicators::rsi(candles);
    check(value >= 0.0 && value <= 100.0, "RSI is within 0-100");
}

void testRsiInsufficientData() {
    auto candles = CandleFeed::generateSample(5);
    double value = indicators::rsi(candles, 14);
    check(value < 0.0, "RSI returns -1 sentinel when there isn't enough data");
}

void testRsiFlatMarketAndInvalidPeriod() {
    std::vector<Candle> candles;
    for (int i = 0; i < 15; ++i) {
        candles.push_back({1700000000 + i * 300, 100, 100, 100, 100, 1000});
    }
    check(indicators::rsi(candles, 14) == 50.0,
          "RSI is neutral when prices are unchanged throughout the period");
    check(indicators::rsi(candles, 0) < 0.0, "RSI rejects a non-positive period");
    check(indicators::atr(candles, 0) < 0.0, "ATR rejects a non-positive period");
}

void testAtrNonNegative() {
    auto candles = CandleFeed::generateSample(100);
    double value = indicators::atr(candles);
    check(value >= 0.0, "ATR is non-negative once there's enough data");
}

void testVwapWithinCandleRange() {
    auto candles = CandleFeed::generateSample(50);
    double value = indicators::vwap(candles);
    double lowest = candles.front().low;
    double highest = candles.front().high;
    for (const auto& c : candles) {
        lowest = std::min(lowest, c.low);
        highest = std::max(highest, c.high);
    }
    check(value >= lowest && value <= highest, "VWAP falls within the overall candle price range");
}

void testSwingPointsFound() {
    auto candles = CandleFeed::generateSample(100);
    auto swings = structure::findSwingPoints(candles);
    check(!swings.empty(), "findSwingPoints finds at least one swing on 100 candles");
}

void testVolumeClassification() {
    // Build 21 flat-volume candles, then one big spike.
    std::vector<Candle> candles;
    for (int i = 0; i < 21; ++i) {
        candles.push_back({1700000000 + i * 300, 100, 101, 99, 100, 1000});
    }
    candles.back().volume = 5000; // 5x average -> Spike
    auto state = structure::classifyVolume(candles);
    check(state == VolumeState::SPIKE, "classifyVolume detects a volume spike");
}

void testAnalyzeHandlesEmptyInput() {
    std::vector<Candle> empty;
    AnalysisResult result = analyze(empty);
    check(result.price == 0.0, "analyze() on empty candles returns a safe zeroed result");
}

void testAnalysisJsonHasExpectedFields() {
    auto candles = CandleFeed::generateSample(250);
    AnalysisResult result = analyze(candles);
    std::string json = toJson(result);
    check(json.find("\"trend\":") != std::string::npos, "analysis JSON includes trend");
    check(json.find("\"structure\":") != std::string::npos, "analysis JSON includes structure");
    check(json.find("\"support\":") != std::string::npos, "analysis JSON includes support");
    check(json.find("\"resistance\":") != std::string::npos, "analysis JSON includes resistance");
}

} // namespace

int main() {
    testGenerateSample();
    testGenerateSampleIsDeterministic();
    testLoadFromCsv();
    testMissingFileThrows();
    testSignalJson();
    testMultiHorizonForecasts();

    testEmaTracksPrice();
    testEmaInitializationAndInvalidPeriod();
    testRsiRange();
    testRsiInsufficientData();
    testRsiFlatMarketAndInvalidPeriod();
    testAtrNonNegative();
    testVwapWithinCandleRange();
    testSwingPointsFound();
    testVolumeClassification();
    testAnalyzeHandlesEmptyInput();
    testAnalysisJsonHasExpectedFields();

    testStrategyBuySignal();
    testStrategySellSignal();
    testStrategyWaitsOnWeakVolume();
    testStrategyWaitsOnOverboughtRsi();
    testStrategyStopLossUsesWiderOfStructureAndVolatility();

    if (failures > 0) {
        std::fprintf(stderr, "\n%d test(s) failed\n", failures);
        return 1;
    }

    std::fprintf(stderr, "\nAll tests passed\n");
    return 0;
}

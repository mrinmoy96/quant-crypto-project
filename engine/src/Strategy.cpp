// 20 , 270-273, 276, 289, 286, 303
#include "Strategy.h"

#include <algorithm>
#include <cmath>
#include <sstream>
#include <vector>

namespace {

constexpr double RSI_BULL_MIN = 40.0;
constexpr double RSI_BULL_MAX = 75.0;
constexpr double RSI_BEAR_MIN = 25.0;
constexpr double RSI_BEAR_MAX = 60.0;
constexpr double ATR_STOP_MULTIPLIER = 1.5;
constexpr double TARGET1_R_MULTIPLIER = 2.0;
constexpr double TARGET2_R_MULTIPLIER = 3.0;
constexpr double MIN_TARGET1_RR = 1.5;
constexpr double ACTIONABLE_SCORE = 70.0;
// constexpr double STRONG_SCORE = 85.0;


struct ScoreResult {
    double score = 0.0;
    int passed = 0;
    int total = 5;
    std::vector<std::string> misses;
};

ScoreResult scoreBullish(const AnalysisResult& a) {
    ScoreResult r;

    if (a.trend == Trend::BULLISH) r.score += 25.0, r.passed++;
    else r.misses.push_back("trend is " + toString(a.trend));

    if (a.structureLabel == "Higher High / Higher Low") r.score += 25.0, r.passed++;
    else r.misses.push_back("structure is \"" + a.structureLabel + "\"");

    if (a.aboveVwap) r.score += 20.0, r.passed++;
    else r.misses.push_back("price is below VWAP");

    if (a.volume == VolumeState::HIGH || a.volume == VolumeState::SPIKE) r.score += 15.0, r.passed++;
    else r.misses.push_back("volume is " + toString(a.volume));

    if (a.rsi >= RSI_BULL_MIN && a.rsi <= RSI_BULL_MAX) r.score += 15.0, r.passed++;
    else if (a.rsi < 0) r.misses.push_back("RSI unavailable");
    else r.misses.push_back("RSI " + jsonNumber(a.rsi) + " outside 40-75");

    return r;
}

ScoreResult scoreBearish(const AnalysisResult& a) {
    ScoreResult r;

    if (a.trend == Trend::BEARISH) r.score += 25.0, r.passed++;
    else r.misses.push_back("trend is " + toString(a.trend));

    if (a.structureLabel == "Lower High / Lower Low") r.score += 25.0, r.passed++;
    else r.misses.push_back("structure is \"" + a.structureLabel + "\"");

    if (!a.aboveVwap) r.score += 20.0, r.passed++;
    else r.misses.push_back("price is above VWAP");

    if (a.volume == VolumeState::HIGH || a.volume == VolumeState::SPIKE) r.score += 15.0, r.passed++;
    else r.misses.push_back("volume is " + toString(a.volume));

    if (a.rsi >= RSI_BEAR_MIN && a.rsi <= RSI_BEAR_MAX) r.score += 15.0, r.passed++;
    else if (a.rsi < 0) r.misses.push_back("RSI unavailable");
    else r.misses.push_back("RSI " + jsonNumber(a.rsi) + " outside 25-60");

    return r;
}

std::string joinMisses(const std::vector<std::string>& misses, const std::string& prefix) {
    std::ostringstream out;
    out << prefix;
    for (size_t i = 0; i < misses.size(); ++i) {
        out << misses[i];
        if (i + 1 < misses.size()) out << "; ";
    }
    return out.str();
}

bool validPrice(double price) {
    return std::isfinite(price) && price > 0.0;
}

TradePlan buildBullishPlan(const AnalysisResult& a) {
    TradePlan plan;
    if (!validPrice(a.price)) return plan;

    const double atrBase = (std::isfinite(a.atr) && a.atr > 0.0) ? a.atr : a.price * 0.005;
    const double volatilityStop = a.price - atrBase * ATR_STOP_MULTIPLIER;
    double structuralStop = (a.support > 0.0 && a.support < a.price) ? a.support : volatilityStop;
    plan.entry = a.price;
    plan.stopLoss = std::min(volatilityStop, structuralStop);

    if (!(plan.stopLoss > 0.0 && plan.stopLoss < plan.entry)) return TradePlan{};

    const double risk = plan.entry - plan.stopLoss;
    const double rawTarget1 = plan.entry + risk * TARGET1_R_MULTIPLIER;
    const bool usableResistance = a.resistance > plan.entry + risk * MIN_TARGET1_RR;
    plan.target1 = usableResistance ? std::min(rawTarget1, a.resistance) : rawTarget1;
    plan.target2 = plan.entry + risk * TARGET2_R_MULTIPLIER;
    plan.riskRewardRatio = (plan.target1 - plan.entry) / risk;
    plan.available = std::isfinite(plan.riskRewardRatio) && plan.riskRewardRatio >= MIN_TARGET1_RR;
    return plan;
}

TradePlan buildBearishPlan(const AnalysisResult& a) {
    TradePlan plan;
    if (!validPrice(a.price)) return plan;

    const double atrBase = (std::isfinite(a.atr) && a.atr > 0.0) ? a.atr : a.price * 0.005;
    const double volatilityStop = a.price + atrBase * ATR_STOP_MULTIPLIER;
    double structuralStop = (a.resistance > a.price) ? a.resistance : volatilityStop;
    plan.entry = a.price;
    plan.stopLoss = std::max(volatilityStop, structuralStop);

    if (!(plan.stopLoss > plan.entry)) return TradePlan{};

    const double risk = plan.stopLoss - plan.entry;
    const double rawTarget1 = plan.entry - risk * TARGET1_R_MULTIPLIER;
    const bool usableSupport = a.support > 0.0 && a.support < plan.entry - risk * MIN_TARGET1_RR;
    plan.target1 = usableSupport ? std::max(rawTarget1, a.support) : rawTarget1;
    plan.target2 = plan.entry - risk * TARGET2_R_MULTIPLIER;
    plan.riskRewardRatio = (plan.entry - plan.target1) / risk;
    plan.available = std::isfinite(plan.riskRewardRatio) && plan.riskRewardRatio >= MIN_TARGET1_RR;
    return plan;
}

std::string setupName(double score) {
    if (score >= 85.0) return "STRONG";
    if (score >= ACTIONABLE_SCORE) return "QUALIFIED";
    if (score >= 50.0) return "WATCH";
    return "WAIT";
}

double clamp(double value, double low, double high) {
    return std::max(low, std::min(high, value));
}

int64_t estimateBarSeconds(const std::vector<Candle>& candles) {
    if (candles.size() < 2) return 300;
    std::vector<int64_t> deltas;
    const size_t start = candles.size() > 12 ? candles.size() - 12 : 1;
    for (size_t i = start; i < candles.size(); ++i) {
        const int64_t delta = candles[i].timestamp - candles[i - 1].timestamp;
        if (delta > 0) deltas.push_back(delta);
    }
    if (deltas.empty()) return 300;
    std::sort(deltas.begin(), deltas.end());
    return deltas[deltas.size() / 2];
}

std::vector<MarketForecast> buildMultiHorizonForecasts(
    const std::vector<Candle>& candles,
    const AnalysisResult& analysis,
    double bullishScore,
    double bearishScore) {

    const int horizons[] = {5, 15, 30, 60};
    const double currentWeights[] = {0.60, 0.50, 0.45, 0.40};
    std::vector<MarketForecast> forecasts;
    forecasts.reserve(4);

    if (candles.size() < 20 || !validPrice(analysis.price)) {
        return forecasts;
    }

    const int64_t barSeconds = estimateBarSeconds(candles);
    const double atrBase = (std::isfinite(analysis.atr) && analysis.atr > 0.0)
        ? analysis.atr : analysis.price * 0.0015;

    for (int i = 0; i < 4; ++i) {
        const int horizonMinutes = horizons[i];
        const int64_t horizonSeconds = static_cast<int64_t>(horizonMinutes) * 60;

        // Forecasts below the input bar size do not have enough time resolution
        // to be trustworthy; backend always uses 5m candles for this feature.
        if (barSeconds > horizonSeconds) continue;

        const int lookbackBars = std::max(1, static_cast<int>(
            std::ceil(static_cast<double>(horizonSeconds) / static_cast<double>(barSeconds))));
        if (candles.size() <= static_cast<size_t>(lookbackBars)) continue;

        const size_t anchorIndex = candles.size() - 1 - static_cast<size_t>(lookbackBars);
        const double anchorClose = candles[anchorIndex].close;
        if (!validPrice(anchorClose)) continue;

        const double returnPct = ((analysis.price - anchorClose) / anchorClose) * 100.0;
        const double scaledAtr = std::max(atrBase * std::sqrt(static_cast<double>(lookbackBars)), 1e-9);
        const double returnUnits = (analysis.price - anchorClose) / scaledAtr;
        const double momentumBias = clamp(std::tanh(returnUnits) * 1.0, -1.0, 1.0);
        const double baseBias = clamp((bullishScore - bearishScore) / 100.0, -1.0, 1.0);
        const double combinedBias = clamp(
            currentWeights[i] * baseBias + (1.0 - currentWeights[i]) * momentumBias,
            -1.0, 1.0);

        const double bull = clamp(50.0 + combinedBias * 50.0, 0.0, 100.0);
        const double bear = 100.0 - bull;
        const double strength = clamp(50.0 + std::abs(combinedBias) * 45.0, 50.0, 95.0);

        MarketForecast forecast;
        forecast.horizonMinutes = horizonMinutes;
        forecast.startTimestamp = candles.back().timestamp;
        forecast.endTimestamp = forecast.startTimestamp + horizonSeconds;
        forecast.bullishScore = bull;
        forecast.bearishScore = bear;
        forecast.strength = strength;
        forecast.available = true;

        if (bull >= 60.0 && bull - bear >= 10.0) {
            forecast.direction = "BULLISH";
        } else if (bear >= 60.0 && bear - bull >= 10.0) {
            forecast.direction = "BEARISH";
        } else {
            forecast.direction = "NEUTRAL";
        }

        std::ostringstream basis;
        basis << "Current directional score + " << lookbackBars
              << "-bar momentum (return " << jsonNumber(returnPct) << "%).";
        forecast.basis = basis.str();
        forecasts.push_back(forecast);
    }

    return forecasts;
}

} // namespace

Signal Strategy::evaluate(const std::vector<Candle>& candles, const AnalysisResult& analysis) const {
    Signal signal;
    signal.timestamp = candles.empty() ? 0 : candles.back().timestamp;

    const ScoreResult bull = scoreBullish(analysis);
    const ScoreResult bear = scoreBearish(analysis);
    signal.bullishScore = bull.score;
    signal.bearishScore = bear.score;
    signal.bullishPlan = buildBullishPlan(analysis);
    signal.bearishPlan = buildBearishPlan(analysis);
    signal.forecasts = buildMultiHorizonForecasts(candles, analysis, bull.score, bear.score);

    // Stronger gating: ACTIONABLE BUY/SELL are only produced when trend,
    // structure, volume, and RSI are all aligned. Weak or mixed regimes must
    // resolve to WAIT so the engine does not spam noisy trade alerts.
    const bool bullTrendValid = analysis.trend == Trend::BULLISH;
    const bool bullStructureValid = analysis.structureLabel == "Higher High / Higher Low";
    const bool bullRsiValid = analysis.rsi >= RSI_BULL_MIN && analysis.rsi <= RSI_BULL_MAX;
    const bool bullVolumeValid = analysis.volume == VolumeState::HIGH || analysis.volume == VolumeState::SPIKE;
    const bool bullQualified = bullTrendValid &&
                               bullStructureValid &&
                               bullRsiValid &&
                               bullVolumeValid &&
                               bull.score >= ACTIONABLE_SCORE &&
                               signal.bullishPlan.available;

    const bool bearTrendValid = analysis.trend == Trend::BEARISH;
    const bool bearStructureValid = analysis.structureLabel == "Lower High / Lower Low";
    const bool bearRsiValid = analysis.rsi >= RSI_BEAR_MIN && analysis.rsi <= RSI_BEAR_MAX;
    const bool bearVolumeValid = analysis.volume == VolumeState::HIGH || analysis.volume == VolumeState::SPIKE;
    const bool bearQualified = bearTrendValid &&
                               bearStructureValid &&
                               bearRsiValid &&
                               bearVolumeValid &&
                               bear.score >= ACTIONABLE_SCORE &&
                               signal.bearishPlan.available;

    // const bool bullStrong = bull.score > STRONG_SCORE && signal.bullishPlan.available;
    // const bool bearStrong = bear.score > STRONG_SCORE && signal.bearishPlan.available;
    // const bool bullActionable = bullQualified || bullStrong;
    // const bool bearActionable = bearQualified || bearStrong;

//(bullQualified && (!bearQualified || bull.score >= bear.score)) 
    if (bullQualified && (!bearQualified || bull.score >= bear.score)){
        signal.type = SignalType::BUY;
        signal.setup = setupName(bull.score);
        signal.confidence = bull.score;
        signal.hasLevels = true;
        signal.entry = signal.bullishPlan.entry;
        signal.stopLoss = signal.bullishPlan.stopLoss;
        signal.target1 = signal.bullishPlan.target1;
        signal.target2 = signal.bullishPlan.target2;
        signal.riskRewardRatio = signal.bullishPlan.riskRewardRatio;
        signal.reason = "Bullish setup qualified: " + std::to_string(bull.passed) + "/5 conditions passed.";
            //     signal.reason = (bullStrong && !bullQualified)
            // ? "Bullish strong setup: score " + jsonNumber(bull.score) + "/100."
            // : "Bullish setup qualified: " + std::to_string(bull.passed) + "/5 conditions passed.";
        return signal;
    }
//(bearQualified)
    if (bearQualified) {
        signal.type = SignalType::SELL;
        signal.setup = setupName(bear.score);
        signal.confidence = bear.score;
        signal.hasLevels = true;
        signal.entry = signal.bearishPlan.entry;
        signal.stopLoss = signal.bearishPlan.stopLoss;
        signal.target1 = signal.bearishPlan.target1;
        signal.target2 = signal.bearishPlan.target2;
        signal.riskRewardRatio = signal.bearishPlan.riskRewardRatio;
        signal.reason = "Bearish setup qualified: " + std::to_string(bear.passed) + "/5 conditions passed.";
            //     signal.reason = (bearStrong && !bearQualified)
            // ? "Bearish strong setup: score " + jsonNumber(bear.score) + "/100."
            // : "Bearish setup qualified: " + std::to_string(bear.passed) + "/5 conditions passed.";
        return signal;
    }

    signal.type = SignalType::WAIT;
    signal.hasLevels = false;

    if (bull.score >= bear.score) {
        signal.setup = setupName(bull.score);
        signal.confidence = bull.score;
        signal.reason = "WAIT — Bullish score " + jsonNumber(bull.score) + "/100. " +
                        joinMisses(bull.misses, "Missing/failed: ");
        if (!bullVolumeValid) {
            signal.reason = "WAIT — volume confirmation is weak. Bullish score " +
                            jsonNumber(bull.score) + "/100. " +
                            joinMisses(bull.misses, "Bullish blockers: ");
        }
    } else {
        signal.setup = setupName(bear.score);
        signal.confidence = bear.score;
        signal.reason = "WAIT — Bearish score " + jsonNumber(bear.score) + "/100. " +
                        joinMisses(bear.misses, "Bearish blockers: ");
        if (!bearVolumeValid) {
            signal.reason = "WAIT — volume confirmation is weak. Bearish score " +
                            jsonNumber(bear.score) + "/100. " +
                            joinMisses(bear.misses, "Bearish blockers: ");
        }
    }

    return signal;
}

#pragma once

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

// The action recommended by the quantitative engine for a given candle.
enum class SignalType {
    BUY,
    SELL,
    WAIT
};

inline std::string toString(SignalType type) {
    switch (type) {
        case SignalType::BUY:  return "BUY";
        case SignalType::SELL: return "SELL";
        case SignalType::WAIT: return "WAIT";
    }
    return "WAIT";
}

// A direction-specific trade plan. It can be displayed as a candidate plan
// even when the current snapshot is WAIT; only the main SignalType is
// considered actionable. This separation is useful for future futures and
// options layers where the underlying direction and derivative execution are
// separate decisions.
struct TradePlan {
    bool available = false;
    double entry = 0.0;
    double stopLoss = 0.0;
    double target1 = 0.0;
    double target2 = 0.0;
    double riskRewardRatio = 0.0;
};

// A forward-looking research forecast for a fixed horizon. These values are
// directional scores/strength indicators, not guaranteed future returns or
// probabilities. `startTimestamp` is anchored to the latest candle used by
// the engine so the UI can show an exact forecast window such as 11:00-11:15.
struct MarketForecast {
    int horizonMinutes = 0;
    int64_t startTimestamp = 0;
    int64_t endTimestamp = 0;
    std::string direction = "NEUTRAL";
    double bullishScore = 0.0;
    double bearishScore = 0.0;
    double strength = 0.0;
    bool available = false;
    std::string basis;
};

// A signal emitted by the engine for a specific point in time.
// Research/educational use only — not a real trading recommendation.
struct Signal {
    int64_t timestamp = 0;
    SignalType type = SignalType::WAIT;
    std::string reason;

    // Actionability is now score-based rather than requiring every filter.
    // A BUY/SELL still requires directional trend + structure and a minimum
    // score. This makes the live engine less brittle while preserving filters.
    double bullishScore = 0.0;
    double bearishScore = 0.0;
    double confidence = 0.0;
    std::string setup = "WAIT";

    // Populated for the selected BUY/SELL signal.
    bool hasLevels = false;
    double entry = 0.0;
    double stopLoss = 0.0;
    double target1 = 0.0;
    double target2 = 0.0;
    double riskRewardRatio = 0.0;

    // Always calculated when enough price/ATR information exists. These are
    // candidate plans for both directions, not simultaneous trade signals.
    TradePlan bullishPlan;
    TradePlan bearishPlan;

    // Multi-horizon directional forecasts anchored to this signal timestamp.
    std::vector<MarketForecast> forecasts;
};

inline std::string jsonEscape(const std::string& text) {
    std::string out;
    out.reserve(text.size());
    for (char c : text) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            default: out += c;
        }
    }
    return out;
}

inline std::string jsonNumber(double value) {
    char buffer[64];
    std::snprintf(buffer, sizeof(buffer), "%.2f", value);
    return buffer;
}

inline std::string planToJson(const TradePlan& plan) {
    if (!plan.available) return "null";
    return "{"
        "\"entry\":" + jsonNumber(plan.entry) + ","
        "\"stopLoss\":" + jsonNumber(plan.stopLoss) + ","
        "\"target1\":" + jsonNumber(plan.target1) + ","
        "\"target2\":" + jsonNumber(plan.target2) + ","
        "\"riskReward\":\"1:" + jsonNumber(plan.riskRewardRatio) + "\""
        "}";
}

inline std::string forecastToJson(const MarketForecast& forecast) {
    if (!forecast.available) return "null";
    return "{"
        "\"horizonMinutes\":" + std::to_string(forecast.horizonMinutes) + ","
        "\"startTimestamp\":" + std::to_string(forecast.startTimestamp) + ","
        "\"endTimestamp\":" + std::to_string(forecast.endTimestamp) + ","
        "\"direction\":\"" + jsonEscape(forecast.direction) + "\","
        "\"bullishScore\":" + jsonNumber(forecast.bullishScore) + ","
        "\"bearishScore\":" + jsonNumber(forecast.bearishScore) + ","
        "\"strength\":" + jsonNumber(forecast.strength) + ","
        "\"basis\":\"" + jsonEscape(forecast.basis) + "\""
        "}";
}

inline std::string forecastsToJson(const std::vector<MarketForecast>& forecasts) {
    std::string json = "[";
    for (size_t i = 0; i < forecasts.size(); ++i) {
        if (i > 0) json += ",";
        json += forecastToJson(forecasts[i]);
    }
    json += "]";
    return json;
}

// Serializes a Signal to a single-line JSON object. This is part of the
// engine <-> Node.js contract: stdout remains exactly one JSON line.
inline std::string toJson(const Signal& signal) {
    std::string reasonField = signal.reason.empty()
        ? "null"
        : "\"" + jsonEscape(signal.reason) + "\"";

    std::string levelsFields;
    if (signal.hasLevels) {
        levelsFields =
            "\"entry\":" + jsonNumber(signal.entry) + ","
            "\"stopLoss\":" + jsonNumber(signal.stopLoss) + ","
            "\"target1\":" + jsonNumber(signal.target1) + ","
            "\"target2\":" + jsonNumber(signal.target2) + ","
            "\"riskReward\":\"1:" + jsonNumber(signal.riskRewardRatio) + "\",";
    } else {
        levelsFields =
            "\"entry\":null,\"stopLoss\":null,\"target1\":null,"
            "\"target2\":null,\"riskReward\":null,";
    }

    return "{"
        "\"timestamp\":" + std::to_string(signal.timestamp) + ","
        "\"signal\":\"" + toString(signal.type) + "\"," +
        "\"setup\":\"" + jsonEscape(signal.setup) + "\"," +
        "\"bullishScore\":" + jsonNumber(signal.bullishScore) + ","
        "\"bearishScore\":" + jsonNumber(signal.bearishScore) + ","
        "\"confidence\":" + jsonNumber(signal.confidence) + "," +
        levelsFields +
        "\"plans\":{" +
            "\"bullish\":" + planToJson(signal.bullishPlan) + ","
            "\"bearish\":" + planToJson(signal.bearishPlan) + "}," +
        "\"forecasts\":" + forecastsToJson(signal.forecasts) + "," +
        "\"reason\":" + reasonField +
        "}";
}

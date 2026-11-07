import { resolveInstrument } from "../data/mockMarketData.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { listForecasts } from "../services/history.service.js";
import { getEngineSignal } from "../services/engine.service.js";

const VALID_TIMEFRAMES = new Set(["1m", "5m", "15m", "1h", "1d"]);

export async function getForecast(req, res, next) {
  try {
    const instrument = resolveInstrument(req.params.symbol);
    if (!instrument) throw new NotFoundError(`Unknown instrument "${req.params.symbol}"`);

    // Multi-horizon forecasts require 5-minute input bars so every requested
    // horizon (5/15/30/60 minutes) has adequate time resolution.
    const result = await getEngineSignal(instrument.key, "5m", 300);
    res.json({
      symbol: result.symbol,
      timeframe: "5m",
      dataSource: result.dataSource,
      generatedAt: result.candleTimestamp,
      timezone: "Asia/Kolkata",
      forecasts: (result.signal?.forecasts || []).map((forecast) => ({
        ...forecast,
        startAt: new Date(Number(forecast.startTimestamp) * 1000).toISOString(),
        endAt: new Date(Number(forecast.endTimestamp) * 1000).toISOString()
      }))
    });
  } catch (err) {
    next(err);
  }
}

export async function getForecastHistory(req, res, next) {
  try {
    const { symbol, timeframe = "5m", horizon, limit } = req.query;
    if (timeframe && !VALID_TIMEFRAMES.has(timeframe)) {
      throw new BadRequestError(`Invalid timeframe "${timeframe}"`);
    }
    if (horizon && ![5, 15, 30, 60].includes(Number(horizon))) {
      throw new BadRequestError("horizon must be one of 5, 15, 30, 60");
    }
    res.json({
      items: await listForecasts({ symbol, timeframe, horizon, limit })
    });
  } catch (err) {
    next(err);
  }
}

import { resolveInstrument, listInstruments } from "../data/mockMarketData.js";
import { getProviderQuote, getProviderCandles } from "../providers/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

const VALID_TIMEFRAMES = new Set(["1m", "5m", "15m", "1h", "1d"]);

// Phase 8: these now hit a real provider (Yahoo Finance) first, falling
// back to mock data on any failure — see backend/src/providers/index.js.
// Every response carries a `source` field ("yahoo-finance" or
// "mock-fallback") so the caller always knows which one it got.

export async function getIndices() {
  const instruments = listInstruments();
  return Promise.all(instruments.map((instrument) => getProviderQuote(instrument.key)));
}

export async function getIndexQuote(rawSymbol) {
  const instrument = resolveInstrument(rawSymbol);
  if (!instrument) {
    throw new NotFoundError(`Unknown instrument "${rawSymbol}"`);
  }
  return getProviderQuote(instrument.key);
}

export async function getIndexCandles(rawSymbol, timeframe = "5m", limit = 50) {
  const instrument = resolveInstrument(rawSymbol);
  if (!instrument) {
    throw new NotFoundError(`Unknown instrument "${rawSymbol}"`);
  }

  if (!VALID_TIMEFRAMES.has(timeframe)) {
    throw new BadRequestError(
      `Invalid timeframe "${timeframe}". Valid options: ${[...VALID_TIMEFRAMES].join(", ")}`
    );
  }

  const parsedLimit = Number(limit);
  const count = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 500)
    : 50;

  const { candles, source } = await getProviderCandles(instrument.key, timeframe, count);

  return {
    symbol: instrument.symbol,
    timeframe,
    source,
    candles
  };
}

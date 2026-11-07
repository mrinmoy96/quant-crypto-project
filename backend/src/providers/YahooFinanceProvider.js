// Phase 8: real market data via Yahoo Finance's public chart endpoint.
//
// This is an UNOFFICIAL, undocumented API — Yahoo doesn't publish a
// contract for it and it can change or start blocking requests without
// notice. It requires no auth/cookies (unlike NSE/BSE), and gives real
// intraday candles directly, which is why it was chosen over NSE/BSE's
// public endpoints. See docs/MARKET_DATA_SOURCE.md for the full
// reasoning and known limitations.

const YAHOO_SYMBOLS = {
  nifty: "%5ENSEI",  // ^NSEI, URL-encoded
  sensex: "%5EBSESN" // ^BSESN, URL-encoded
};

// Maps our timeframe options to a Yahoo interval + a safe range that
// respects Yahoo's known intraday history limits (1m: ~7 days,
// 5m/15m: ~60 days, 1h: ~2 years, 1d: unlimited-ish).
const TIMEFRAME_TO_YAHOO = {
  "1m": { interval: "1m", range: "5d" },
  "5m": { interval: "5m", range: "1mo" },
  "15m": { interval: "15m", range: "1mo" },
  "1h": { interval: "60m", range: "6mo" },
  "1d": { interval: "1d", range: "2y" }
};

const YAHOO_BASE_URL = "https://query1.finance.yahoo.com";
const REQUEST_TIMEOUT_MS = 8000;

// Allow overriding the base URL for testing against a local fixture
// server instead of the real Yahoo endpoint (see
// backend/test/providers.test.js).
export function createYahooFinanceProvider({ baseUrl = YAHOO_BASE_URL } = {}) {
  async function fetchChart(instrumentKey, { interval, range }) {
    const symbol = YAHOO_SYMBOLS[instrumentKey];
    if (!symbol) {
      throw new Error(`No Yahoo Finance symbol mapped for "${instrumentKey}"`);
    }

    const url = `${baseUrl}/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const response = await fetch(url, {
      headers: {
        // A realistic desktop browser UA — some reports of Yahoo
        // rate-limiting requests with no/default UA.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned HTTP ${response.status}`);
    }

    const body = await response.json();
    const result = body?.chart?.result?.[0];
    if (!result) {
      const yahooError = body?.chart?.error?.description;
      throw new Error(
        `Yahoo Finance response had no chart data${yahooError ? `: ${yahooError}` : ""}`
      );
    }
    return result;
  }

  async function getQuote(instrumentKey) {
    // 1-day/1m chart's `meta` block carries the live price + previous
    // close, which is all a "quote" needs — no separate quote endpoint.
    const result = await fetchChart(instrumentKey, { interval: "1m", range: "1d" });
    const meta = result.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") {
      throw new Error("Yahoo Finance chart response missing expected meta fields");
    }

    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: meta.symbol,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      timestamp: new Date((meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()
    };
  }

  async function getCandles(instrumentKey, timeframe = "5m", limit = 250) {
    const mapping = TIMEFRAME_TO_YAHOO[timeframe];
    if (!mapping) {
      throw new Error(`Unsupported timeframe "${timeframe}" for Yahoo Finance provider`);
    }

    const result = await fetchChart(instrumentKey, mapping);
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};

    const candles = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      // Yahoo intraday data commonly has null entries for bars with no
      // trades (e.g. outside market hours) — skip those rather than
      // feeding nulls into the engine.
      if ([open, high, low, close].some((v) => v === null || v === undefined)) {
        continue;
      }

      candles.push({
        timestamp: new Date(timestamps[i] * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: volume ?? 0
      });
    }

    // Most recent `limit` candles, oldest first (matches the mock
    // generator's ordering).
    return candles.slice(-limit);
  }

  return { getQuote, getCandles, source: "yahoo-finance" };
}

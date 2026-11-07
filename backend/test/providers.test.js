// Phase 8 provider tests.
//
// IMPORTANT: these tests run against a LOCAL fixture HTTP server, not
// the real Yahoo Finance API — this sandbox's network access doesn't
// reach query1.finance.yahoo.com. What this verifies is that the
// parsing, error handling, and fallback logic are mechanically correct
// against a realistic response shape (confirmed via multiple independent
// sources — see docs/MARKET_DATA_SOURCE.md). It does NOT verify Yahoo's
// actual current response shape, which can only be confirmed by running
// this against the real endpoint from an environment with internet
// access.
//
// Run with: node test/providers.test.js

import http from "http";
import assert from "assert";

import { createBinanceProvider } from "../src/providers/BinanceProvider.js";
import { createYahooFinanceProvider } from "../src/providers/YahooFinanceProvider.js";
import { createMockProvider } from "../src/providers/MockProvider.js";
import { listInstruments } from "../src/data/mockMarketData.js";

let failures = 0;

function check(condition, description) {
  if (!condition) {
    console.error(`FAILED: ${description}`);
    failures += 1;
  } else {
    console.log(`ok: ${description}`);
  }
}

// A realistic Yahoo chart response shape, confirmed against multiple
// independent, recently-published sources (see docs/MARKET_DATA_SOURCE.md).
function buildFixtureChartResponse({ withNulls = false } = {}) {
  const baseTs = 1700000000;
  const timestamps = [];
  const open = [];
  const high = [];
  const low = [];
  const close = [];
  const volume = [];

  for (let i = 0; i < 10; i += 1) {
    timestamps.push(baseTs + i * 300);
    if (withNulls && i === 3) {
      // Simulate a no-trade bar, which Yahoo represents as nulls.
      open.push(null);
      high.push(null);
      low.push(null);
      close.push(null);
      volume.push(null);
      continue;
    }
    const base = 25200 + i * 2;
    open.push(base);
    high.push(base + 5);
    low.push(base - 5);
    close.push(base + 1);
    volume.push(100000 + i * 1000);
  }

  return {
    chart: {
      result: [
        {
          meta: {
            symbol: "^NSEI",
            regularMarketPrice: close[close.length - 1],
            chartPreviousClose: 25190,
            regularMarketTime: timestamps[timestamps.length - 1]
          },
          timestamp: timestamps,
          indicators: { quote: [{ open, high, low, close, volume }] }
        }
      ],
      error: null
    }
  };
}

function startFixtureServer(responder) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      responder(req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function testYahooProviderParsesQuoteCorrectly() {
  const { server, baseUrl } = await startFixtureServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildFixtureChartResponse()));
  });

  try {
    const provider = createYahooFinanceProvider({ baseUrl });
    const quote = await provider.getQuote("nifty");
    check(quote.symbol === "^NSEI", "getQuote returns the symbol from the fixture meta block");
    check(typeof quote.price === "number" && quote.price > 0, "getQuote returns a numeric price");
    check(
      Math.abs(quote.change - (quote.price - 25190)) < 0.01,
      "getQuote computes change correctly from chartPreviousClose"
    );
  } finally {
    server.close();
  }
}

async function testYahooProviderParsesCandlesAndSkipsNulls() {
  const { server, baseUrl } = await startFixtureServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildFixtureChartResponse({ withNulls: true })));
  });

  try {
    const provider = createYahooFinanceProvider({ baseUrl });
    const candles = await provider.getCandles("nifty", "5m", 50);
    check(candles.length === 9, "getCandles skips the null (no-trade) bar (10 fixture bars -> 9 valid)");
    check(
      candles.every((c) => typeof c.close === "number"),
      "every returned candle has a numeric close"
    );
    check(
      new Date(candles[0].timestamp).getTime() < new Date(candles[candles.length - 1].timestamp).getTime(),
      "candles are in chronological order"
    );
  } finally {
    server.close();
  }
}

async function testYahooProviderThrowsOnHttpError() {
  const { server, baseUrl } = await startFixtureServer((req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ chart: { result: null, error: { description: "Internal error" } } }));
  });

  try {
    const provider = createYahooFinanceProvider({ baseUrl });
    let threw = false;
    try {
      await provider.getQuote("nifty");
    } catch {
      threw = true;
    }
    check(threw, "getQuote throws on a non-200 response");
  } finally {
    server.close();
  }
}

async function testYahooProviderThrowsOnMissingChartData() {
  const { server, baseUrl } = await startFixtureServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ chart: { result: [], error: null } }));
  });

  try {
    const provider = createYahooFinanceProvider({ baseUrl });
    let threw = false;
    try {
      await provider.getCandles("nifty", "5m", 50);
    } catch {
      threw = true;
    }
    check(threw, "getCandles throws when chart.result is empty");
  } finally {
    server.close();
  }
}

async function testMockProviderWorksAsEquivalentFallback() {
  const mockProvider = createMockProvider();
  const addedKeys = ["bnb", "trx", "hype", "link", "ada", "ltc"];
  const listedKeys = new Set(listInstruments().map((instrument) => instrument.key));
  const supportsEveryAddedCoin = await Promise.all(addedKeys.map(async (key) => {
    const quote = await mockProvider.getQuote(key);
    const candles = await mockProvider.getCandles(key, "5m", 30);
    return listedKeys.has(key) && quote.symbol.endsWith("/USDT") && candles.length === 30;
  }));
  check(supportsEveryAddedCoin.every(Boolean), "mock provider supports all six added crypto markets");
}

async function testBinanceProviderMapsAddedCoins() {
  const coins = [
    ["bnb", "BNB/USDT", "BNBUSDT"],
    ["trx", "TRX/USDT", "TRXUSDT"],
    ["hype", "HYPE/USDT", "HYPEUSDT"],
    ["link", "LINK/USDT", "LINKUSDT"],
    ["ada", "ADA/USDT", "ADAUSDT"],
    ["ltc", "LTC/USDT", "LTCUSDT"]
  ];
  const requestedSymbols = [];
  const { server, baseUrl } = await startFixtureServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    requestedSymbols.push(url.searchParams.get("symbol"));
    res.writeHead(200, { "Content-Type": "application/json" });
    if (url.pathname.endsWith("/ticker/24hr")) {
      res.end(JSON.stringify({ lastPrice: "1", priceChange: "0.1", priceChangePercent: "10" }));
    } else {
      res.end(JSON.stringify([[0, "1", "2", "0.5", "1.5", "100"]]));
    }
  });

  try {
    const provider = createBinanceProvider({ baseUrl });
    for (const [key, expectedPair] of coins) {
      const quote = await provider.getQuote(key);
      const candles = await provider.getCandles(key, "5m", 1);
      check(quote.symbol === expectedPair && candles.length === 1,
        `Binance provider supports ${expectedPair} quotes and candles`);
    }
    check(coins.every(([, , binanceSymbol]) => requestedSymbols.filter((symbol) => symbol === binanceSymbol).length === 2),
      "Binance provider sends the correct symbol for each added market");
  } finally {
    server.close();
  }
}

async function main() {
  await testYahooProviderParsesQuoteCorrectly();
  await testYahooProviderParsesCandlesAndSkipsNulls();
  await testYahooProviderThrowsOnHttpError();
  await testYahooProviderThrowsOnMissingChartData();
  await testMockProviderWorksAsEquivalentFallback();
  await testBinanceProviderMapsAddedCoins();

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll tests passed");
}

main();

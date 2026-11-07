// Thin fetch wrapper around the Phase 3 Node.js API.
// No business logic here — just HTTP calls. Components/hooks decide how
// to use the data.

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5015";

async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message || `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export function getHealth() {
  return request("/api/health");
}

export function getIndices() {
  return request("/api/market/indices");
}

export function getQuote(symbol) {
  return request(`/api/market/${symbol}`);
}

export function getCandles(symbol, timeframe = "5m", limit = 50) {
  return request(`/api/market/${symbol}/candles?timeframe=${timeframe}&limit=${limit}`);
}

export function getSignals() {
  return request("/api/signals");
}

export function getSignal(symbol) {
  return request(`/api/signals/${symbol}`);
}

export async function getEngineSignals() {
  const results = await Promise.all([
    getEngineSignal("nifty"),
    getEngineSignal("sensex")
  ]);

  return results.map((result) => ({
    symbol: result.symbol,
    ...result.signal,
    dataSource: result.dataSource
  }));
}

export function getEngineSignal(symbol, timeframe = "5m", limit = 250) {
  return request(`/api/engine/${symbol}?timeframe=${timeframe}&limit=${limit}`);
}

export function getHistorySignals(query = "?limit=50") {
  return request(`/api/history/signals${query}`);
}

export function getTradeHistory(query = "?limit=50") {
  return request(`/api/history/trades${query}`);
}

export function getTradePlans(query = "?limit=50") {
  return request(`/api/history/plans${query}`);
}

export function getHistoryAnalytics() {
  return request("/api/history/analytics");
}

export function runBacktest(payload) {
  return fetch(`${API_BASE_URL}/api/backtest/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Backtest failed: ${response.status}`);
    return body;
  });
}

export function getBacktestRuns(limit = 10) {
  return request(`/api/backtest/runs?limit=${limit}`);
}

export function getBacktestRun(id) {
  return request(`/api/backtest/runs/${id}`);
}

export function getPaperTrades(query = "?status=OPEN&limit=50") {
  return request(`/api/paper-trades${query}`);
}

export function createPaperTrade(payload) {
  return fetch(`${API_BASE_URL}/api/paper-trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Paper trade failed: ${response.status}`);
    return body;
  });
}

export function createPaperTradeFromSignal(symbol, timeframe = "5m") {
  return fetch(`${API_BASE_URL}/api/paper-trades/from-signal/${symbol}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeframe })
  }).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Paper trade failed: ${response.status}`);
    return body;
  });
}

export function closePaperTrade(id, payload) {
  return fetch(`${API_BASE_URL}/api/paper-trades/${id}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Close paper trade failed: ${response.status}`);
    return body;
  });
}


export function getForecast(symbol) {
  return request(`/api/forecasts/${symbol}`);
}

export function getForecastHistory(query = "?limit=100") {
  return request(`/api/forecasts/history${query}`);
}

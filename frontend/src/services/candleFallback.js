const TIMEFRAME_MINUTES = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '1d': 1440,
};

const BASE_PRICES = {
  btc: 110000,
  eth: 4000,
  zec: 50,
  bch: 550,
  sol: 220,
  xrp: 3,
  doge: 0.25,
  bnb: 700,
  trx: 0.3,
  hype: 40,
  link: 20,
  ada: 0.8,
  ltc: 100,
};

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function buildFallbackCandles(symbol = 'btc', timeframe = '5m', count = 250) {
  const key = String(symbol || 'btc').trim().toLowerCase();
  const basePrice = BASE_PRICES[key] ?? BASE_PRICES.btc;
  const step = (TIMEFRAME_MINUTES[timeframe] || 5) * 60 * 1000;
  const seed = hashString(`${key}-${timeframe}`);
  const rand = seededRandom(seed);

  let close = basePrice;
  const volatility = basePrice * 0.015;
  const baseTime = Date.UTC(2024, 0, 1, 0, 0, 0) + (seed % 3600000);
  const candles = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const open = close;
    close = Math.max(basePrice * 0.01, open + (rand() - 0.48) * volatility);
    const high = Math.max(open, close) + rand() * volatility * 0.6;
    const low = Math.min(open, close) - rand() * volatility * 0.6;

    candles.push({
      timestamp: new Date(baseTime - i * step).toISOString(),
      open: Number(open.toFixed(8)),
      high: Number(high.toFixed(8)),
      low: Number(low.toFixed(8)),
      close: Number(close.toFixed(8)),
      volume: Math.round(1000 + rand() * 100000),
    });
  }

  return candles;
}

// The api.binance.com hostname times out in some networks even when the
// public market-data API is reachable. Binance maintains this read-only
// data host for public market endpoints such as ticker and klines.
const BINANCE_BASE_URL = "https://data-api.binance.vision";
const SYMBOLS = { btc:"BTCUSDT", eth:"ETHUSDT", zec:"ZECUSDT", bch:"BCHUSDT", sol:"SOLUSDT", xrp:"XRPUSDT", doge:"DOGEUSDT", bnb:"BNBUSDT", trx:"TRXUSDT", hype:"HYPEUSDT", link:"LINKUSDT", ada:"ADAUSDT", ltc:"LTCUSDT", xau:"PAXGUSDT" };
const DISPLAY_SYMBOLS = { xau: "XAU/USDT" };
const DISPLAY_NAMES = { xau: "Gold (PAXG)" };
const INTERVALS={"1m":"1m","5m":"5m","15m":"15m","1h":"1h","1d":"1d"};
export function createBinanceProvider({baseUrl=BINANCE_BASE_URL}={}){
 async function getQuote(key){ const symbol=SYMBOLS[key]; if(!symbol) throw new Error(`No Binance symbol mapped for ${key}`); const r=await fetch(`${baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`,{signal:AbortSignal.timeout(8000)}); if(!r.ok) throw new Error(`Binance HTTP ${r.status}`); const d=await r.json(); return {symbol:DISPLAY_SYMBOLS[key]||`${symbol.slice(0,-4)}/USDT`,name:DISPLAY_NAMES[key]||key,price:Number(d.lastPrice),change:Number(d.priceChange),changePercent:Number(d.priceChangePercent),timestamp:new Date().toISOString()}; }
 async function getCandles(key,timeframe="5m",limit=250){const symbol=SYMBOLS[key], interval=INTERVALS[timeframe]; if(!symbol||!interval)throw new Error(`Unsupported Binance market/timeframe`); const r=await fetch(`${baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(Number(limit)||250,1000)}`,{signal:AbortSignal.timeout(8000)}); if(!r.ok)throw new Error(`Binance HTTP ${r.status}`); const rows=await r.json(); return rows.map(x=>({timestamp:new Date(Number(x[0])).toISOString(),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])})); }
 return {getQuote,getCandles,source:"binance"};
}

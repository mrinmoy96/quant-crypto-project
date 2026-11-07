// Crypto market catalogue + deterministic fallback candles.
export const INSTRUMENTS = {
  btc: { symbol: "BTC/USDT", key: "btc", basePrice: 110000, binanceSymbol: "BTCUSDT", name: "Bitcoin" },
  eth: { symbol: "ETH/USDT", key: "eth", basePrice: 4000, binanceSymbol: "ETHUSDT", name: "Ethereum" },
  zec: { symbol: "ZEC/USDT", key: "zec", basePrice: 50, binanceSymbol: "ZECUSDT", name: "Zcash" },
  bch: { symbol: "BCH/USDT", key: "bch", basePrice: 550, binanceSymbol: "BCHUSDT", name: "Bitcoin Cash" },
  sol: { symbol: "SOL/USDT", key: "sol", basePrice: 220, binanceSymbol: "SOLUSDT", name: "Solana" },
  xrp: { symbol: "XRP/USDT", key: "xrp", basePrice: 3, binanceSymbol: "XRPUSDT", name: "XRP" },
  doge: { symbol: "DOGE/USDT", key: "doge", basePrice: 0.25, binanceSymbol: "DOGEUSDT", name: "Dogecoin" },
  bnb: { symbol: "BNB/USDT", key: "bnb", basePrice: 700, binanceSymbol: "BNBUSDT", name: "BNB" },
  trx: { symbol: "TRX/USDT", key: "trx", basePrice: 0.3, binanceSymbol: "TRXUSDT", name: "TRON" },
  hype: { symbol: "HYPE/USDT", key: "hype", basePrice: 40, binanceSymbol: "HYPEUSDT", name: "Hyperliquid" },
  link: { symbol: "LINK/USDT", key: "link", basePrice: 20, binanceSymbol: "LINKUSDT", name: "Chainlink" },
  ada: { symbol: "ADA/USDT", key: "ada", basePrice: 0.8, binanceSymbol: "ADAUSDT", name: "Cardano" },
  ltc: { symbol: "LTC/USDT", key: "ltc", basePrice: 100, binanceSymbol: "LTCUSDT", name: "Litecoin" },
  xau: { symbol: "XAU/USDT", key: "xau", basePrice: 4050, binanceSymbol: "PAXGUSDT", name: "Gold (PAXG)" }
};
export function resolveInstrument(rawSymbol) {
  const key = String(rawSymbol || "").trim().toLowerCase().replace(/[-/\s]/g, "").replace("usdt", "");
  return INSTRUMENTS[key] || Object.values(INSTRUMENTS).find(i => i.symbol.toLowerCase() === String(rawSymbol).toLowerCase()) || null;
}
export function listInstruments() { return Object.values(INSTRUMENTS); }
function seededRandom(seed) { let value = seed % 2147483647; if (value <= 0) value += 2147483646; return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; }; }
function hashString(str) { let hash = 0; for (let i=0;i<str.length;i++) hash=(hash*31+str.charCodeAt(i))|0; return Math.abs(hash)||1; }
const TIMEFRAME_MINUTES={"1m":1,"5m":5,"15m":15,"1h":60,"1d":1440};
export function generateCandles(key,timeframe="5m",count=250){ const ins=INSTRUMENTS[key]; if(!ins)return[]; const rand=seededRandom(hashString(`${key}-${timeframe}`)); const step=(TIMEFRAME_MINUTES[timeframe]||5)*60000; let close=ins.basePrice; const vol=ins.basePrice*0.002; const now=Date.now(); const out=[]; for(let i=count-1;i>=0;i--){const open=close; close=Math.max(ins.basePrice*0.01,open+(rand()-.48)*vol); const high=Math.max(open,close)+rand()*vol*.6; const low=Math.min(open,close)-rand()*vol*.6; out.push({timestamp:new Date(now-i*step).toISOString(),open:+open.toFixed(8),high:+high.toFixed(8),low:+low.toFixed(8),close:+close.toFixed(8),volume:Math.round(1000+rand()*100000)});} return out; }
export function getQuote(key){const c=generateCandles(key,"5m",2),a=c.at(-1),p=c[0],change=a.close-p.close;return{symbol:INSTRUMENTS[key].symbol,name:INSTRUMENTS[key].name,price:a.close,change:+change.toFixed(8),changePercent:+((change/p.close)*100).toFixed(2),timestamp:a.timestamp};}
export function getMockSignal(key){return {symbol:INSTRUMENTS[key]?.symbol,signal:"WAIT",entry:null,stopLoss:null,target1:null,target2:null,riskReward:null,context:{trend:"Sideways",vwap:"Near",ema:"Neutral",volume:"Normal",structure:"Waiting for confirmation"},reason:"Mock fallback data is active."};}

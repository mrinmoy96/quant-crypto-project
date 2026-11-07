import { useEffect, useMemo, useState } from "react";
import { getCandles, getEngineSignal, getQuote as getMarketQuote } from "./services/api";
import { buildFallbackCandles } from "./services/candleFallback";
import CryptoChart from "./components/CryptoChart";
import { useLiveMarketData } from "./hooks/useLiveMarketData";
import { formatForecastCards, getForecastDisclaimer } from "./utils/forecast";
import { buildTimeframeStrategies } from "./utils/strategy";

const COINS=[
 {key:"btc",name:"Bitcoin",symbol:"BTC/USDT"},{key:"eth",name:"Ethereum",symbol:"ETH/USDT"},{key:"zec",name:"Zcash",symbol:"ZEC/USDT"},{key:"bch",name:"Bitcoin Cash",symbol:"BCH/USDT"},{key:"sol",name:"Solana",symbol:"SOL/USDT"},{key:"xrp",name:"XRP",symbol:"XRP/USDT"},{key:"doge",name:"Dogecoin",symbol:"DOGE/USDT"},
 {key:"bnb",name:"BNB",symbol:"BNB/USDT"},{key:"trx",name:"TRON",symbol:"TRX/USDT"},{key:"hype",name:"Hyperliquid",symbol:"HYPE/USDT"},{key:"link",name:"Chainlink",symbol:"LINK/USDT"},{key:"ada",name:"Cardano",symbol:"ADA/USDT"},{key:"ltc",name:"Litecoin",symbol:"LTC/USDT"},{key:"xau",name:"Gold (PAXG)",symbol:"XAU/USDT"}
];
const TIMEFRAMES=["1m","5m","15m","1h","1d"];
export default function App(){
 const [query,setQuery]=useState(""); const [selected,setSelected]=useState("btc"); const [timeframe,setTimeframe]=useState("5m"); const [candles,setCandles]=useState([]); const [engine,setEngine]=useState(null); const [quote,setQuote]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const {instruments,connected}=useLiveMarketData();
 const coin=COINS.find(c=>c.key===selected)||COINS[0];
 const filtered=useMemo(()=>COINS.filter(c=>`${c.name} ${c.symbol} ${c.key}`.toLowerCase().includes(query.toLowerCase())),[query]);
 async function load(){
   setLoading(true);
   setError("");
   try {
     const [c, e] = await Promise.all([
       getCandles(selected, timeframe, 250).catch(() => ({ candles: buildFallbackCandles(selected, timeframe, 250) })),
       getEngineSignal(selected, timeframe, 250).catch(() => ({
         symbol: coin.symbol,
         signal: { signal: "WAIT", reason: "Fallback signal: chart data is using local demo candles." },
         analysis: { trend: "Neutral", structureLabel: "Waiting for confirmation", support: null, resistance: null },
         dataSource: "local-fallback"
       }))
     ]);
     setCandles(c.candles || buildFallbackCandles(selected, timeframe, 250));
     setEngine(e);
   } catch (err) {
     setError(err.message);
     setCandles(buildFallbackCandles(selected, timeframe, 250));
   } finally {
     setLoading(false);
   }
 }
 useEffect(()=>{load()},[selected,timeframe]);
 useEffect(()=>{
   let active=true;
   const refreshQuote=async()=>{
     try {
       const latestQuote=await getMarketQuote(selected);
       if(active)setQuote(latestQuote);
     } catch {
       if(active)setQuote(null);
     }
   };
   setQuote(null);
   refreshQuote();
   const timer=setInterval(refreshQuote,5000);
   return()=>{active=false;clearInterval(timer)};
 },[selected]);
 const live=instruments?.[selected]; const price=quote?.price ?? live?.analysis?.price ?? candles.at(-1)?.close; const signal=live?.signal||engine?.signal; const analysis=live?.analysis||engine?.analysis; const forecastCards = formatForecastCards(signal?.forecasts || []); const strategyRows = buildTimeframeStrategies(signal, price);
 return <main className="crypto-page"><header className="topbar"><div><div className="brand">QUANT<span>CRYPTO</span></div><p>Live quantitative market research terminal</p></div><div className={`connection ${connected?'live':''}`}><span/> {connected?'LIVE FEED':'CONNECTING'}</div></header>
 <section className="selector"><div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search crypto: BTC, ETH, BCH, ZEC…"/><kbd>/</kbd></div><div className="coin-list">{filtered.map(c=><button className={c.key===selected?'coin active':''} onClick={()=>{setSelected(c.key);setQuery("")}} key={c.key}><b>{c.name}</b><small>{c.symbol}</small></button>)}{!filtered.length&&<span className="no-results">No matching crypto</span>}</div></section>
 <section className="hero"><div><div className="asset-title"><h1>{coin.name}</h1><span>{coin.symbol}</span></div><div className="price-big">{price!=null?Number(price).toLocaleString(undefined,{maximumFractionDigits:8}):'—'} <small>USDT</small></div><div className="meta">24/7 crypto market · {timeframe} candles · source: {quote?.source||live?.dataSource||engine?.dataSource||'loading'}</div></div><div className={`signal-pill ${String(signal?.signal||'WAIT').toLowerCase()}`}><small>C++ QUANT SIGNAL</small><strong>{signal?.signal||'WAIT'}</strong><span>{signal?.confidence!=null?`${Number(signal.confidence).toFixed(0)}% confidence`:''}</span></div></section>
 <div className="timeframe-row">{TIMEFRAMES.map(t=><button className={t===timeframe?'tf active':''} onClick={()=>setTimeframe(t)} key={t}>{t}</button>)}<button className="refresh" onClick={load}>↻ Refresh</button></div>
 {error&&<div className="error-box">{error}</div>}
 {loading&&!candles.length?<div className="loading">Loading {coin.symbol} market data…</div>:<CryptoChart candles={candles} analysis={analysis} signal={signal} symbol={coin.symbol} timeframe={timeframe}/>} 
 <section className="engine-grid"><div className="panel"><h3>Market structure</h3><div className="metric"><span>Trend</span><b>{analysis?.trend||'—'}</b></div><div className="metric"><span>Structure</span><b>{analysis?.structureLabel||'—'}</b></div><div className="metric"><span>Volume</span><b>{analysis?.volume||'—'}</b></div><div className="metric"><span>Support</span><b>{analysis?.support?Number(analysis.support).toLocaleString(): '—'}</b></div><div className="metric"><span>Resistance</span><b>{analysis?.resistance?Number(analysis.resistance).toLocaleString(): '—'}</b></div></div><div className="panel"><h3>Signal engine</h3><div className="scores"><div><span>Bullish</span><b>{signal?.bullishScore??'—'}</b></div><div><span>Bearish</span><b>{signal?.bearishScore??'—'}</b></div></div><p className="reason">{signal?.reason||'The C++ engine is evaluating price, trend, structure, volatility and volume.'}</p>{signal?.entry&&<div className="levels"><span>Entry <b>{signal.entry}</b></span><span>SL <b>{signal.stopLoss}</b></span><span>TP1 <b>{signal.target1}</b></span><span>TP2 <b>{signal.target2}</b></span></div>}</div></section>
 <section className="forecast-panel">
   <h3>Multi-horizon market forecast</h3>
   <p className="forecast-note">Windows are anchored to the latest 5-minute candle.</p>
   <div className="forecast-grid">
     {forecastCards.map((forecast) => (
       <div className={`forecast-card ${forecast.direction.toLowerCase()}`} key={`${forecast.title}-${forecast.timeRange}`}>
         <div className="forecast-header">
           <strong>{forecast.title}</strong>
           <span className={`forecast-direction ${forecast.direction.toLowerCase()}`}>{forecast.direction}</span>
         </div>
         <div className="forecast-time">{forecast.timeRange}</div>
         <div className="forecast-metrics">
           <span>Bull {forecast.bullishScore}</span>
           <span>Bear {forecast.bearishScore}</span>
           <span>Strength {forecast.strength}%</span>
         </div>
         <div className="forecast-status">{forecast.expired ? 'EXPIRED' : 'ACTIVE'}</div>
         <div className="forecast-basis">{forecast.basis}</div>
       </div>
     ))}
   </div>
   <p className="forecast-disclaimer">{getForecastDisclaimer()}</p>
 </section>
 <section className="strategy-panel">
   <h3>Multi-timeframe bullish & bearish strategy</h3>
   <div className="strategy-grid">
     {strategyRows.map((row) => (
       <div className="strategy-card" key={row.label}>
         <div className="strategy-header">{row.label}</div>
         <div className="strategy-body">
           <div className="strategy-side bullish">
             <div className="strategy-side-header">Bullish</div>
             <div className="strategy-score">{row.bullish.score.toFixed(0)}</div>
             <div className="strategy-line">Entry: {Number(row.bullish.entry).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
             <div className="strategy-line">SL: {Number(row.bullish.stopLoss).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
             <div className="strategy-line">TP1: {Number(row.bullish.target1).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
             <div className="strategy-line">TP2: {Number(row.bullish.target2).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
           </div>
           <div className="strategy-side bearish">
             <div className="strategy-side-header">Bearish</div>
             <div className="strategy-score">{row.bearish.score.toFixed(0)}</div>
             <div className="strategy-line">Entry: {Number(row.bearish.entry).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
             <div className="strategy-line">SL: {Number(row.bearish.stopLoss).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
             <div className="strategy-line">TP1: {Number(row.bearish.target1).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
             <div className="strategy-line">TP2: {Number(row.bearish.target2).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
           </div>
         </div>
       </div>
     ))}
   </div>
 </section>
 <footer>Research dashboard only. Signals and plotted levels are generated by the quantitative engine and are not guaranteed future outcomes.</footer>
 </main>
}

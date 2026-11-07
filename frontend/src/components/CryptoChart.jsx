import { useMemo } from "react";

function ema(values, period){
  if(!values.length)return[]; const k=2/(period+1); let prev=values[0]; return values.map((v,i)=>{if(i===0)return prev; prev=v*k+prev*(1-k); return prev;});
}
function rsi(values,period=14){
  const out=Array(values.length).fill(null); if(values.length<=period)return out; let gains=0,losses=0; for(let i=1;i<=period;i++){const d=values[i]-values[i-1]; gains+=Math.max(d,0); losses+=Math.max(-d,0);} let avgG=gains/period,avgL=losses/period; out[period]=avgL===0?100:100-100/(1+avgG/avgL); for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgG=(avgG*(period-1)+Math.max(d,0))/period;avgL=(avgL*(period-1)+Math.max(-d,0))/period;out[i]=avgL===0?100:100-100/(1+avgG/avgL);} return out;
}
function vwap(candles){let pv=0,v=0;return candles.map(c=>{const typical=(c.high+c.low+c.close)/3;pv+=typical*c.volume;v+=c.volume;return pv/v;});}
function fmt(n){if(n>=1000)return n.toLocaleString(undefined,{maximumFractionDigits:2});if(n>=1)return n.toFixed(2);return n.toFixed(5);}
export default function CryptoChart({candles=[],analysis,signal, symbol, timeframe}){
 const data=useMemo(()=>{const sliced=candles.slice(-120);const closes=sliced.map(c=>c.close);return{candles:sliced,ema20:ema(closes,20),ema50:ema(closes,50),ema200:ema(closes,200),vwap:vwap(sliced),rsi:rsi(closes)}} ,[candles]);
 const W=1100,H=560,left=64,right=18,top=24,priceH=390,rsiTop=430,rsiH=95; const all=data.candles.flatMap(c=>[c.low,c.high]).concat([analysis?.support,analysis?.resistance]).filter(Number.isFinite); if(!data.candles.length)return <div className="chart-empty">Waiting for candle data…</div>;
 const min=Math.min(...all),max=Math.max(...all),pad=(max-min)*.06||1; const lo=min-pad,hi=max+pad; const x=i=>left+i*(W-left-right)/Math.max(1,data.candles.length-1); const y=p=>top+(hi-p)*(priceH)/(hi-lo); const ry=v=>rsiTop+(100-(v??50))*rsiH/100;
 const path=(arr, mapper=y)=>arr.map((v,i)=>v==null?null:`${i?'L':'M'} ${x(i).toFixed(1)} ${mapper(v).toFixed(1)}`).filter(Boolean).join(' ');
 const last=data.candles.length-1; const current=data.candles[last].close; const signalType=signal?.signal||"WAIT";
 return <div className="chart-shell">
   <div className="chart-toolbar"><div><b>{symbol}</b><span>{timeframe}</span></div><div className="legend"><i/>EMA20 <i/>EMA50 <i/>EMA200 <i/>VWAP</div></div>
   <div className="chart-wrap"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${symbol} candlestick chart`}>
    <rect x="0" y="0" width={W} height={H} fill="#0b1220" rx="12"/>
    {[0,.25,.5,.75,1].map((q)=><g key={q}><line x1={left} x2={W-right} y1={top+q*priceH} y2={top+q*priceH} className="gridline"/><text x="8" y={top+q*priceH+4} className="axis">{fmt(hi-q*(hi-lo))}</text></g>)}
    {data.candles.map((c,i)=>{const xx=x(i),cw=Math.max(2,(W-left-right)/data.candles.length*.62),bull=c.close>=c.open;return <g key={c.timestamp}><line x1={xx} x2={xx} y1={y(c.high)} y2={y(c.low)} className={bull?'candle-up':'candle-down'}/><rect x={xx-cw/2} y={Math.min(y(c.open),y(c.close))} width={cw} height={Math.max(1,Math.abs(y(c.open)-y(c.close)))} className={bull?'body-up':'body-down'}/></g>})}
    {Number.isFinite(analysis?.support)&&<><line x1={left} x2={W-right} y1={y(analysis.support)} y2={y(analysis.support)} className="support-line"/><text x={W-right-80} y={y(analysis.support)-5} className="support-label">SUP {fmt(analysis.support)}</text></>}
    {Number.isFinite(analysis?.resistance)&&<><line x1={left} x2={W-right} y1={y(analysis.resistance)} y2={y(analysis.resistance)} className="resistance-line"/><text x={W-right-110} y={y(analysis.resistance)-5} className="resistance-label">RES {fmt(analysis.resistance)}</text></>}
    <path d={path(data.ema20)} className="line-ema20"/><path d={path(data.ema50)} className="line-ema50"/><path d={path(data.ema200)} className="line-ema200"/><path d={path(data.vwap)} className="line-vwap"/>
    {(signalType==='BUY'||signalType==='SELL')&&<g><circle cx={x(last)} cy={y(current)} r="8" className={signalType==='BUY'?'signal-buy':'signal-sell'}/><rect x={x(last)-48} y={y(current)+(signalType==='BUY'?14:-34)} width="96" height="24" rx="6" className={signalType==='BUY'?'signal-box-buy':'signal-box-sell'}/><text x={x(last)} y={y(current)+(signalType==='BUY'?31:-17)} textAnchor="middle" className="signal-text">C++ {signalType}</text></g>}
    <line x1={left} x2={W-right} y1={rsiTop-12} y2={rsiTop-12} className="separator"/><text x="8" y={rsiTop+10} className="axis">RSI</text><line x1={left} x2={W-right} y1={ry(70)} y2={ry(70)} className="rsi-guide"/><line x1={left} x2={W-right} y1={ry(30)} y2={ry(30)} className="rsi-guide"/><path d={path(data.rsi,ry)} className="line-rsi"/><text x={W-right-42} y={ry(data.rsi[last])+4} className="rsi-value">{data.rsi[last]?.toFixed(1)??'—'}</text>
   </svg></div>
   <div className="chart-stats"><span>Price <b>{fmt(current)}</b></span><span>EMA20 <b>{fmt(data.ema20[last])}</b></span><span>EMA50 <b>{fmt(data.ema50[last])}</b></span><span>EMA200 <b>{fmt(data.ema200[last])}</b></span><span>VWAP <b>{fmt(data.vwap[last])}</b></span><span>RSI <b>{data.rsi[last]?.toFixed(1)??'—'}</b></span></div>
 </div>
}

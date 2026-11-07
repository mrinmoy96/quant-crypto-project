import { useState } from "react";
import { runBacktest } from "../services/api";

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function BacktestPanel() {
  const [form, setForm] = useState({
    symbol: "NIFTY",
    timeframe: "5m",
    initialCapital: 100000,
    riskPerTrade: 0.01,
    slippageBps: 0,
    feePerTrade: 0
  });
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setRunning(true);
    setError("");
    try {
      setResult(await runBacktest(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="tool-panel">
      <div className="tool-head">
        <div>
          <h2>Phase 11 — Backtesting</h2>
          <p>Replays historical candles through the same C++ engine. The demo dataset is synthetic and for software testing only.</p>
        </div>
      </div>

      <form className="backtest-form" onSubmit={submit}>
        <label>Symbol
          <select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}>
            <option>NIFTY</option>
            <option>SENSEX</option>
          </select>
        </label>
        <label>Timeframe
          <select value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })}>
            <option>5m</option>
            <option>15m</option>
            <option>1h</option>
            <option>1d</option>
          </select>
        </label>
        <label>Initial capital
          <input type="number" min="1000" value={form.initialCapital} onChange={(e) => setForm({ ...form, initialCapital: Number(e.target.value) })} />
        </label>
        <label>Risk / trade
          <input type="number" min="0.001" max="0.1" step="0.001" value={form.riskPerTrade} onChange={(e) => setForm({ ...form, riskPerTrade: Number(e.target.value) })} />
        </label>
        <label>Slippage (bps)
          <input type="number" min="0" step="0.1" value={form.slippageBps} onChange={(e) => setForm({ ...form, slippageBps: Number(e.target.value) })} />
        </label>
        <label>Fee / trade
          <input type="number" min="0" step="0.01" value={form.feePerTrade} onChange={(e) => setForm({ ...form, feePerTrade: Number(e.target.value) })} />
        </label>
        <button className="primary-button" type="submit" disabled={running}>
          {running ? "Running…" : "Run Backtest"}
        </button>
      </form>

      {error && <div className="tool-error">{error}</div>}

      {result && (
        <>
          <div className="analytics-grid">
            <div><span>Total Trades</span><b>{result.totalTrades}</b></div>
            <div><span>Win Rate</span><b>{Number(result.winRate).toFixed(1)}%</b></div>
            <div><span>Total P&L</span><b>{money(result.totalPnl)}</b></div>
            <div><span>Return</span><b>{Number(result.returnPct).toFixed(2)}%</b></div>
            <div><span>Max DD</span><b>{money(result.maxDrawdown)}</b></div>
            <div><span>Profit Factor</span><b>{result.profitFactor == null ? "—" : Number(result.profitFactor).toFixed(2)}</b></div>
          </div>

          <h3 className="history-section-title">Simulated trades</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Direction</th><th>Entry</th><th>Exit</th><th>Reason</th><th>Qty</th><th>P&L</th><th>R</th></tr></thead>
              <tbody>
                {result.trades.map((trade, index) => (
                  <tr key={`${trade.entryTime}-${index}`}>
                    <td>{trade.direction}</td>
                    <td>{money(trade.entryPrice)}</td>
                    <td>{money(trade.exitPrice)}</td>
                    <td>{trade.exitReason}</td>
                    <td>{trade.quantity}</td>
                    <td>{money(trade.pnl)}</td>
                    <td>{Number(trade.rMultiple).toFixed(2)}R</td>
                  </tr>
                ))}
                {!result.trades.length && <tr><td colSpan="7">No actionable trades in this dataset.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

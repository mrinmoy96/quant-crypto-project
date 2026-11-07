import { useCallback, useEffect, useState } from "react";
import { getHistoryAnalytics, getHistorySignals, getTradeHistory } from "../services/api";

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" });
}

export default function HistoryPanel() {
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const signalQuery = filter === "ALL" ? "" : `&signal=${filter}`;
      const [signalData, tradeData, analyticsData] = await Promise.all([
        getHistorySignals(`?limit=30${signalQuery}`),
        getTradeHistory("?limit=20"),
        getHistoryAnalytics()
      ]);
      setSignals(signalData.items || []);
      setTrades(tradeData.items || []);
      setAnalytics(analyticsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <section className="history-panel">
      <div className="history-head">
        <div>
          <h2>Phase 10 — PostgreSQL History</h2>
          <p>Persisted C++ signal evaluations and paper-trade records.</p>
        </div>
        <div className="history-filters">
          {['ALL', 'BUY', 'SELL', 'WAIT'].map((value) => (
            <button key={value} className={filter === value ? "filter-active" : ""} onClick={() => setFilter(value)}>{value}</button>
          ))}
        </div>
      </div>

      {loading && <p className="hint">Loading database history…</p>}
      {error && <div className="history-error"><strong>Database history unavailable.</strong><span>{error}</span><small>Set DATABASE_URL, start PostgreSQL and run the Phase 10 migration.</small></div>}

      {analytics && !error && (
        <div className="analytics-grid">
          <div><span>Closed</span><b>{analytics.closedTrades}</b></div>
          <div><span>Open</span><b>{analytics.openTrades}</b></div>
          <div><span>Win Rate</span><b>{formatNumber(analytics.winRate)}%</b></div>
          <div><span>Total P&amp;L</span><b>{formatNumber(analytics.totalPnl)}</b></div>
          <div><span>Best Trade</span><b>{formatNumber(analytics.bestTrade)}</b></div>
          <div><span>Worst Trade</span><b>{formatNumber(analytics.worstTrade)}</b></div>
        </div>
      )}

      {!error && (
        <>
          <h3 className="history-section-title">Recent Signals</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Symbol</th><th>Signal</th><th>Bull</th><th>Bear</th><th>Price</th><th>Entry</th><th>SL</th></tr></thead>
              <tbody>
                {signals.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTime(row.observed_at)}</td><td>{row.symbol}</td><td><span className={`table-signal ${String(row.signal).toLowerCase()}`}>{row.signal}</span></td>
                    <td>{formatNumber(row.bullish_score, 0)}</td><td>{formatNumber(row.bearish_score, 0)}</td><td>{formatNumber(row.price)}</td><td>{formatNumber(row.entry)}</td><td>{formatNumber(row.stop_loss)}</td>
                  </tr>
                ))}
                {!signals.length && <tr><td colSpan="8">No signal history yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <h3 className="history-section-title">Paper Trade History</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Opened</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Qty</th><th>Exit</th><th>P&amp;L</th><th>Status</th></tr></thead>
              <tbody>
                {trades.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTime(row.opened_at)}</td><td>{row.symbol}</td><td>{row.direction}</td><td>{formatNumber(row.entry_price)}</td><td>{formatNumber(row.quantity, 0)}</td><td>{formatNumber(row.exit_price)}</td><td>{formatNumber(row.realized_pnl)}</td><td>{row.status}</td>
                  </tr>
                ))}
                {!trades.length && <tr><td colSpan="8">No paper trades yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

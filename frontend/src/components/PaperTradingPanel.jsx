import { useEffect, useState } from "react";
import { closePaperTrade, getPaperTrades } from "../services/api";

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function PaperTradingPanel() {
  const [trades, setTrades] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await getPaperTrades("?status=OPEN&limit=50");
      setTrades(data.items || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  async function close(id, currentPrice) {
    const exitPrice = Number(window.prompt("Paper exit price", currentPrice));
    if (!Number.isFinite(exitPrice)) return;
    try {
      await closePaperTrade(id, { exitPrice, exitReason: "MANUAL" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="tool-panel">
      <div className="tool-head">
        <div>
          <h2>Paper Trading</h2>
          <p>Virtual positions only. When enabled, the WebSocket feed monitors open positions against SL/targets.</p>
        </div>
        <button className="secondary-button" onClick={load}>Refresh</button>
      </div>

      {error && <div className="tool-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Side</th><th>Entry</th><th>Current</th><th>SL</th><th>TP1</th><th>TP2</th><th>Qty</th><th>Action</th></tr></thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id}>
                <td>{trade.symbol}</td>
                <td>{trade.direction}</td>
                <td>{money(trade.entry_price)}</td>
                <td>{money(trade.current_price)}</td>
                <td>{money(trade.stop_loss)}</td>
                <td>{money(trade.target1)}</td>
                <td>{money(trade.target2)}</td>
                <td>{trade.quantity}</td>
                <td><button className="table-button" onClick={() => close(trade.id, trade.current_price)}>Close</button></td>
              </tr>
            ))}
            {!trades.length && <tr><td colSpan="9">No open paper trades.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

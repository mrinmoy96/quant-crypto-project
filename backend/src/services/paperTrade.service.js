import { query } from "../db/pool.js";
import { getEngineSignal } from "./engine.service.js";

function directionPnl(direction, entry, exit, quantity) {
  return (direction === "BUY" ? exit - entry : entry - exit) * quantity;
}

function numberOrNull(value) {
  return value === undefined || value === null || value === "" ? null : Number(value);
}

function dbErrorMessage(err) {
  if (err?.message?.includes("DATABASE_URL")) {
    return "PostgreSQL is not configured. Set DATABASE_URL in backend/.env.";
  }
  return err.message;
}

export async function listPaperTrades({ symbol, status = "OPEN", limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (symbol) {
    params.push(symbol.toUpperCase());
    conditions.push(`symbol=$${params.length}`);
  }
  if (status) {
    params.push(status.toUpperCase());
    conditions.push(`status=$${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitIndex = params.length;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT * FROM paper_trades ${where} ORDER BY opened_at DESC LIMIT $${limitIndex}`,
    params
  );
  return result.rows;
}

export async function createPaperTrade(payload) {
  const {
    symbol,
    timeframe = "5m",
    direction,
    entryPrice,
    quantity = 1,
    stopLoss,
    target1,
    target2,
    source = "MANUAL",
    signalScore = null
  } = payload;

  if (!symbol || !direction || !Number.isFinite(Number(entryPrice))) {
    throw new Error("symbol, direction and entryPrice are required");
  }
  if (!["BUY", "SELL"].includes(String(direction).toUpperCase())) {
    throw new Error("direction must be BUY or SELL");
  }

  const result = await query(
    `INSERT INTO paper_trades
      (symbol,timeframe,direction,entry_price,quantity,stop_loss,target1,target2,current_price,source,signal_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$4,$9,$10)
     RETURNING *`,
    [
      symbol.toUpperCase(), timeframe, String(direction).toUpperCase(), Number(entryPrice),
      Number(quantity) || 1, numberOrNull(stopLoss), numberOrNull(target1),
      numberOrNull(target2), String(source).toUpperCase(), numberOrNull(signalScore)
    ]
  );

  await query(
    `INSERT INTO paper_trade_events (paper_trade_id,event_type,price,event_data)
     VALUES ($1,'OPEN',$2,$3::jsonb)`,
    [result.rows[0].id, Number(entryPrice), JSON.stringify({ source })]
  );

  return result.rows[0];
}

export async function createPaperTradeFromCurrentSignal(symbol, timeframe = "5m") {
  const result = await getEngineSignal(symbol, timeframe);
  const signal = result.signal || {};
  if (!["BUY", "SELL"].includes(signal.signal)) {
    throw new Error(`No actionable BUY/SELL signal for ${result.symbol}`);
  }

  const plan = signal.signal === "BUY" ? signal.plans?.bullish : signal.plans?.bearish;
  return createPaperTrade({
    symbol: result.symbol,
    timeframe,
    direction: signal.signal,
    entryPrice: signal.entry,
    stopLoss: signal.stopLoss,
    target1: signal.target1,
    target2: signal.target2,
    quantity: 1,
    source: "ENGINE_SIGNAL",
    signalScore: signal.signal === "BUY" ? signal.bullishScore : signal.bearishScore,
    plan
  });
}

export async function updatePaperPrices(priceMap) {
  const open = await listPaperTrades({ status: "OPEN", limit: 200 });
  const closed = [];

  for (const trade of open) {
    const current = Number(priceMap[trade.symbol.toLowerCase()] ?? priceMap[trade.symbol]);
    if (!Number.isFinite(current)) continue;

    await query(`UPDATE paper_trades SET current_price=$1 WHERE id=$2`, [current, trade.id]);

    const isBuy = trade.direction === "BUY";
    const stop = Number(trade.stop_loss);
    const target1 = Number(trade.target1);
    const target2 = Number(trade.target2);

    let reason = null;
    if (Number.isFinite(stop) && ((isBuy && current <= stop) || (!isBuy && current >= stop))) {
      reason = "STOP_LOSS";
    } else if (Number.isFinite(target2) && ((isBuy && current >= target2) || (!isBuy && current <= target2))) {
      reason = "TARGET_2";
    } else if (Number.isFinite(target1) && ((isBuy && current >= target1) || (!isBuy && current <= target1))) {
      reason = "TARGET_1";
    }

    if (reason) {
      const exit = current;
      const realized = directionPnl(trade.direction, Number(trade.entry_price), exit, Number(trade.quantity));
      const updated = await query(
        `UPDATE paper_trades
            SET exit_price=$1, exit_reason=$2, realized_pnl=$3, status='CLOSED', closed_at=NOW()
          WHERE id=$4
          RETURNING *`,
        [exit, reason, realized, trade.id]
      );

      await query(
        `INSERT INTO paper_trade_events (paper_trade_id,event_type,price,event_data)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [trade.id, reason, exit, JSON.stringify({ currentPrice: current })]
      );
      closed.push(updated.rows[0]);
    }
  }
  return closed;
}

export async function closePaperTrade(id, { exitPrice, exitReason = "MANUAL" }) {
  const current = await query("SELECT * FROM paper_trades WHERE id=$1", [id]);
  if (!current.rowCount) return null;
  const trade = current.rows[0];
  if (trade.status !== "OPEN") return trade;

  const exit = Number(exitPrice);
  if (!Number.isFinite(exit)) throw new Error("exitPrice must be a number");

  const realized = directionPnl(trade.direction, Number(trade.entry_price), exit, Number(trade.quantity));
  const result = await query(
    `UPDATE paper_trades
        SET exit_price=$1, exit_reason=$2, realized_pnl=$3, current_price=$1,
            status='CLOSED', closed_at=NOW()
      WHERE id=$4
      RETURNING *`,
    [exit, String(exitReason).toUpperCase(), realized, id]
  );

  await query(
    `INSERT INTO paper_trade_events (paper_trade_id,event_type,price,event_data)
     VALUES ($1,'CLOSE',$2,$3::jsonb)`,
    [id, exit, JSON.stringify({ exitReason })]
  );

  return result.rows[0];
}

export function mapServiceError(err) {
  err.message = dbErrorMessage(err);
  return err;
}

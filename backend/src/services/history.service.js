import { query } from "../db/pool.js";

function num(value) {
  return value === undefined || value === null || value === "" ? null : Number(value);
}

export async function saveEngineResult(result) {
  const analysis = result.analysis || {};
  const signal = result.signal || {};
  const client = await (await import("../db/pool.js")).getPool().connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO market_signals (
        symbol, timeframe, observed_at, price, trend, structure, volume,
        rsi, atr, vwap, bullish_score, bearish_score, confidence, signal,
        setup, entry, stop_loss, target1, target2, risk_reward, reason, data_source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT (symbol, timeframe, observed_at) DO UPDATE SET
        price=EXCLUDED.price, trend=EXCLUDED.trend, structure=EXCLUDED.structure, volume=EXCLUDED.volume,
        rsi=EXCLUDED.rsi, atr=EXCLUDED.atr, vwap=EXCLUDED.vwap, bullish_score=EXCLUDED.bullish_score,
        bearish_score=EXCLUDED.bearish_score, confidence=EXCLUDED.confidence, signal=EXCLUDED.signal,
        setup=EXCLUDED.setup, entry=EXCLUDED.entry, stop_loss=EXCLUDED.stop_loss, target1=EXCLUDED.target1,
        target2=EXCLUDED.target2, risk_reward=EXCLUDED.risk_reward, reason=EXCLUDED.reason, data_source=EXCLUDED.data_source
      RETURNING id, (xmax = 0) AS inserted`,
      [
        result.symbol,
        result.timeframe,
        result.candleTimestamp ? new Date(result.candleTimestamp) : new Date(),
        num(analysis.price),
        analysis.trend ?? null,
        analysis.structure ?? null,
        analysis.volume ?? null,
        num(analysis.rsi),
        num(analysis.atr),
        num(analysis.vwap),
        num(signal.bullishScore),
        num(signal.bearishScore),
        num(signal.confidence),
        signal.signal ?? "WAIT",
        signal.setup ?? null,
        num(signal.entry),
        num(signal.stopLoss),
        num(signal.target1),
        num(signal.target2),
        signal.riskReward ?? null,
        signal.reason ?? null,
        result.dataSource ?? null
      ]
    );

    const signalId = inserted.rows[0].id;
    const plans = signal.plans || {};

    for (const [direction, plan] of [["BULLISH", plans.bullish], ["BEARISH", plans.bearish]]) {
      if (!plan?.entry || !plan?.stopLoss || !plan?.target1 || !plan?.target2) continue;
      await client.query(
        `INSERT INTO trade_plans
          (signal_id, symbol, timeframe, direction, entry, stop_loss, target1, target2, risk_reward, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'CANDIDATE')
         ON CONFLICT (signal_id, direction) DO UPDATE SET
           entry=EXCLUDED.entry, stop_loss=EXCLUDED.stop_loss, target1=EXCLUDED.target1,
           target2=EXCLUDED.target2, risk_reward=EXCLUDED.risk_reward`,
        [signalId, result.symbol, result.timeframe, direction, num(plan.entry), num(plan.stopLoss), num(plan.target1), num(plan.target2), plan.riskReward ?? null]
      );
    }

    for (const forecast of signal.forecasts || []) {
      if (!forecast?.startTimestamp || !forecast?.endTimestamp) continue;
      await client.query(
        `INSERT INTO market_forecasts (
          symbol, timeframe, generated_at, forecast_start, forecast_end, horizon_minutes,
          direction, bullish_score, bearish_score, strength, basis, data_source
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (symbol, timeframe, horizon_minutes, forecast_start) DO UPDATE SET
          generated_at=EXCLUDED.generated_at, forecast_end=EXCLUDED.forecast_end,
          direction=EXCLUDED.direction, bullish_score=EXCLUDED.bullish_score,
          bearish_score=EXCLUDED.bearish_score, strength=EXCLUDED.strength,
          basis=EXCLUDED.basis, data_source=EXCLUDED.data_source`,
        [
          result.symbol,
          result.timeframe,
          result.candleTimestamp ? new Date(result.candleTimestamp) : new Date(),
          new Date(Number(forecast.startTimestamp) * 1000),
          new Date(Number(forecast.endTimestamp) * 1000),
          Number(forecast.horizonMinutes),
          forecast.direction,
          num(forecast.bullishScore),
          num(forecast.bearishScore),
          num(forecast.strength),
          forecast.basis ?? null,
          result.dataSource ?? null
        ]
      );
    }

    if (inserted.rows[0].inserted) {
      await client.query(
        `INSERT INTO signal_events (signal_id, symbol, event_type, event_data)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [signalId, result.symbol, "SIGNAL_GENERATED", JSON.stringify({
          signal: signal.signal,
          bullishScore: signal.bullishScore,
          bearishScore: signal.bearishScore,
          confidence: signal.confidence
        })]
      );
    }

    await client.query("COMMIT");
    return { signalId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listSignals({ symbol, signal, limit = 50, offset = 0 }) {
  const params = [];
  const conditions = [];
  if (symbol) { params.push(symbol.toUpperCase()); conditions.push(`symbol = $${params.length}`); }
  if (signal) { params.push(signal.toUpperCase()); conditions.push(`signal = $${params.length}`); }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitIndex = params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetIndex = params.length;

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT id, symbol, timeframe, observed_at, price, trend, structure, volume,
            rsi, atr, vwap, bullish_score, bearish_score, confidence, signal,
            setup, entry, stop_loss, target1, target2, risk_reward, reason, data_source
       FROM market_signals ${where}
      ORDER BY observed_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );
  return result.rows;
}

export async function listTradePlans({ symbol, status, limit = 50, offset = 0 }) {
  const params = [];
  const conditions = [];
  if (symbol) { params.push(symbol.toUpperCase()); conditions.push(`symbol = $${params.length}`); }
  if (status) { params.push(status.toUpperCase()); conditions.push(`status = $${params.length}`); }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitIndex = params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetIndex = params.length;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT id, signal_id, symbol, timeframe, direction, entry, stop_loss, target1,
            target2, risk_reward, status, created_at, activated_at, closed_at
       FROM trade_plans ${where}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );
  return result.rows;
}

export async function createTrade({ tradePlanId, symbol, timeframe, direction, entryPrice, quantity, stopLoss, target1, target2 }) {
  const result = await query(
    `INSERT INTO trades
      (trade_plan_id, symbol, timeframe, direction, entry_price, quantity, stop_loss, target1, target2)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [tradePlanId || null, symbol.toUpperCase(), timeframe || "5m", direction.toUpperCase(), Number(entryPrice), Number(quantity || 1), num(stopLoss), num(target1), num(target2)]
  );

  if (tradePlanId) {
    await query(`UPDATE trade_plans SET status='ACTIVE', activated_at=COALESCE(activated_at,NOW()) WHERE id=$1`, [tradePlanId]);
  }
  return result.rows[0];
}

export async function closeTrade(id, { exitPrice, exitReason }) {
  const current = await query("SELECT * FROM trades WHERE id=$1", [id]);
  if (!current.rowCount) return null;
  const trade = current.rows[0];
  const exit = Number(exitPrice);
  const entry = Number(trade.entry_price);
  const qty = Number(trade.quantity);
  const pnl = trade.direction === "BUY" ? (exit - entry) * qty : (entry - exit) * qty;

  const result = await query(
    `UPDATE trades
        SET exit_price=$1, exit_reason=$2, realized_pnl=$3, status='CLOSED', closed_at=NOW()
      WHERE id=$4
      RETURNING *`,
    [exit, exitReason || "MANUAL", pnl, id]
  );
  if (trade.trade_plan_id) {
    await query(`UPDATE trade_plans SET status='CLOSED', closed_at=NOW() WHERE id=$1`, [trade.trade_plan_id]);
  }
  return result.rows[0];
}

export async function listTrades({ symbol, status, limit = 50, offset = 0 }) {
  const params = [];
  const conditions = [];
  if (symbol) { params.push(symbol.toUpperCase()); conditions.push(`symbol = $${params.length}`); }
  if (status) { params.push(status.toUpperCase()); conditions.push(`status = $${params.length}`); }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitIndex = params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetIndex = params.length;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT * FROM trades ${where} ORDER BY opened_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );
  return result.rows;
}

export async function getAnalytics() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status='CLOSED')::int AS closed_trades,
      COUNT(*) FILTER (WHERE status='OPEN')::int AS open_trades,
      COUNT(*) FILTER (WHERE status='CLOSED' AND realized_pnl > 0)::int AS winning_trades,
      COUNT(*) FILTER (WHERE status='CLOSED' AND realized_pnl < 0)::int AS losing_trades,
      COALESCE(SUM(realized_pnl) FILTER (WHERE status='CLOSED'), 0) AS total_pnl,
      COALESCE(AVG(realized_pnl) FILTER (WHERE status='CLOSED'), 0) AS average_pnl,
      COALESCE(MAX(realized_pnl) FILTER (WHERE status='CLOSED'), 0) AS best_trade,
      COALESCE(MIN(realized_pnl) FILTER (WHERE status='CLOSED'), 0) AS worst_trade
    FROM trades
  `);
  const row = result.rows[0];
  const closed = Number(row.closed_trades);
  return {
    closedTrades: closed,
    openTrades: Number(row.open_trades),
    winningTrades: Number(row.winning_trades),
    losingTrades: Number(row.losing_trades),
    winRate: closed ? (Number(row.winning_trades) / closed) * 100 : 0,
    totalPnl: Number(row.total_pnl),
    averagePnl: Number(row.average_pnl),
    bestTrade: Number(row.best_trade),
    worstTrade: Number(row.worst_trade)
  };
}

export async function listForecasts({ symbol, timeframe, horizon, limit = 100 }) {
  const params = [];
  const conditions = [];
  if (symbol) { params.push(symbol.toUpperCase()); conditions.push(`symbol = $${params.length}`); }
  if (timeframe) { params.push(timeframe); conditions.push(`timeframe = $${params.length}`); }
  if (horizon) { params.push(Number(horizon)); conditions.push(`horizon_minutes = $${params.length}`); }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  const limitIndex = params.length;

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT id, symbol, timeframe, generated_at, forecast_start, forecast_end,
            horizon_minutes, direction, bullish_score, bearish_score, strength, basis, data_source
       FROM market_forecasts ${where}
      ORDER BY forecast_start DESC, horizon_minutes ASC
      LIMIT $${limitIndex}`,
    params
  );

  return result.rows;
}

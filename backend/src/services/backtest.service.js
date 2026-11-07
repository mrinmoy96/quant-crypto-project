import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

import { env } from "../config/env.js";
import { query } from "../db/pool.js";

const execFileAsync = promisify(execFile);

function toCandle(row) {
  return {
    timestamp: new Date(Number(row.timestamp) * 1000),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume || 0)
  };
}

async function readCsv(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error(`Backtest dataset "${filePath}" has no candle rows`);

  const header = lines.shift().split(",").map((x) => x.trim().toLowerCase());
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  for (const required of ["timestamp", "open", "high", "low", "close", "volume"]) {
    if (index[required] === undefined) throw new Error(`Dataset is missing "${required}" column`);
  }

  return lines.map((line) => {
    const cells = line.split(",");
    return toCandle({
      timestamp: cells[index.timestamp],
      open: cells[index.open],
      high: cells[index.high],
      low: cells[index.low],
      close: cells[index.close],
      volume: cells[index.volume]
    });
  }).filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite));
}

function candlesToCsv(candles) {
  const rows = ["timestamp,open,high,low,close,volume"];
  for (const c of candles) {
    rows.push([
      Math.floor(c.timestamp.getTime() / 1000),
      c.open, c.high, c.low, c.close, c.volume
    ].join(","));
  }
  return rows.join("\n") + "\n";
}

async function runEngine(enginePath, csvPath) {
  try {
    const { stdout } = await execFileAsync(enginePath, [csvPath], { timeout: env.engineTimeoutMs });
    return JSON.parse(stdout.trim());
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `C++ engine binary not found at "${enginePath}". Build it before running a backtest.`
      );
    }
    if (err.killed || err.signal === "SIGTERM") {
      throw new Error(`C++ engine timed out after ${env.engineTimeoutMs}ms`);
    }
    if (err instanceof SyntaxError) {
      throw new Error("C++ engine produced invalid JSON during backtest");
    }
    throw new Error(`C++ engine failed during backtest: ${(err.stderr || err.message || "").trim()}`);
  }
}

function applySlippage(price, direction, slippageBps, isEntry) {
  const factor = 1 + (slippageBps / 10000) * (direction === "BUY"
    ? (isEntry ? 1 : -1)
    : (isEntry ? -1 : 1));
  return price * factor;
}

function simulateOpenTrade(trade, futureCandle, { slippageBps = 0, feePerTrade = 0 } = {}) {
  const isBuy = trade.direction === "BUY";

  // Conservative ordering: if both a stop and target are touched in the
  // same candle, assume the stop was hit first.
  if (isBuy) {
    if (futureCandle.low <= trade.stopLoss) {
      const exit = applySlippage(trade.stopLoss, trade.direction, slippageBps, false);
      return { exitPrice: exit, exitReason: "STOP_LOSS", candle: futureCandle };
    }
    if (futureCandle.high >= trade.target2) {
      const exit = applySlippage(trade.target2, trade.direction, slippageBps, false);
      return { exitPrice: exit, exitReason: "TARGET_2", candle: futureCandle };
    }
    if (futureCandle.high >= trade.target1) {
      const exit = applySlippage(trade.target1, trade.direction, slippageBps, false);
      return { exitPrice: exit, exitReason: "TARGET_1", candle: futureCandle };
    }
  } else {
    if (futureCandle.high >= trade.stopLoss) {
      const exit = applySlippage(trade.stopLoss, trade.direction, slippageBps, false);
      return { exitPrice: exit, exitReason: "STOP_LOSS", candle: futureCandle };
    }
    if (futureCandle.low <= trade.target2) {
      const exit = applySlippage(trade.target2, trade.direction, slippageBps, false);
      return { exitPrice: exit, exitReason: "TARGET_2", candle: futureCandle };
    }
    if (futureCandle.low <= trade.target1) {
      const exit = applySlippage(trade.target1, trade.direction, slippageBps, false);
      return { exitPrice: exit, exitReason: "TARGET_1", candle: futureCandle };
    }
  }

  return null;
}

function pnl(direction, entry, exit, quantity) {
  return (direction === "BUY" ? exit - entry : entry - exit) * quantity;
}

function chooseQuantity({ entry, stopLoss, initialCapital, riskPerTrade }) {
  const riskPerUnit = Math.abs(entry - stopLoss);
  if (!(riskPerUnit > 0)) return 1;
  return Math.max(1, Math.floor((initialCapital * riskPerTrade) / riskPerUnit));
}

function sanitizeDatasetPath(datasetName) {
  const safe = path.basename(datasetName || env.demoBacktestFile);
  return path.resolve(process.cwd(), "data", safe);
}

export async function runBacktest({
  symbol = "NIFTY",
  timeframe = "5m",
  dataset = env.demoBacktestFile,
  initialCapital = 100000,
  riskPerTrade = 0.01,
  slippageBps = 0,
  feePerTrade = 0
} = {}) {
  const datasetPath = sanitizeDatasetPath(dataset);
  const candles = await readCsv(datasetPath);
  if (candles.length < 251) {
    throw new Error(`Backtest needs at least 251 candles; dataset has ${candles.length}`);
  }

  const capital0 = Number(initialCapital);
  const riskPct = Number(riskPerTrade);
  const slip = Number(slippageBps);
  const fee = Number(feePerTrade);
  if (!(capital0 > 0) || !(riskPct > 0 && riskPct <= 0.1)) {
    throw new Error("initialCapital must be > 0 and riskPerTrade must be between 0 and 0.1");
  }

  let capital = capital0;
  let peak = capital0;
  let maxDrawdown = 0;
  const trades = [];

  // Start after enough bars for EMA200. The C++ engine receives only the
  // prefix up to the decision candle, so it cannot see future candles.
  for (let i = 250; i < candles.length - 1; i += 1) {
    const prefixPath = path.join(os.tmpdir(), `backtest-${crypto.randomUUID()}.csv`);
    await fs.writeFile(prefixPath, candlesToCsv(candles.slice(0, i + 1)), "utf8");

    let engineOutput;
    try {
      engineOutput = await runEngine(env.engineBinaryPath, prefixPath);
    } finally {
      await fs.unlink(prefixPath).catch(() => {});
    }

    const signal = engineOutput.signal || {};
    if (signal.signal !== "BUY" && signal.signal !== "SELL") continue;

    const plan = signal.signal === "BUY" ? signal.plans?.bullish : signal.plans?.bearish;
    if (!plan?.stopLoss || !plan?.target1 || !plan?.target2 || !plan?.entry) continue;

    const entryCandle = candles[i + 1];
    const entryPrice = applySlippage(entryCandle.open, signal.signal, slip, true);
    const stopLoss = Number(plan.stopLoss);
    const target1 = Number(plan.target1);
    const target2 = Number(plan.target2);
    const quantity = chooseQuantity({
      entry: entryPrice,
      stopLoss,
      initialCapital: capital,
      riskPerTrade: riskPct
    });

    const openTrade = {
      symbol,
      timeframe,
      direction: signal.signal,
      signalTime: candles[i].timestamp,
      entryTime: entryCandle.timestamp,
      entryPrice,
      quantity,
      stopLoss,
      target1,
      target2
    };

    let closed = null;
    for (let j = i + 1; j < candles.length; j += 1) {
      const result = simulateOpenTrade(openTrade, candles[j], {
        slippageBps: slip,
        feePerTrade: fee
      });
      if (result) {
        closed = result;
        break;
      }
    }

    if (!closed) {
      const last = candles.at(-1);
      closed = {
        exitPrice: applySlippage(last.close, signal.signal, slip, false),
        exitReason: "END_OF_DATA",
        candle: last
      };
    }

    const grossPnl = pnl(signal.signal, entryPrice, closed.exitPrice, quantity);
    const netPnl = grossPnl - fee;
    const initialRisk = Math.abs(entryPrice - stopLoss) * quantity;
    const rMultiple = initialRisk > 0 ? netPnl / initialRisk : 0;

    capital += netPnl;
    peak = Math.max(peak, capital);
    maxDrawdown = Math.max(maxDrawdown, peak - capital);

    trades.push({
      ...openTrade,
      exitTime: closed.candle.timestamp,
      exitPrice: closed.exitPrice,
      exitReason: closed.exitReason,
      pnl: netPnl,
      rMultiple
    });

    // Non-overlapping trades: continue after the exit candle.
    i = candles.findIndex((c) => c.timestamp.getTime() === closed.candle.timestamp.getTime());
    if (i < 250) break;
  }

  // If there are no trades, this is still a valid backtest result.
  const winning = trades.filter((t) => t.pnl > 0);
  const losing = trades.filter((t) => t.pnl < 0);
  const grossProfit = winning.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losing.reduce((sum, t) => sum + t.pnl, 0));
  const totalPnl = capital - capital0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0);
  const winRate = trades.length ? (winning.length / trades.length) * 100 : 0;

  const summary = {
    symbol,
    timeframe,
    dataset: path.basename(datasetPath),
    startAt: candles[0].timestamp.toISOString(),
    endAt: candles.at(-1).timestamp.toISOString(),
    initialCapital: capital0,
    endingCapital: capital,
    totalPnl,
    returnPct: capital0 ? (totalPnl / capital0) * 100 : 0,
    totalBars: candles.length,
    totalTrades: trades.length,
    winningTrades: winning.length,
    losingTrades: losing.length,
    winRate,
    grossProfit,
    grossLoss,
    profitFactor,
    maxDrawdown
  };

  if (await databaseAvailable()) {
    const run = await query(
      `INSERT INTO backtest_runs
        (symbol,timeframe,dataset_name,start_at,end_at,initial_capital,risk_per_trade,slippage_bps,
         fee_per_trade,total_bars,total_trades,winning_trades,losing_trades,gross_profit,gross_loss,
         total_pnl,ending_capital,max_drawdown,profit_factor,win_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        symbol.toUpperCase(), timeframe, path.basename(datasetPath),
        summary.startAt, summary.endAt, capital0, riskPct, slip, fee,
        summary.totalBars, summary.totalTrades, summary.winningTrades, summary.losingTrades,
        summary.grossProfit, summary.grossLoss, summary.totalPnl, summary.endingCapital,
        summary.maxDrawdown, summary.profitFactor, summary.winRate
      ]
    );
    const runId = run.rows[0].id;

    for (const trade of trades) {
      await query(
        `INSERT INTO backtest_trades
          (backtest_run_id,symbol,timeframe,direction,signal_time,entry_time,entry_price,quantity,
           stop_loss,target1,target2,exit_time,exit_price,exit_reason,pnl,r_multiple)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          runId, trade.symbol, trade.timeframe, trade.direction, trade.signalTime,
          trade.entryTime, trade.entryPrice, trade.quantity, trade.stopLoss, trade.target1,
          trade.target2, trade.exitTime, trade.exitPrice, trade.exitReason, trade.pnl, trade.rMultiple
        ]
      );
    }

    return { runId, ...summary, trades };
  }

  return { runId: null, ...summary, trades };
}

export async function listBacktestRuns({ limit = 20 } = {}) {
  const result = await query(
    `SELECT * FROM backtest_runs ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 20, 1), 100)]
  );
  return result.rows;
}

export async function getBacktestRun(id) {
  const run = await query(`SELECT * FROM backtest_runs WHERE id=$1`, [id]);
  if (!run.rowCount) return null;
  const trades = await query(
    `SELECT * FROM backtest_trades WHERE backtest_run_id=$1 ORDER BY entry_time`,
    [id]
  );
  return { ...run.rows[0], trades: trades.rows };
}

async function databaseAvailable() {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

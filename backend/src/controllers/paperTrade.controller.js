import * as service from "../services/paperTrade.service.js";
import { env } from "../config/env.js";

export async function list(req, res, next) {
  try {
    res.json({ items: await service.listPaperTrades(req.query) });
  } catch (err) { next(err); }
}

function ensureEnabled() {
  if (!env.paperTradingEnabled) {
    const err = new Error("Paper trading is disabled. Set PAPER_TRADING_ENABLED=true in backend/.env.");
    err.statusCode = 403;
    throw err;
  }
}

export async function create(req, res, next) {
  try {
    ensureEnabled();
    res.status(201).json(await service.createPaperTrade(req.body || {}));
  } catch (err) { next(err); }
}

export async function createFromSignal(req, res, next) {
  try {
    ensureEnabled();
    res.status(201).json(await service.createPaperTradeFromCurrentSignal(req.params.symbol, req.body?.timeframe || "5m"));
  } catch (err) { next(err); }
}

export async function close(req, res, next) {
  try {
    ensureEnabled();
    const result = await service.closePaperTrade(req.params.id, req.body || {});
    if (!result) return res.status(404).json({ message: "Paper trade not found" });
    res.json(result);
  } catch (err) { next(err); }
}

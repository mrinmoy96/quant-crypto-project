import * as historyService from "../services/history.service.js";

export async function create(req, res, next) {
  try {
    const { symbol, timeframe = "5m", direction, entryPrice, quantity = 1, stopLoss, target1, target2, tradePlanId } = req.body;
    if (!symbol || !direction || entryPrice === undefined) {
      return res.status(400).json({ message: "symbol, direction and entryPrice are required" });
    }
    res.status(201).json(await historyService.createTrade({ tradePlanId, symbol, timeframe, direction, entryPrice, quantity, stopLoss, target1, target2 }));
  } catch (err) { next(err); }
}

export async function close(req, res, next) {
  try {
    const { exitPrice, exitReason } = req.body;
    if (exitPrice === undefined) return res.status(400).json({ message: "exitPrice is required" });
    const trade = await historyService.closeTrade(req.params.id, { exitPrice, exitReason });
    if (!trade) return res.status(404).json({ message: "Trade not found" });
    res.json(trade);
  } catch (err) { next(err); }
}

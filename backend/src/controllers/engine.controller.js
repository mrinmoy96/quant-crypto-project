import * as engineService from "../services/engine.service.js";

export async function getSignal(req, res, next) {
  try {
    const { timeframe = "5m", limit } = req.query;
    const result = await engineService.getEngineSignal(req.params.symbol, timeframe, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

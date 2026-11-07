import * as marketService from "../services/market.service.js";

export async function listIndices(req, res, next) {
  try {
    res.json(await marketService.getIndices());
  } catch (err) {
    next(err);
  }
}

export async function getQuote(req, res, next) {
  try {
    const quote = await marketService.getIndexQuote(req.params.symbol);
    res.json(quote);
  } catch (err) {
    next(err);
  }
}

export async function getCandles(req, res, next) {
  try {
    const { timeframe = "5m", limit } = req.query;
    const data = await marketService.getIndexCandles(req.params.symbol, timeframe, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

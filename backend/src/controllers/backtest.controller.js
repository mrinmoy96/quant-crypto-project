import * as backtestService from "../services/backtest.service.js";

export async function run(req, res, next) {
  try {
    const result = await backtestService.runBacktest(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listRuns(req, res, next) {
  try {
    res.json({ items: await backtestService.listBacktestRuns(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function getRun(req, res, next) {
  try {
    const result = await backtestService.getBacktestRun(req.params.id);
    if (!result) return res.status(404).json({ message: "Backtest run not found" });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

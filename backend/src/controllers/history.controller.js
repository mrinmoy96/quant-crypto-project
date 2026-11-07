import * as historyService from "../services/history.service.js";

export async function listSignals(req, res, next) {
  try { res.json({ items: await historyService.listSignals(req.query) }); } catch (err) { next(err); }
}

export async function listTradePlans(req, res, next) {
  try { res.json({ items: await historyService.listTradePlans(req.query) }); } catch (err) { next(err); }
}

export async function listTrades(req, res, next) {
  try { res.json({ items: await historyService.listTrades(req.query) }); } catch (err) { next(err); }
}

export async function analytics(req, res, next) {
  try { res.json(await historyService.getAnalytics()); } catch (err) { next(err); }
}

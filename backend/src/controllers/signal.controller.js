import * as signalService from "../services/signal.service.js";

export function listSignals(req, res, next) {
  try {
    res.json(signalService.getAllSignals());
  } catch (err) {
    next(err);
  }
}

export function getSignal(req, res, next) {
  try {
    const signal = signalService.getSignalForSymbol(req.params.symbol);
    res.json(signal);
  } catch (err) {
    next(err);
  }
}

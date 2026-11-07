import { resolveInstrument, listInstruments, getMockSignal } from "../data/mockMarketData.js";
import { NotFoundError } from "../utils/errors.js";

// IMPORTANT: these are mock/placeholder signals for wiring the API and
// dashboard together. Node.js does NOT calculate real Entry/SL/Target
// here — that logic belongs to the C++ engine (Phase 4-7) and nothing in
// this project should be read as a real trading recommendation.

export function getAllSignals() {
  return listInstruments().map((instrument) => getMockSignal(instrument.key));
}

export function getSignalForSymbol(rawSymbol) {
  const instrument = resolveInstrument(rawSymbol);
  if (!instrument) {
    throw new NotFoundError(`Unknown instrument "${rawSymbol}"`);
  }
  return getMockSignal(instrument.key);
}

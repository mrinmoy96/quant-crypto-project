import { Router } from "express";
import * as marketController from "../controllers/market.controller.js";

const router = Router();

// GET /api/market/indices        -> quotes for every tracked instrument
// GET /api/market/:symbol        -> quote for one instrument (nifty | sensex)
// GET /api/market/:symbol/candles?timeframe=5m&limit=50
router.get("/indices", marketController.listIndices);
router.get("/:symbol/candles", marketController.getCandles);
router.get("/:symbol", marketController.getQuote);

export default router;

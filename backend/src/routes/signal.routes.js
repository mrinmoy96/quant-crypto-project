import { Router } from "express";
import * as signalController from "../controllers/signal.controller.js";

const router = Router();

// GET /api/signals          -> mock signals for every tracked instrument
// GET /api/signals/:symbol  -> mock signal for one instrument (nifty | sensex)
router.get("/", signalController.listSignals);
router.get("/:symbol", signalController.getSignal);

export default router;

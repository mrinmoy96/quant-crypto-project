import { Router } from "express";
import * as engineController from "../controllers/engine.controller.js";

const router = Router();

// GET /api/engine/:symbol?timeframe=5m&limit=250
// Real C++ engine output (analysis + signal) — as opposed to the mock
// data under /api/signals. See docs/ENGINE_CONTRACT.md.
router.get("/:symbol", engineController.getSignal);

export default router;

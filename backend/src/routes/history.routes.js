import { Router } from "express";
import * as controller from "../controllers/history.controller.js";

const router = Router();
router.get("/signals", controller.listSignals);
router.get("/plans", controller.listTradePlans);
router.get("/trades", controller.listTrades);
router.get("/analytics", controller.analytics);
export default router;

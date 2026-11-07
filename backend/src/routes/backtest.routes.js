import { Router } from "express";
import * as controller from "../controllers/backtest.controller.js";

const router = Router();
router.post("/run", controller.run);
router.get("/runs", controller.listRuns);
router.get("/runs/:id", controller.getRun);
export default router;

import { Router } from "express";
import * as controller from "../controllers/paperTrade.controller.js";

const router = Router();
router.get("/", controller.list);
router.post("/", controller.create);
router.post("/from-signal/:symbol", controller.createFromSignal);
router.post("/:id/close", controller.close);
export default router;

import { Router } from "express";
import * as controller from "../controllers/trade.controller.js";

const router = Router();
router.post("/", controller.create);
router.post("/:id/close", controller.close);
export default router;

import { Router } from "express";
import * as controller from "../controllers/forecast.controller.js";

const router = Router();

router.get("/history", controller.getForecastHistory);
router.get("/:symbol", controller.getForecast);

export default router;

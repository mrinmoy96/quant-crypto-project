import { Router } from "express";
import { isDatabaseConfigured, query } from "../db/pool.js";

const router = Router();

router.get("/", async (req, res) => {
  let database = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      await query("SELECT 1");
      database = "connected";
    } catch {
      database = "error";
    }
  }

  res.json({
    status: database === "error" ? "degraded" : "ok",
    service: "trading-backend",
    phase: 10,
    database
  });
});

export default router;

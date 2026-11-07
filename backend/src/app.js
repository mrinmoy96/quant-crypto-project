import express from "express";
import cors from "cors";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import marketRoutes from "./routes/market.routes.js";
import signalRoutes from "./routes/signal.routes.js";
import engineRoutes from "./routes/engine.routes.js";
import historyRoutes from "./routes/history.routes.js";
import tradeRoutes from "./routes/trade.routes.js";
import backtestRoutes from "./routes/backtest.routes.js";
import paperTradeRoutes from "./routes/paperTrade.routes.js";
import forecastRoutes from "./routes/forecast.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const app = express();

const allowedOrigins = (env.corsOrigin || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/signals", signalRoutes);
app.use("/api/engine", engineRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/backtest", backtestRoutes);
app.use("/api/paper-trades", paperTradeRoutes);
app.use("/api/forecasts", forecastRoutes);

// Keep these last: 404 catch-all, then the centralized error handler.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

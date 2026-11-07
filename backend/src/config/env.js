import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src/config -> backend/src -> backend -> project root
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_ENGINE_PATH = path.join(PROJECT_ROOT, "engine", "build", "trading_engine");

// Centralized environment configuration. Import this instead of reading
// process.env directly elsewhere, so defaults live in exactly one place.
export const env = {
  port: Number(process.env.PORT) || 5015,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173",
  databaseUrl: process.env.DATABASE_URL || "",
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,

  // Phase 7: path to the compiled C++ engine binary. Override via
  // ENGINE_BINARY_PATH if your build output lands somewhere else (e.g.
  // engine/build/Release/trading_engine.exe on some Windows generators).
  engineBinaryPath: process.env.ENGINE_BINARY_PATH || DEFAULT_ENGINE_PATH,
  engineTimeoutMs: Number(process.env.ENGINE_TIMEOUT_MS) || 5000,

  // Phase 8: "live" (default) tries Yahoo Finance first and falls back
  // to mock data on any failure. "mock" skips the live fetch entirely
  // (useful for offline dev or CI). See docs/MARKET_DATA_SOURCE.md.
  marketDataProvider: process.env.MARKET_DATA_PROVIDER || "binance",

  // Phase 9: how often the WebSocket feed re-fetches quotes + re-runs
  // the C++ engine and broadcasts to connected clients. Deliberately not
  // too frequent — each tick spawns the engine process per instrument.
  wsTickIntervalMs: Number(process.env.WS_TICK_INTERVAL_MS) || 15000,
  wsHeartbeatIntervalMs: Number(process.env.WS_HEARTBEAT_INTERVAL_MS) || 30000,

  // Messaging: Telegram bot notifications for BUY/SELL triggers.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",

  // Phase 11: demo/backtest dataset and paper-trading behavior.
  demoBacktestFile: process.env.DEMO_BACKTEST_FILE || "data/demo_backtest_nifty_5m.csv",
  paperTradingEnabled: String(process.env.PAPER_TRADING_ENABLED || "false").toLowerCase() === "true"
};

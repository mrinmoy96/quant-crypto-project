import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

import { env } from "../config/env.js";
import { resolveInstrument } from "../data/mockMarketData.js";
import { getProviderCandles } from "../providers/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import {
  EngineUnavailableError,
  EngineTimeoutError,
  EngineExecutionError
} from "../utils/errors.js";
import { isDatabaseConfigured } from "../db/pool.js";
import { saveEngineResult } from "./history.service.js";

const execFileAsync = promisify(execFile);
const VALID_TIMEFRAMES = new Set(["1m", "5m", "15m", "1h", "1d"]);

// Converts Node's mock candles (ISO timestamp strings) into the CSV
// format the C++ engine expects (epoch seconds) — see
// docs/ENGINE_CONTRACT.md for the exact format.
function candlesToCsv(candles) {
  const header = "timestamp,open,high,low,close,volume";
  const rows = candles.map((candle) => {
    const epochSeconds = Math.floor(new Date(candle.timestamp).getTime() / 1000);
    return `${epochSeconds},${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume}`;
  });
  return [header, ...rows].join("\n") + "\n";
}

async function writeTempCsv(csvContent) {
  const filePath = path.join(os.tmpdir(), `engine-candles-${crypto.randomUUID()}.csv`);
  await fs.writeFile(filePath, csvContent, "utf8");
  return filePath;
}

// Spawns the compiled C++ engine as a child process (no shell — args are
// passed as an array, so there's no injection risk even though the path
// is built from a UUID we control). Parses its single-line JSON stdout.
async function runEngine(csvPath) {
  let stdout;
  try {
    const result = await execFileAsync(env.engineBinaryPath, [csvPath], {
      timeout: env.engineTimeoutMs
    });
    stdout = result.stdout;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new EngineUnavailableError(
        `C++ engine binary not found at "${env.engineBinaryPath}". Build it first: ` +
        `cd engine && mkdir -p build && cd build && cmake .. && cmake --build .`
      );
    }
    if (err.killed || err.signal === "SIGTERM") {
      throw new EngineTimeoutError(`C++ engine did not respond within ${env.engineTimeoutMs}ms`);
    }
    throw new EngineExecutionError(
      `C++ engine exited with an error: ${(err.stderr || err.message || "").trim()}`
    );
  }

  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new EngineExecutionError(
      `C++ engine stdout was not valid JSON. Got: ${trimmed.slice(0, 200)}`
    );
  }
}

export async function getEngineSignal(rawSymbol, timeframe = "5m", limit = 250) {
  const instrument = resolveInstrument(rawSymbol);
  if (!instrument) {
    throw new NotFoundError(`Unknown instrument "${rawSymbol}"`);
  }

  if (!VALID_TIMEFRAMES.has(timeframe)) {
    throw new BadRequestError(
      `Invalid timeframe "${timeframe}". Valid options: ${[...VALID_TIMEFRAMES].join(", ")}`
    );
  }

  const parsedLimit = Number(limit);
  // Default and floor of 250 candles so EMA200 is meaningful — see the
  // "at least ~200 candles" note in docs/ENGINE_CONTRACT.md.
  const count = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.max(parsedLimit, 250)
    : 250;

  const { candles, source: candleSource } = await getProviderCandles(instrument.key, timeframe, count);
  const csvPath = await writeTempCsv(candlesToCsv(candles));

  try {
    const engineOutput = await runEngine(csvPath);
    const result = {
      symbol: instrument.symbol,
      timeframe,
      candleCount: candles.length,
      candleTimestamp: candles.at(-1)?.timestamp || null,
      dataSource: candleSource,
      analysis: engineOutput.analysis,
      signal: engineOutput.signal
    };

    if (isDatabaseConfigured()) {
      try {
        await saveEngineResult(result);
      } catch (historyError) {
        // History must never take down the live signal path. The signal is
        // still returned to the caller while persistence failure is logged.
        console.error(`Phase 10 history persistence failed for ${result.symbol}:`, historyError.message);
      }
    }

    return result;
  } finally {
    await fs.unlink(csvPath).catch(() => {
      // Best-effort cleanup — a stray temp file isn't worth failing the request over.
    });
  }
}

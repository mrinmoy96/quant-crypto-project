import { WebSocketServer } from "ws";

import { env } from "../config/env.js";
import { listInstruments } from "../data/mockMarketData.js";
import { getEngineSignal } from "../services/engine.service.js";
import { updatePaperPrices } from "../services/paperTrade.service.js";
import { sendTelegramMessage } from "../services/telegramNotifier.js";

// Phase 9: pushes live quote + C++ engine signal updates to connected
// browsers, instead of the client having to poll the REST API.
//
// IMPORTANT design point: there is exactly ONE server-side tick loop,
// not one per connected client. A tick fetches data and runs the C++
// engine ONCE per instrument, then broadcasts the same result to every
// connected client. With N clients this is O(instruments), not
// O(N * instruments) — otherwise 10 open browser tabs would spawn 10x
// as many engine processes every tick.

const WS_PATH = "/ws";

export function attachLiveMarketFeed(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

  let lastTick = null; // cached so new connections get data immediately
  let tickInFlight = false; // guards against overlapping ticks if one runs long
  const lastSignalBySymbol = new Map();

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }

  async function runTick() {
    if (tickInFlight) return; // previous tick still running — skip this one
    tickInFlight = true;

    const instruments = {};
    for (const instrument of listInstruments()) {
      try {
        const result = await getEngineSignal(instrument.key);
        const signalName = result?.signal?.signal || result?.signal || "WAIT";
        const previousSignal = lastSignalBySymbol.get(instrument.key);

        instruments[instrument.key] = {
          symbol: result.symbol,
          dataSource: result.dataSource,
          analysis: result.analysis,
          signal: result.signal,
          error: null
        };

        if (signalName === "BUY" || signalName === "SELL" || signalName === "WAIT") {
          if (previousSignal !== signalName) {
            const price = result?.analysis?.price ?? "unknown";
            const signalEmoji = {
              BUY: "📈",
              SELL: "📉",
              WAIT: "⏳"
            }[signalName] || "📊";
            const message = `${signalEmoji} ${result.symbol} ${signalName} signal\nPrice: ${price}\nTimeframe: ${result.timeframe}`;

            await sendTelegramMessage(message);
            lastSignalBySymbol.set(instrument.key, signalName);
          }
        } else if (previousSignal && previousSignal !== signalName) {
          lastSignalBySymbol.set(instrument.key, signalName);
        }
      } catch (err) {
        // One instrument failing (e.g. engine not built yet) shouldn't
        // stop updates for the other one.
        instruments[instrument.key] = {
          symbol: instrument.symbol,
          dataSource: null,
          analysis: null,
          signal: null,
          error: err.message
        };
      }
    }

    // Phase 11: when paper trading is enabled, update every OPEN paper
    // position from the same live prices used by the dashboard.
    if (env.paperTradingEnabled) {
      const priceMap = {};
      for (const [key, instrument] of Object.entries(instruments)) {
        if (instrument?.analysis?.price != null) {
          priceMap[key] = Number(instrument.analysis.price);
        }
      }
      try {
        await updatePaperPrices(priceMap);
      } catch (err) {
        console.error(`[paper-trading] price evaluation failed: ${err.message}`);
      }
    }

    lastTick = {
      type: "tick",
      timestamp: new Date().toISOString(),
      instruments
    };
    broadcast(lastTick);
    tickInFlight = false;
  }

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    // Send the most recent tick immediately so the client doesn't sit
    // blank until the next interval fires.
    if (lastTick) {
      socket.send(JSON.stringify(lastTick));
    }
  });

  // Heartbeat: terminate connections that stop responding to ping, so a
  // client that disappeared without a clean close (e.g. laptop closed)
  // doesn't sit in wss.clients forever.
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, env.wsHeartbeatIntervalMs);

  const tickTimer = setInterval(runTick, env.wsTickIntervalMs);
  runTick(); // fire the first tick immediately instead of waiting a full interval

  wss.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(tickTimer);
  });

  console.log(
    `WebSocket live feed at ws://localhost:${env.port}${WS_PATH} ` +
    `(tick every ${env.wsTickIntervalMs}ms)`
  );

  return wss;
}

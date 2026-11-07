import WebSocket from "ws";

const url = process.argv[2] || "ws://localhost:5015/ws";
const label = process.argv[3] || "client";
const maxMessages = Number(process.argv[4] || 2);

let count = 0;
const ws = new WebSocket(url);

ws.on("open", () => {
  console.log(`[${label}] connected at ${new Date().toISOString()}`);
});

ws.on("message", (data) => {
  count += 1;
  const msg = JSON.parse(data.toString());
  const symbols = Object.entries(msg.instruments || {})
    .map(([k, v]) => `${k}:${v.signal?.signal ?? "ERR"}(${v.dataSource ?? v.error})`)
    .join(", ");
  console.log(`[${label}] message #${count} at ${msg.timestamp} -> ${symbols}`);
  if (count >= maxMessages) {
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (err) => {
  console.error(`[${label}] error:`, err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error(`[${label}] timed out waiting for ${maxMessages} messages`);
  process.exit(1);
}, 30000);

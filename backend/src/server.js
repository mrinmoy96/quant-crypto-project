import app from "./app.js";
import { env } from "./config/env.js";
import { attachLiveMarketFeed } from "./ws/liveMarketFeed.js";

const httpServer = app.listen(env.port, () => {
  console.log(`Trading backend running on http://localhost:${env.port} (${env.nodeEnv})`);
});

attachLiveMarketFeed(httpServer);

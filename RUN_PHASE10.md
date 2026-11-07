# RUN PHASE 10 (Mac)

Phase 10 = Phase 9 + PostgreSQL signal/trade history.

## 1. Install prerequisites

You need:
- Node.js 18+
- CMake + Apple Command Line Tools
- PostgreSQL (or Docker running PostgreSQL)

Check:

```bash
node -v
npm -v
cmake --version
```

## 2. Create PostgreSQL database

Option A — local PostgreSQL:

Create a database named `trading_system` and make sure PostgreSQL listens on port 5432.

Option B — Docker:

```bash
docker run --name trading-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=trading_system \
  -p 5432:5432 \
  -d postgres:17
```

If the container already exists, use `docker start trading-postgres`.

## 3. Configure backend

From the project root:

```bash
cp backend/.env.example backend/.env
```

Set this in `backend/.env` if using the example PostgreSQL credentials:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trading_system
```

Keep:

```env
CORS_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:5015
```

## 4. Install Node dependencies

From the project root:

```bash
npm install
```

This installs the Phase 10 PostgreSQL `pg` dependency for the backend workspace.

## 5. Build the C++ engine

From the project root:

```bash
cmake -S engine -B engine/build
cmake --build engine/build
./engine/build/engine_tests
```

You should see:

```text
All tests passed
```

## 6. Run PostgreSQL migrations

From the project root:

```bash
npm run db:migrate --workspace backend
```

You should see each migration marked `applied`, followed by:

```text
PostgreSQL migrations complete.
```

## 7. Start the backend

Terminal 1:

```bash
npm run dev:backend
```

Expected:

```text
Trading backend running on http://localhost:5015
WebSocket live feed at ws://localhost:5015/ws
```

Check:

```bash
curl http://localhost:5015/api/health
```

The JSON should report:

```json
{"status":"ok","database":"connected"}
```

## 8. Start React

Terminal 2:

```bash
npm run dev:frontend
```

Open:

`http://localhost:5173`

The dashboard now contains:
- live C++ signals
- bullish/bearish candidate plans
- PostgreSQL signal history
- paper-trade history
- basic P&L analytics

## 9. Create a paper trade manually

Example:

```bash
curl -X POST http://localhost:5015/api/trades \
  -H 'Content-Type: application/json' \
  -d '{
    "symbol":"NIFTY",
    "timeframe":"5m",
    "direction":"BUY",
    "entryPrice":25351,
    "quantity":1,
    "stopLoss":25315,
    "target1":25426,
    "target2":25462
  }'
```

The response contains the trade id.

Close it:

```bash
curl -X POST http://localhost:5015/api/trades/TRADE_ID/close \
  -H 'Content-Type: application/json' \
  -d '{"exitPrice":25426,"exitReason":"TARGET_1"}'
```

## 10. Useful history endpoints

```text
GET /api/history/signals
GET /api/history/plans
GET /api/history/trades
GET /api/history/analytics
```

Examples:

```text
http://localhost:5015/api/history/signals?symbol=NIFTY&signal=BUY
http://localhost:5015/api/history/trades?status=CLOSED
http://localhost:5015/api/history/analytics
```

## Important

Phase 10 is still a research/paper-trading system. It does NOT place broker orders and it does NOT automatically enter or exit real futures/options positions.

CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  trade_plan_id BIGINT REFERENCES trade_plans(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  entry_price NUMERIC(14,4) NOT NULL,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  stop_loss NUMERIC(14,4),
  target1 NUMERIC(14,4),
  target2 NUMERIC(14,4),
  exit_price NUMERIC(14,4),
  exit_reason TEXT,
  realized_pnl NUMERIC(18,4),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_opened
  ON trades (symbol, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status
  ON trades (status);

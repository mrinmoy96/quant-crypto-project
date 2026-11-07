CREATE TABLE IF NOT EXISTS trade_plans (
  id BIGSERIAL PRIMARY KEY,
  signal_id BIGINT REFERENCES market_signals(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BULLISH', 'BEARISH')),
  entry NUMERIC(14,4) NOT NULL,
  stop_loss NUMERIC(14,4) NOT NULL,
  target1 NUMERIC(14,4) NOT NULL,
  target2 NUMERIC(14,4) NOT NULL,
  risk_reward TEXT,
  status TEXT NOT NULL DEFAULT 'CANDIDATE'
    CHECK (status IN ('CANDIDATE', 'ACTIVE', 'CLOSED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  CONSTRAINT uq_trade_plan_signal_direction UNIQUE (signal_id, direction)
);

CREATE INDEX IF NOT EXISTS idx_trade_plans_symbol_created
  ON trade_plans (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_plans_status
  ON trade_plans (status);

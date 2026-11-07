CREATE TABLE IF NOT EXISTS backtest_trades (
  id BIGSERIAL PRIMARY KEY,
  backtest_run_id BIGINT NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  signal_time TIMESTAMPTZ,
  entry_time TIMESTAMPTZ NOT NULL,
  entry_price NUMERIC(14,4) NOT NULL,
  quantity NUMERIC(18,4) NOT NULL,
  stop_loss NUMERIC(14,4) NOT NULL,
  target1 NUMERIC(14,4) NOT NULL,
  target2 NUMERIC(14,4) NOT NULL,
  exit_time TIMESTAMPTZ NOT NULL,
  exit_price NUMERIC(14,4) NOT NULL,
  exit_reason TEXT NOT NULL,
  pnl NUMERIC(18,4) NOT NULL,
  r_multiple NUMERIC(12,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_run
  ON backtest_trades (backtest_run_id, entry_time);

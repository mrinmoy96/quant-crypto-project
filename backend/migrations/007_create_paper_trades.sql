CREATE TABLE IF NOT EXISTS paper_trades (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '5m',
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  entry_price NUMERIC(14,4) NOT NULL,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  stop_loss NUMERIC(14,4),
  target1 NUMERIC(14,4),
  target2 NUMERIC(14,4),
  current_price NUMERIC(14,4),
  exit_price NUMERIC(14,4),
  exit_reason TEXT,
  realized_pnl NUMERIC(18,4),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  source TEXT NOT NULL DEFAULT 'MANUAL',
  signal_score NUMERIC(8,4),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_symbol_status
  ON paper_trades (symbol, status, opened_at DESC);

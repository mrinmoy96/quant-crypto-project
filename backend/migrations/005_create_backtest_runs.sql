CREATE TABLE IF NOT EXISTS backtest_runs (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  initial_capital NUMERIC(18,4) NOT NULL DEFAULT 100000,
  risk_per_trade NUMERIC(6,4) NOT NULL DEFAULT 0.01,
  slippage_bps NUMERIC(8,4) NOT NULL DEFAULT 0,
  fee_per_trade NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_bars INT NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  winning_trades INT NOT NULL DEFAULT 0,
  losing_trades INT NOT NULL DEFAULT 0,
  gross_profit NUMERIC(18,4) NOT NULL DEFAULT 0,
  gross_loss NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_pnl NUMERIC(18,4) NOT NULL DEFAULT 0,
  ending_capital NUMERIC(18,4) NOT NULL DEFAULT 0,
  max_drawdown NUMERIC(18,4) NOT NULL DEFAULT 0,
  profit_factor NUMERIC(18,6),
  win_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_symbol_created
  ON backtest_runs (symbol, created_at DESC);

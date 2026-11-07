CREATE TABLE IF NOT EXISTS market_signals (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price NUMERIC(14,4),
  trend TEXT,
  structure TEXT,
  volume TEXT,
  rsi NUMERIC(10,4),
  atr NUMERIC(14,4),
  vwap NUMERIC(14,4),
  bullish_score NUMERIC(6,2),
  bearish_score NUMERIC(6,2),
  confidence NUMERIC(6,2),
  signal TEXT NOT NULL,
  setup TEXT,
  entry NUMERIC(14,4),
  stop_loss NUMERIC(14,4),
  target1 NUMERIC(14,4),
  target2 NUMERIC(14,4),
  risk_reward TEXT,
  reason TEXT,
  data_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_market_signals_observation UNIQUE (symbol, timeframe, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_market_signals_symbol_time
  ON market_signals (symbol, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_signals_signal_time
  ON market_signals (signal, observed_at DESC);

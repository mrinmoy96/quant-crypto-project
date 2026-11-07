CREATE TABLE IF NOT EXISTS market_forecasts (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forecast_start TIMESTAMPTZ NOT NULL,
  forecast_end TIMESTAMPTZ NOT NULL,
  horizon_minutes INTEGER NOT NULL CHECK (horizon_minutes IN (5, 15, 30, 60)),
  direction TEXT NOT NULL CHECK (direction IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  bullish_score NUMERIC(6,2) NOT NULL,
  bearish_score NUMERIC(6,2) NOT NULL,
  strength NUMERIC(6,2) NOT NULL,
  basis TEXT,
  data_source TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS market_forecasts_unique_window
  ON market_forecasts(symbol, timeframe, horizon_minutes, forecast_start);

CREATE INDEX IF NOT EXISTS market_forecasts_recent_idx
  ON market_forecasts(symbol, forecast_end DESC);

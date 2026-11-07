CREATE TABLE IF NOT EXISTS paper_trade_events (
  id BIGSERIAL PRIMARY KEY,
  paper_trade_id BIGINT NOT NULL REFERENCES paper_trades(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  price NUMERIC(14,4),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_trade_events_trade_time
  ON paper_trade_events (paper_trade_id, occurred_at DESC);

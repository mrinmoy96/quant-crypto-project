import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackCandles } from './candleFallback.js';

test('buildFallbackCandles returns deterministic numeric candles', () => {
  const candles = buildFallbackCandles('btc', '5m', 6);

  assert.equal(candles.length, 6);
  assert.ok(candles.every((c) => Number.isFinite(c.open)));
  assert.ok(candles.every((c) => Number.isFinite(c.high)));
  assert.ok(candles.every((c) => Number.isFinite(c.low)));
  assert.ok(candles.every((c) => Number.isFinite(c.close)));
  assert.ok(candles.every((c) => Number.isFinite(c.volume)));
  assert.ok(candles[0].timestamp);

  const sameAgain = buildFallbackCandles('btc', '5m', 6);
  assert.deepEqual(candles, sameAgain);
});

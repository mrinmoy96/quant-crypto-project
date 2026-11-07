import test from 'node:test';
import assert from 'node:assert/strict';
import { formatForecastCards } from './forecast.js';

test('formatForecastCards includes horizon labels and disclaimer text', () => {
  const cards = formatForecastCards([
    {
      horizonMinutes: 5,
      startTimestamp: 1700000000,
      endTimestamp: 1700000300,
      direction: 'NEUTRAL',
      bullishScore: 52,
      bearishScore: 49,
      strength: 51,
      basis: 'Current directional score + 1-bar momentum.'
    }
  ]);

  assert.equal(cards.length, 1);
  assert.match(cards[0].title, /Next 5 min/);
  assert.match(cards[0].direction, /NEUTRAL/);
  assert.match(cards[0].basis, /momentum/i);
});

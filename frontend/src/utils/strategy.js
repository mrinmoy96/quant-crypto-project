export function buildTimeframeStrategies(signal = {}, price = null) {
  const fallbackPrice = Number(signal?.entry ?? 0);
  const basePrice = Number(price ?? (fallbackPrice || 0));
  const bullishScore = Number(signal?.bullishScore ?? 50);
  const bearishScore = Number(signal?.bearishScore ?? 50);
  const signalType = String(signal.signal || 'WAIT').toUpperCase();

  const configs = [
    { minutes: 5, label: '5 min', bullishBoost: 10, bearishBoost: 0 },
    { minutes: 10, label: '10 min', bullishBoost: 7, bearishBoost: 2 },
    { minutes: 30, label: '30 min', bullishBoost: 4, bearishBoost: 5 },
    { minutes: 60, label: '1 hour', bullishBoost: 2, bearishBoost: 8 },
    { minutes: 1440, label: '1 day', bullishBoost: 0, bearishBoost: 9 }
  ];

  return configs.map(({ minutes, label, bullishBoost, bearishBoost }) => {
    const bullScore = Math.min(99, bullishScore + bullishBoost);
    const bearScore = Math.min(99, bearishScore + bearishBoost);
    const bullishBias = bullScore >= bearScore ? 'Bullish' : 'Neutral';
    const bearishBias = bearScore > bullScore ? 'Bearish' : 'Neutral';

    const entry = basePrice || 100;
    const bullishEntry = entry;
    const bullishStop = entry * 0.995;
    const bullishTarget1 = entry * 1.012;
    const bullishTarget2 = entry * 1.018;

    const bearishEntry = entry;
    const bearishStop = entry * 1.005;
    const bearishTarget1 = entry * 0.988;
    const bearishTarget2 = entry * 0.982;

    return {
      minutes,
      label,
      status: signalType === 'BUY' ? 'Bullish bias' : signalType === 'SELL' ? 'Bearish bias' : 'Research bias',
      bullish: {
        direction: bullishBias,
        score: bullScore,
        entry: bullishEntry,
        stopLoss: bullishStop,
        target1: bullishTarget1,
        target2: bullishTarget2,
        note: 'Bullish continuation setup'
      },
      bearish: {
        direction: bearishBias,
        score: bearScore,
        entry: bearishEntry,
        stopLoss: bearishStop,
        target1: bearishTarget1,
        target2: bearishTarget2,
        note: 'Bearish reversal setup'
      }
    };
  });
}

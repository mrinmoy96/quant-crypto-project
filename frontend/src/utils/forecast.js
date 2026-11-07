function formatTimeRange(startTimestamp, endTimestamp) {
  const start = new Date(Number(startTimestamp) * 1000);
  const end = new Date(Number(endTimestamp) * 1000);

  const fmt = (date) =>
    date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

  return `${fmt(start)} → ${fmt(end)}`;
}

function formatDirectionLabel(direction) {
  return String(direction || 'NEUTRAL').toUpperCase();
}

export function formatForecastCards(forecasts = []) {
  return (forecasts || []).map((forecast) => {
    const horizonMinutes = Number(forecast.horizonMinutes || 0);
    const horizonLabel =
      horizonMinutes === 60
        ? 'Next 60 min'
        : horizonMinutes === 30
          ? 'Next 30 min'
          : horizonMinutes === 15
            ? 'Next 15 min'
            : 'Next 5 min';

    const direction = formatDirectionLabel(forecast.direction);

    return {
      title: horizonLabel,
      direction,
      timeRange: formatTimeRange(forecast.startTimestamp, forecast.endTimestamp),
      bullishScore: Number(forecast.bullishScore ?? 0),
      bearishScore: Number(forecast.bearishScore ?? 0),
      strength: Number(forecast.strength ?? 0),
      basis: forecast.basis || 'Directional research heuristic.',
      expired: Date.now() > Number(forecast.endTimestamp) * 1000
    };
  });
}

export function getForecastDisclaimer() {
  return 'Directional research forecast — not a guaranteed future price or probability.';
}

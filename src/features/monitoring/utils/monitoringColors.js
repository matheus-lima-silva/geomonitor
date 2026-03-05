export const CRITICALITY_COLOR_BY_CODE = {
  C4: 'var(--chart-criticality-c4)',
  C3: 'var(--chart-criticality-c3)',
  C2: 'var(--chart-criticality-c2)',
  C1: 'var(--chart-criticality-c1)',
};

export const HEAT_COLOR_STOPS = {
  critical: 'var(--chart-heat-critical)',
  high: 'var(--chart-heat-high)',
  mediumHigh: 'var(--chart-heat-medium-high)',
  medium: 'var(--chart-heat-medium)',
  low: 'var(--chart-heat-low)',
};

export function getCriticalityChartColor(code) {
  return CRITICALITY_COLOR_BY_CODE[String(code || '').trim()] || CRITICALITY_COLOR_BY_CODE.C1;
}

export function getHeatChartColor(weight) {
  const value = Number(weight);
  if (value >= 0.85) return HEAT_COLOR_STOPS.critical;
  if (value >= 0.65) return HEAT_COLOR_STOPS.high;
  if (value >= 0.45) return HEAT_COLOR_STOPS.mediumHigh;
  if (value >= 0.25) return HEAT_COLOR_STOPS.medium;
  return HEAT_COLOR_STOPS.low;
}

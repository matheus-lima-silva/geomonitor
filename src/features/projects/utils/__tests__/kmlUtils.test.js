import { describe, expect, it } from 'vitest';
import { mergeTowerCoordinates, parseKmlTowers, validateTowerCoordinatesAsString } from '../kmlUtils';

describe('kmlUtils', () => {
  it('returns error for invalid kml', () => {
    const parsed = parseKmlTowers('<kml><bad></kml>');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it('flags invalid coordinates', () => {
    const result = validateTowerCoordinatesAsString([{ numero: 'T1', latitude: 'abc', longitude: '10' }]);
    expect(result.hasErrors).toBe(true);
    expect(result.rows[0].error).toContain('Latitude inválida');
  });

  it('overrides existing tower by imported one', () => {
    const merged = mergeTowerCoordinates(
      [{ numero: '1', latitude: '-10.0', longitude: '-40.0', origem: 'manual' }],
      [{ numero: '1', latitude: '-11.0', longitude: '-41.0' }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].latitude).toBe('-11');
    expect(merged[0].origem).toBe('kml');
  });
});

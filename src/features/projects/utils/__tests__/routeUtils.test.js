import { describe, expect, it } from 'vitest';
import { buildGoogleMapsMultiStopUrl, chunkRoutePoints } from '../routeUtils';

const points = [
  { latitude: '-10.1', longitude: '-40.1' },
  { latitude: '-10.2', longitude: '-40.2' },
  { latitude: '-10.3', longitude: '-40.3' },
];

describe('routeUtils', () => {
  it('chunks points by waypoint limit', () => {
    const many = new Array(15).fill(0).map((_, i) => ({ latitude: String(i), longitude: String(i) }));
    const chunks = chunkRoutePoints(many, 8);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('builds google maps url', () => {
    const url = buildGoogleMapsMultiStopUrl(points);
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('destination=-10.3%2C-40.3');
  });
});

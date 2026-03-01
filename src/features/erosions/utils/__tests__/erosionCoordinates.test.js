import {
  convertUtmToDecimalWgs84,
  hasValidDecimalCoordinates,
  isPartialUtmCoordinates,
  normalizeLocationCoordinates,
  resolveLocationCoordinatesForSave,
} from '../erosionCoordinates';

describe('normalizeLocationCoordinates', () => {
  it('falls back to legacy latitude and longitude fields', () => {
    const out = normalizeLocationCoordinates({
      latitude: '-22.90',
      longitude: '-43.20',
    });
    expect(out.latitude).toBe('-22.90');
    expect(out.longitude).toBe('-43.20');
  });
});

describe('convertUtmToDecimalWgs84', () => {
  it('converts a known equator sample from UTM to decimal', () => {
    const out = convertUtmToDecimalWgs84({
      zone: 31,
      hemisphere: 'N',
      easting: 166021.4431,
      northing: 0,
    });
    expect(out).toBeTruthy();
    expect(Math.abs(out.latitude)).toBeLessThan(0.0001);
    expect(Math.abs(out.longitude)).toBeLessThan(0.0001);
  });

  it('returns null for invalid zone', () => {
    const out = convertUtmToDecimalWgs84({
      zone: 0,
      hemisphere: 'S',
      easting: 683466,
      northing: 7460681,
    });
    expect(out).toBeNull();
  });
});

describe('resolveLocationCoordinatesForSave', () => {
  it('rejects partial UTM coordinates', () => {
    const out = resolveLocationCoordinatesForSave({
      locationCoordinates: {
        utmEasting: '683466',
      },
    });
    expect(out.ok).toBe(false);
    expect(out.error).toContain('UTM');
  });

  it('converts complete UTM coordinates before saving', () => {
    const out = resolveLocationCoordinatesForSave({
      locationCoordinates: {
        utmEasting: '683466',
        utmNorthing: '7460681',
        utmZone: '23',
        utmHemisphere: 'S',
      },
    });
    expect(out.ok).toBe(true);
    expect(out.locationCoordinates.latitude).toBeTruthy();
    expect(out.locationCoordinates.longitude).toBeTruthy();
    expect(Number(out.locationCoordinates.latitude)).toBeLessThan(0);
    expect(Number(out.locationCoordinates.longitude)).toBeLessThan(0);
  });
});

describe('isPartialUtmCoordinates', () => {
  it('detects incomplete UTM payload', () => {
    expect(isPartialUtmCoordinates({
      utmEasting: '500000',
      utmNorthing: '',
      utmZone: '',
      utmHemisphere: '',
    })).toBe(true);
  });
});

describe('hasValidDecimalCoordinates', () => {
  it('validates normalized decimal coordinates', () => {
    expect(hasValidDecimalCoordinates({
      locationCoordinates: {
        latitude: '-22.95',
        longitude: '-43.21',
      },
    })).toBe(true);
  });

  it('returns false for invalid decimals', () => {
    expect(hasValidDecimalCoordinates({
      locationCoordinates: {
        latitude: 'abc',
        longitude: '-43.21',
      },
    })).toBe(false);
  });
});

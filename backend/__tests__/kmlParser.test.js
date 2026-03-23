const {
    normalizeTowerToken,
    normalizeTowerNumber,
    findTowerIdFromSource,
    extractTowerNumberFromText,
    parseCoordinateTuple,
    inferTowerIdFromPath,
    parseKmlPlacemarks,
    hasPorticoMarker,
    formatTowerId,
} = require('../utils/kmlParser');

describe('kmlParser', () => {
    describe('hasPorticoMarker', () => {
        it('detects portico in various forms', () => {
            expect(hasPorticoMarker('Pórtico')).toBe(true);
            expect(hasPorticoMarker('portico')).toBe(true);
            expect(hasPorticoMarker('PORTICO A')).toBe(true);
            expect(hasPorticoMarker('Torre 15')).toBe(false);
            expect(hasPorticoMarker('')).toBe(false);
        });
    });

    describe('formatTowerId', () => {
        it('formats tower number with optional suffix', () => {
            expect(formatTowerId('15')).toBe('15');
            expect(formatTowerId('015')).toBe('15');
            expect(formatTowerId('15', 'A')).toBe('15A');
            expect(formatTowerId('0')).toBe('0');
        });
    });

    describe('normalizeTowerToken', () => {
        it('normalizes simple tower numbers', () => {
            expect(normalizeTowerToken('15')).toBe('15');
            expect(normalizeTowerToken('015')).toBe('15');
            expect(normalizeTowerToken('3A')).toBe('3A');
        });

        it('returns empty for non-tower text', () => {
            expect(normalizeTowerToken('foto_001')).toBe('');
            expect(normalizeTowerToken('')).toBe('');
        });

        it('returns 0 for portico', () => {
            expect(normalizeTowerToken('Pórtico')).toBe('0');
        });
    });

    describe('normalizeTowerNumber', () => {
        it('handles explicit torre prefix', () => {
            expect(normalizeTowerNumber('Torre 15')).toBe('15');
            expect(normalizeTowerNumber('T-003')).toBe('3');
            expect(normalizeTowerNumber('torre_42')).toBe('42');
        });

        it('falls back to normalizeTowerToken', () => {
            expect(normalizeTowerNumber('15')).toBe('15');
        });
    });

    describe('findTowerIdFromSource', () => {
        it('finds tower in simple strings', () => {
            expect(findTowerIdFromSource('Torre 15')).toBe('15');
            expect(findTowerIdFromSource('T-003')).toBe('3');
            expect(findTowerIdFromSource('torre_42')).toBe('42');
        });

        it('returns empty for non-matching text', () => {
            expect(findTowerIdFromSource('random text')).toBe('');
        });
    });

    describe('extractTowerNumberFromText', () => {
        it('tries multiple sources', () => {
            expect(extractTowerNumberFromText('', 'Torre 10')).toBe('10');
            expect(extractTowerNumberFromText('Torre 5', 'Torre 10')).toBe('5');
            expect(extractTowerNumberFromText('', '')).toBe('');
        });
    });

    describe('parseCoordinateTuple', () => {
        it('parses lon,lat,alt tuple', () => {
            const result = parseCoordinateTuple('-43.123,-22.456,100');
            expect(result).toEqual({ lat: -22.456, lon: -43.123, alt: 100 });
        });

        it('parses lon,lat without altitude', () => {
            const result = parseCoordinateTuple('-43.123,-22.456');
            expect(result).toEqual({ lat: -22.456, lon: -43.123, alt: null });
        });

        it('returns null for invalid input', () => {
            expect(parseCoordinateTuple('')).toBeNull();
            expect(parseCoordinateTuple('abc')).toBeNull();
        });
    });

    describe('inferTowerIdFromPath', () => {
        it('infers tower from folder name', () => {
            expect(inferTowerIdFromPath('files/torre_15/foto.jpg')).toBe('15');
            expect(inferTowerIdFromPath('files/15/IMG_001.jpg')).toBe('15');
        });

        it('walks up directories', () => {
            expect(inferTowerIdFromPath('data/15/subdir/foto.jpg')).toBe('15');
        });

        it('returns empty for non-matching paths', () => {
            expect(inferTowerIdFromPath('files/random/foto.jpg')).toBe('');
            expect(inferTowerIdFromPath('foto.jpg')).toBe('');
        });

        it('handles backslash paths', () => {
            expect(inferTowerIdFromPath('files\\torre_15\\foto.jpg')).toBe('15');
        });
    });

    describe('parseKmlPlacemarks', () => {
        it('parses valid KML with point placemarks', () => {
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
              <Document>
                <name>Test</name>
                <Placemark>
                  <name>Torre 15</name>
                  <Point>
                    <coordinates>-43.123,-22.456,100</coordinates>
                  </Point>
                </Placemark>
                <Placemark>
                  <name>Torre 16</name>
                  <Point>
                    <coordinates>-43.124,-22.457,100</coordinates>
                  </Point>
                </Placemark>
              </Document>
            </kml>`;

            const result = parseKmlPlacemarks(kml);
            expect(result.placemarks).toHaveLength(2);
            expect(result.placemarks[0].name).toBe('Torre 15');
            expect(result.placemarks[0].lat).toBeCloseTo(-22.456);
            expect(result.placemarks[0].lon).toBeCloseTo(-43.123);
            expect(result.placemarks[1].name).toBe('Torre 16');
            expect(result.warnings).toHaveLength(0);
        });

        it('ignores placemarks without Point geometry', () => {
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
              <Document>
                <Placemark>
                  <name>Line</name>
                  <LineString>
                    <coordinates>-43.1,-22.4,0 -43.2,-22.5,0</coordinates>
                  </LineString>
                </Placemark>
                <Placemark>
                  <name>Torre 1</name>
                  <Point>
                    <coordinates>-43.1,-22.4,0</coordinates>
                  </Point>
                </Placemark>
              </Document>
            </kml>`;

            const result = parseKmlPlacemarks(kml);
            expect(result.placemarks).toHaveLength(1);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toMatch(/1 Placemark/);
        });

        it('returns warning for empty KML', () => {
            const result = parseKmlPlacemarks('<kml></kml>');
            expect(result.placemarks).toHaveLength(0);
            expect(result.warnings).toHaveLength(1);
        });

        it('extracts folder path for placemarks inside folders', () => {
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
              <Document>
                <Folder>
                  <name>LT123</name>
                  <Placemark>
                    <name>Torre 5</name>
                    <Point>
                      <coordinates>-43.1,-22.4,0</coordinates>
                    </Point>
                  </Placemark>
                </Folder>
              </Document>
            </kml>`;

            const result = parseKmlPlacemarks(kml);
            expect(result.placemarks).toHaveLength(1);
            expect(result.placemarks[0].folderPath).toBe('LT123');
        });
    });
});

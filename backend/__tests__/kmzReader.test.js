const { buildStoredZip } = require('../utils/zipBuilder');
const { readZipEntries, extractKmzContents, isImageFile, isKmlFile } = require('../utils/kmzReader');

describe('kmzReader', () => {
    describe('isImageFile', () => {
        it('recognizes image extensions', () => {
            expect(isImageFile('foto.jpg')).toBe(true);
            expect(isImageFile('IMG_001.JPEG')).toBe(true);
            expect(isImageFile('photo.png')).toBe(true);
            expect(isImageFile('image.gif')).toBe(true);
            expect(isImageFile('image.bmp')).toBe(true);
            expect(isImageFile('image.tiff')).toBe(true);
            expect(isImageFile('image.webp')).toBe(true);
        });

        it('rejects non-image files', () => {
            expect(isImageFile('doc.kml')).toBe(false);
            expect(isImageFile('data.xml')).toBe(false);
            expect(isImageFile('readme.txt')).toBe(false);
            expect(isImageFile('')).toBe(false);
        });
    });

    describe('isKmlFile', () => {
        it('recognizes .kml extension', () => {
            expect(isKmlFile('doc.kml')).toBe(true);
            expect(isKmlFile('DOC.KML')).toBe(true);
        });

        it('rejects non-kml files', () => {
            expect(isKmlFile('foto.jpg')).toBe(false);
        });
    });

    describe('readZipEntries', () => {
        it('reads entries from a ZIP built with zipBuilder', () => {
            const content = Buffer.from('hello world', 'utf8');
            const zip = buildStoredZip([
                { name: 'file1.txt', data: content },
                { name: 'file2.txt', data: Buffer.from('test', 'utf8') },
            ]);

            const entries = readZipEntries(zip);
            expect(entries).toHaveLength(2);
            expect(entries[0].name).toBe('file1.txt');
            expect(entries[0].data.toString('utf8')).toBe('hello world');
            expect(entries[0].isDirectory).toBe(false);
            expect(entries[1].name).toBe('file2.txt');
            expect(entries[1].data.toString('utf8')).toBe('test');
        });

        it('throws for invalid buffer', () => {
            expect(() => readZipEntries(Buffer.from('not a zip'))).toThrow(/invalido/);
        });

        it('handles empty ZIP', () => {
            const zip = buildStoredZip([]);
            const entries = readZipEntries(zip);
            expect(entries).toHaveLength(0);
        });
    });

    describe('extractKmzContents', () => {
        it('extracts KML text and image entries from a KMZ', () => {
            const kmlContent = `<?xml version="1.0"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
              <Document><name>Test</name></Document>
            </kml>`;

            const imageData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

            const kmz = buildStoredZip([
                { name: 'doc.kml', data: Buffer.from(kmlContent, 'utf8') },
                { name: 'files/torre_15/foto.jpg', data: imageData },
                { name: 'files/torre_16/foto2.png', data: imageData },
            ]);

            const result = extractKmzContents(kmz);
            expect(result.kmlText).toContain('<kml');
            expect(result.imageEntries).toHaveLength(2);
            expect(result.imageEntries[0].name).toBe('foto.jpg');
            expect(result.imageEntries[0].internalPath).toBe('files/torre_15/foto.jpg');
            expect(result.imageEntries[1].name).toBe('foto2.png');
            expect(result.imageEntries[1].internalPath).toBe('files/torre_16/foto2.png');
        });

        it('handles KMZ without KML', () => {
            const kmz = buildStoredZip([
                { name: 'foto.jpg', data: Buffer.from([0xFF]) },
            ]);

            const result = extractKmzContents(kmz);
            expect(result.kmlText).toBe('');
            expect(result.imageEntries).toHaveLength(1);
        });

        it('handles KMZ without images', () => {
            const kml = '<kml><Document></Document></kml>';
            const kmz = buildStoredZip([
                { name: 'doc.kml', data: Buffer.from(kml, 'utf8') },
            ]);

            const result = extractKmzContents(kmz);
            expect(result.kmlText).toContain('<kml');
            expect(result.imageEntries).toHaveLength(0);
        });
    });
});

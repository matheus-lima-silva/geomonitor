import { describe, expect, it } from 'vitest';
import { compareTowerNumbers, mergeTowerCoordinates, parseKmlTowers, validateTowerCoordinatesAsString } from '../kmlUtils';

describe('kmlUtils', () => {
  it('returns error for invalid kml', () => {
    const parsed = parseKmlTowers('<kml><bad></kml>');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.meta).toBeTruthy();
    expect(parsed.meta.sigla).toBe('');
    expect(parsed.meta.nome).toBe('');
    expect(parsed.meta.torres).toBe(0);
    expect(parsed.meta.linhaCoordenadas).toEqual([]);
    expect(parsed.meta.linhaNome).toBe('');
  });

  it('flags invalid coordinates', () => {
    const result = validateTowerCoordinatesAsString([{ numero: 'T1', latitude: 'abc', longitude: '10' }]);
    expect(result.hasErrors).toBe(true);
    expect(result.rows[0].error).toContain('Latitude');
  });

  it('parses numbered, portico and suffixed towers from KML points and keeps line metadata', () => {
    const kml = `
      <kml>
        <Document>
          <name>SIMRLE.kmz</name>
          <Placemark>
            <name>SIMRLE1 TRACADO</name>
            <LineString><coordinates>-42,-21,0 -43,-22,0</coordinates></LineString>
          </Placemark>
          <Placemark>
            <name>SIMRLE1 Portico SIM</name>
            <Point><coordinates>-42.79536041,-21.92260055,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <name>SIMRLE1 0001</name>
            <Point><coordinates>-42.79477448,-21.92254088,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <name>SIMRLE1 0163A</name>
            <Point><coordinates>-42.1,-21.1,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <name>SIMRLE1 0163B</name>
            <Point><coordinates>-42.2,-21.2,0</coordinates></Point>
          </Placemark>
        </Document>
      </kml>
    `;

    const parsed = parseKmlTowers(kml);
    expect(parsed.rows.map((r) => r.numero)).toEqual(['0', '1', '163A', '163B']);
    expect(parsed.errors.some((e) => e.includes('Placemark'))).toBe(true);
    expect(parsed.meta.sigla).toBe('SIMRLE');
    expect(parsed.meta.nome).toBe('SIMRLE');
    expect(parsed.meta.torres).toBe(4);
    expect(parsed.meta.extensao).toBe('151.88');
    expect(parsed.meta.lineStringFound).toBe(true);
    expect(parsed.meta.sourceLabel).toBe('SIMRLE.kmz');
    expect(parsed.meta.linhaNome).toBe('SIMRLE1 TRACADO');
    expect(parsed.meta.linhaCoordenadas).toHaveLength(2);
  });

  it('infers sigla from prefix when second token is portico', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>SIMRLE1 Portico SIM</name>
            <Point><coordinates>-42.79536041,-21.92260055,0</coordinates></Point>
          </Placemark>
        </Document>
      </kml>
    `;

    const parsed = parseKmlTowers(kml);
    expect(parsed.rows.map((r) => r.numero)).toEqual(['0']);
    expect(parsed.meta.sigla).toBe('SIMRLE');
    expect(parsed.meta.nome).toBe('');
    expect(parsed.meta.torres).toBe(1);
  });

  it('extracts project name from line placemark and removes circuit suffix', () => {
    const kml = `
      <kml>
        <Document>
          <name>DOCUMENTO-TESTE.kmz</name>
          <Placemark>
            <name>Simplicio - Rocha Leao C1</name>
            <description>SIMRLE1</description>
            <LineString><coordinates>-42,-21,0 -43,-22,0</coordinates></LineString>
          </Placemark>
          <Placemark>
            <name>SIMRLE1 0001</name>
            <Point><coordinates>-42.79477448,-21.92254088,0</coordinates></Point>
          </Placemark>
        </Document>
      </kml>
    `;

    const parsed = parseKmlTowers(kml);
    expect(parsed.meta.nome).toBe('Simplicio - Rocha Leao');
    expect(parsed.meta.linhaFonteKml).toBe('Simplicio - Rocha Leao C1');
  });

  it('extracts sigla from line description when point names do not have prefix', () => {
    const kml = `
      <kml>
        <Document>
          <name>DOCUMENTO-TESTE.kmz</name>
          <Placemark>
            <name>Simplicio - Rocha Leao C1</name>
            <description>SIMRLE1</description>
            <LineString><coordinates>-42,-21,0 -43,-22,0</coordinates></LineString>
          </Placemark>
          <Placemark>
            <name>0001</name>
            <Point><coordinates>-42.79477448,-21.92254088,0</coordinates></Point>
          </Placemark>
        </Document>
      </kml>
    `;

    const parsed = parseKmlTowers(kml);
    expect(parsed.meta.sigla).toBe('SIMRLE');
  });

  it('selects the longest linestring when multiple lines are present', () => {
    const kml = `
      <kml>
        <Document>
          <name>LINHAS.kml</name>
          <Placemark>
            <name>Linha Curta C1</name>
            <description>SHORT1</description>
            <LineString><coordinates>-42,-21,0 -42.001,-21.001,0</coordinates></LineString>
          </Placemark>
          <Placemark>
            <name>Linha Longa C2</name>
            <description>LONG2</description>
            <LineString><coordinates>-42,-21,0 -43,-22,0 -44,-23,10</coordinates></LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const parsed = parseKmlTowers(kml);
    expect(parsed.meta.linhaFonteKml).toBe('Linha Longa C2');
    expect(parsed.meta.linhaNome).toBe('Linha Longa');
    expect(parsed.meta.linhaCoordenadas).toHaveLength(3);
    expect(parsed.meta.extensao).toBe('302.19');
    expect(parsed.meta.sigla).toBe('LONG');
  });

  it('treats suffixed towers as distinct ids', () => {
    const result = validateTowerCoordinatesAsString([
      { numero: '163A', latitude: '-21.1', longitude: '-42.1' },
      { numero: '163B', latitude: '-21.2', longitude: '-42.2' },
    ]);

    expect(result.hasErrors).toBe(false);
    expect(result.rows[0].error).toBe('');
    expect(result.rows[1].error).toBe('');
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

  it('sorts tower ids naturally by number and suffix', () => {
    const ordered = ['163A', '2', '163B', '163', '10', '1'].sort(compareTowerNumbers);
    expect(ordered).toEqual(['1', '2', '10', '163', '163A', '163B']);
  });
});

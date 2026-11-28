import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parseGeometryBytes, parseKmlCoordinateText, MAX_GEOMETRY_VERTICES } from '../geometryFile';
import {
  computeGeometryMetrics,
  nearestPointOnGeometry,
  representativePoint,
  toLeafletPositions,
} from '../geometryMetrics';

// Trecho erodido do acesso da ARAPCA T104 (Google Earth Pro, 12 vertices, ~184 m).
const ARAPCA_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><name>Trecho erodido ACESSO ARAPCA 104.kmz</name>
<Placemark><name>Trecho erodido ACESSO ARAPCA 104</name><LineString><tessellate>1</tessellate><coordinates>
-47.88159868791283,-21.82849163941081,0 -47.88119194084096,-21.82852713027104,0 -47.88104720429905,-21.82847775679172,0 -47.88094795417282,-21.82840112524857,0 -47.88090208950174,-21.82829194903518,0 -47.88091827311733,-21.82814324508993,0 -47.88095718977886,-21.82802413312348,0 -47.88104079242195,-21.82783120935897,0 -47.88102598123413,-21.82769141862818,0 -47.88099572512237,-21.82762531079281,0 -47.88091610490859,-21.82754475074529,0 -47.88083902988955,-21.82748721708275,0
</coordinates></LineString></Placemark></Document></kml>`;

// MAPS.ME: namespace antigo, nomes genericos, ExtendedData proprio.
const MAPSME_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2"><Document>
<Placemark><name>Acessos DOPD.O</name><LineString><coordinates>-46.61998,-21.74445,0 -46.61977,-21.74453,0 -46.6196,-21.74458,0</coordinates></LineString>
<ExtendedData xmlns:mwm="https://maps.me"><mwm:visibility>1</mwm:visibility></ExtendedData></Placemark>
<Placemark><name>Porteira</name><Point><coordinates>-46.6196,-21.74458,0</coordinates></Point></Placemark>
</Document></kml>`;

const TRACK_AND_POLYGON_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document>
<Placemark><name>Trilha</name><gx:Track><when>2026-11-13T13:45:00Z</when><when>2026-11-13T13:46:00Z</when>
<gx:coord>-47.0 -21.0 800</gx:coord><gx:coord>-47.001 -21.001 801</gx:coord></gx:Track></Placemark>
<Placemark><name>Area</name><MultiGeometry>
<Polygon><outerBoundaryIs><LinearRing><coordinates>-47,-21 -46.999,-21 -46.999,-20.999 -47,-20.999 -47,-21</coordinates></LinearRing></outerBoundaryIs></Polygon>
<Point><coordinates>-47,-21</coordinates></Point>
</MultiGeometry></Placemark>
</Document></kml>`;

const GPX = `<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1">
<wpt lat="-21.1" lon="-47.1"><name>Erosao</name></wpt>
<trk><name>Visita</name><trkseg><trkpt lat="-21.0" lon="-47.0"/><trkpt lat="-21.0" lon="-47.0"/><trkpt lat="-21.001" lon="-47.001"/></trkseg></trk>
</gpx>`;

describe('parseGeometryBytes', () => {
  it('le KMZ do Google Earth (linha do acesso da ARAPCA T104)', () => {
    const kmz = zipSync({ 'doc.kml': strToU8(ARAPCA_KML) });
    const { format, features } = parseGeometryBytes(kmz, 'Trecho.kmz');
    expect(format).toBe('kmz');
    expect(features).toHaveLength(1);
    expect(features[0].name).toBe('Trecho erodido ACESSO ARAPCA 104');
    expect(features[0].geometry.type).toBe('LineString');
    expect(features[0].geometry.coordinates).toHaveLength(12);
    expect(features[0].geometry.coordinates[0]).toEqual([-47.8815987, -21.8284916]);
    const metrics = computeGeometryMetrics(features[0].geometry);
    expect(metrics.comprimentoMetros).toBeGreaterThan(182);
    expect(metrics.comprimentoMetros).toBeLessThan(186);
  });

  it('le KML do MAPS.ME (namespace antigo) com linha e ponto', () => {
    const { format, features } = parseGeometryBytes(strToU8(MAPSME_KML), 'acessos.kml');
    expect(format).toBe('kml');
    expect(features.map((f) => [f.name, f.geometry.type])).toEqual([
      ['Acessos DOPD.O', 'LineString'],
      ['Porteira', 'Point'],
    ]);
  });

  it('le gx:Track, poligono e MultiGeometry (uma feicao por geometria)', () => {
    const { features } = parseGeometryBytes(strToU8(TRACK_AND_POLYGON_KML), 'x.kml');
    expect(features.map((f) => [f.name, f.geometry.type])).toEqual([
      ['Trilha', 'LineString'],
      ['Area (1)', 'Polygon'],
      ['Area (2)', 'Point'],
    ]);
    const area = computeGeometryMetrics(features[1].geometry);
    // ~103 m x ~111 m
    expect(area.areaM2).toBeGreaterThan(11000);
    expect(area.areaM2).toBeLessThan(12000);
    expect(area.perimetroMetros).toBeGreaterThan(420);
  });

  it('le GPX (trilha sem pontos repetidos + waypoint)', () => {
    const { format, features } = parseGeometryBytes(strToU8(GPX), 'visita.gpx');
    expect(format).toBe('gpx');
    expect(features.map((f) => [f.name, f.geometry.type])).toEqual([
      ['Visita', 'LineString'],
      ['Erosao', 'Point'],
    ]);
    expect(features[0].geometry.coordinates).toHaveLength(2);
  });

  it('falha com mensagem clara sem feicoes ou com XML invalido', () => {
    expect(() => parseGeometryBytes(strToU8('<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>'), 'a.kml'))
      .toThrow('Nenhum ponto, linha ou poligono');
    expect(() => parseGeometryBytes(strToU8('<kml><Document>'), 'a.kml')).toThrow('XML mal formado');
    expect(() => parseGeometryBytes(zipSync({ 'a.txt': strToU8('x') }), 'a.kmz')).toThrow('nao contem nenhum arquivo .kml');
  });

  it('descarta feicoes acima do limite de vertices', () => {
    const coords = Array.from({ length: MAX_GEOMETRY_VERTICES + 1 }, (_, i) => `-47.${String(i).padStart(6, '0')},-21`).join(' ');
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>Grande</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark></kml>`;
    expect(() => parseGeometryBytes(strToU8(kml), 'g.kml')).toThrow('vertices');
  });
});

describe('geometryMetrics', () => {
  const line = { type: 'LineString', coordinates: parseKmlCoordinateText('-47.0,-21.0 -47.0,-21.001 -47.001,-21.001') };

  it('ponto mais proximo do tracado em relacao a torre', () => {
    const nearest = nearestPointOnGeometry(line, [-46.9995, -21.0005]);
    expect(nearest.point[0]).toBeCloseTo(-47.0, 6);
    expect(nearest.point[1]).toBeCloseTo(-21.0005, 6);
    expect(nearest.distanceM).toBeGreaterThan(50);
    expect(nearest.distanceM).toBeLessThan(55);
  });

  it('ponto representativo e posicoes para o Leaflet', () => {
    const mid = representativePoint(line);
    expect(mid[0]).toBeCloseTo(-47.0, 3);
    expect(toLeafletPositions(line)[0]).toEqual([-21, -47]);
  });
});

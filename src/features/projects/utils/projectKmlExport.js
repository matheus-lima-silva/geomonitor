import { compareTowerNumbers, validateTowerCoordinatesAsString } from './kmlUtils';

function toNumber(value) {
  const num = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function normalizeLineCoordinates(points = []) {
  return (Array.isArray(points) ? points : [])
    .map((point) => {
      const latitude = toNumber(point?.latitude);
      const longitude = toNumber(point?.longitude);
      const altitude = toNumber(point?.altitude);
      if (latitude === null || longitude === null) return null;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
      return { latitude, longitude, altitude: altitude === null ? 0 : altitude };
    })
    .filter(Boolean);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTuple(lon, lat, alt = 0) {
  return `${lon},${lat},${alt}`;
}

export function exportProjectToKml(project) {
  const source = project || {};
  const lineCoordinates = normalizeLineCoordinates(source.linhaCoordenadas);
  const reviewedTowers = validateTowerCoordinatesAsString(source.torresCoordenadas || []).rows
    .filter((row) => !row.error)
    .sort((a, b) => compareTowerNumbers(a.numero, b.numero));

  if (lineCoordinates.length < 2 && reviewedTowers.length === 0) {
    throw new Error('Este empreendimento nao possui geometria suficiente para exportar KML.');
  }

  const projectTitle = escapeXml(source.nome || source.id || 'Empreendimento');
  const lineName = escapeXml(source.linhaFonteKml || `${source.nome || source.id || 'Linha'} C1`);
  const projectId = escapeXml(source.id || '');

  const linePlacemark = lineCoordinates.length >= 2
    ? [
      '    <Placemark>',
      `      <name>${lineName}</name>`,
      projectId ? `      <description>${projectId}</description>` : '',
      '      <LineString>',
      '        <coordinates>',
      `          ${lineCoordinates.map((p) => formatTuple(p.longitude, p.latitude, p.altitude)).join(' ')}`,
      '        </coordinates>',
      '      </LineString>',
      '    </Placemark>',
    ].filter(Boolean).join('\n')
    : '';

  const towerPlacemarks = reviewedTowers
    .map((tower) => {
      const latitude = toNumber(tower.latitude);
      const longitude = toNumber(tower.longitude);
      if (latitude === null || longitude === null) return '';
      return [
        '    <Placemark>',
        `      <name>${escapeXml(`Torre ${tower.numero}`)}</name>`,
        '      <Point>',
        `        <coordinates>${formatTuple(longitude, latitude, 0)}</coordinates>`,
        '      </Point>',
        '    </Placemark>',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>${projectTitle}</name>`,
    linePlacemark,
    towerPlacemarks,
    '  </Document>',
    '</kml>',
  ].filter(Boolean).join('\n');
}

export function downloadProjectKml(project) {
  const kml = exportProjectToKml(project);
  const safeId = String(project?.id || 'empreendimento')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 40) || 'EMPREENDIMENTO';
  const filename = `${safeId}.kml`;
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

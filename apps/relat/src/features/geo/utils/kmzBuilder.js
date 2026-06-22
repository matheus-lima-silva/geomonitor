/**
 * Monta um KMZ (Google Earth) a partir de um lote de fotos, 100% no navegador.
 *
 * Espelha a forma do KML gerado pelo worker (`worker/kmz_renderer.py`): mesmo
 * estilo de marcador de foto (icone de camera) e placemark com a imagem embutida
 * na descricao. Diferencas de escopo (ferramenta standalone, sem workspace):
 *   - so fotos COM coordenada GPS valida viram marcador/arquivo embutido;
 *   - fotos sem GPS sao listadas num README.txt dentro do KMZ (nao viram
 *     placemark vazio, que nao aparece no Earth);
 *   - um unico Folder "Fotos" (sem agrupamento por torre).
 *
 * Zip via `fflate` em modo streaming: le uma imagem por vez (pico de memoria em
 * O(1 imagem)), grava em store (JPEG ja e comprimido) e o doc.kml em deflate.
 */
import { Zip, ZipPassThrough, ZipDeflate, strToU8 } from 'fflate';

import { extractGpsLatLon, isValidLatLon } from './exifGps';

const KMZ_CONTENT_TYPE = 'application/vnd.google-earth.kmz';

// Estilo do marcador de foto (icone de camera publico do Google), igual ao do
// worker para manter a identidade visual entre as duas pontas.
const PHOTO_MARKER_STYLE = [
  '    <Style id="photo-marker">',
  '      <IconStyle>',
  '        <color>ff00aaff</color>',
  '        <scale>1.1</scale>',
  '        <Icon>',
  '          <href>https://maps.google.com/mapfiles/kml/shapes/camera.png</href>',
  '        </Icon>',
  '      </IconStyle>',
  '    </Style>',
].join('\n');

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeCdata(value) {
  return String(value == null ? '' : value).replace(/]]>/g, ']]]]><![CDATA[>');
}

// Espelha `safe_file_name` do worker: troca tudo que nao for [\w.-] por "_".
export function safeFileName(name, fallback = 'foto.jpg') {
  const normalized = normalizeText(name).replace(/[^\w.\-]+/g, '_');
  return normalized || fallback;
}

// Garante extensao de imagem valida (default .jpg, como no worker) e nome unico
// dentro do zip, anexando -1, -2... antes da extensao em caso de colisao.
function uniqueFileName(used, rawName) {
  let candidate = safeFileName(rawName, 'foto.jpg');
  if (!/\.[a-z0-9]{1,5}$/i.test(candidate)) candidate += '.jpg';

  const dot = candidate.lastIndexOf('.');
  const stem = candidate.slice(0, dot);
  const ext = candidate.slice(dot);

  let name = candidate;
  let i = 1;
  while (used.has(name.toLowerCase())) {
    name = `${stem}-${i}${ext}`;
    i += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function buildPhotoPlacemark(entry) {
  const description = sanitizeCdata(
    `<div><img src="${escapeXml(entry.filePath)}" style="max-width:640px;" /></div>`,
  );
  return [
    '      <Placemark>',
    `        <name>${escapeXml(entry.name)}</name>`,
    `        <description><![CDATA[${description}]]></description>`,
    '        <styleUrl>#photo-marker</styleUrl>',
    '        <Point>',
    `          <coordinates>${entry.lon},${entry.lat},0</coordinates>`,
    '        </Point>',
    '      </Placemark>',
  ].join('\n');
}

export function buildKmlDocument(title, entries) {
  const docName = normalizeText(title) || 'Fotos';
  const placemarks = entries.map(buildPhotoPlacemark).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>${escapeXml(docName)}</name>`,
    // Estilo deve preceder os placemarks que o referenciam.
    PHOTO_MARKER_STYLE,
    '    <Folder>',
    '      <name>Fotos</name>',
    placemarks,
    '    </Folder>',
    '  </Document>',
    '</kml>',
  ].join('\n');
}

function buildReadme(title, skipped) {
  return [
    normalizeText(title) || 'Fotos',
    '',
    'Fotos sem coordenadas GPS no EXIF (nao incluidas no mapa):',
    ...skipped.map((name) => `- ${name}`),
  ].join('\n');
}

function pushBytes(zip, name, bytes, compress) {
  const stream = compress ? new ZipDeflate(name) : new ZipPassThrough(name);
  zip.add(stream);
  stream.push(bytes, true);
}

async function readBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Le o lote, resolve GPS por EXIF e devolve um Blob do KMZ.
 *
 * @param {Object} options
 * @param {Array<{name: string, arrayBuffer: () => Promise<ArrayBuffer>}>} options.files
 * @param {string} [options.title]
 * @param {(processed: number, total: number) => void} [options.onProgress]
 * @returns {Promise<{ blob: Blob, markerCount: number, skipped: string[] }>}
 * @throws {Error} se nenhuma foto tiver coordenada GPS valida.
 */
export async function buildKmz({ files, title, onProgress } = {}) {
  const list = Array.from(files || []);
  if (!list.length) {
    throw new Error('Selecione ao menos uma foto.');
  }

  const chunks = [];
  let resolveDone;
  let rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      rejectDone(err);
      return;
    }
    if (chunk && chunk.length) chunks.push(chunk);
    if (final) resolveDone();
  });

  const usedNames = new Set();
  const entries = [];
  const skipped = [];
  const total = list.length;

  // Passe unico: le cada foto uma vez, resolve GPS e ja grava no zip (store).
  // O doc.kml e o README sao gravados no fim, quando todas as coordenadas ja
  // foram resolvidas — a ordem das entradas no zip e irrelevante p/ o Earth.
  for (let index = 0; index < list.length; index += 1) {
    const file = list[index];
    let gps = null;
    try {
      const bytes = await readBytes(file);
      gps = extractGpsLatLon(bytes);
      if (gps && isValidLatLon(gps[0], gps[1])) {
        const fileName = uniqueFileName(usedNames, file.name);
        const filePath = `files/${fileName}`;
        pushBytes(zip, filePath, bytes, false);
        entries.push({ name: file.name, filePath, lat: gps[0], lon: gps[1] });
      } else {
        skipped.push(file.name);
      }
    } catch {
      // Falha ao ler/parsear uma foto nao derruba o lote inteiro.
      skipped.push(file.name);
    }
    if (typeof onProgress === 'function') onProgress(index + 1, total);
  }

  if (!entries.length) {
    // Encerra o stream pra nao vazar o zipador antes de abortar.
    try {
      zip.end();
    } catch {
      // ignore
    }
    throw new Error('Nenhuma foto tem coordenadas GPS no EXIF.');
  }

  pushBytes(zip, 'doc.kml', strToU8(buildKmlDocument(title, entries)), true);
  if (skipped.length) {
    pushBytes(zip, 'README.txt', strToU8(buildReadme(title, skipped)), true);
  }

  zip.end();
  await done;

  return {
    blob: new Blob(chunks, { type: KMZ_CONTENT_TYPE }),
    markerCount: entries.length,
    skipped,
  };
}

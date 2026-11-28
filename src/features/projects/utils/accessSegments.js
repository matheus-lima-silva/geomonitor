// Cores e rotulos dos trechos de acesso (Fase 1b). Cores em hex porque vao
// para pathOptions do Leaflet (nao sao classes Tailwind).
export const SEGMENT_TYPES = ['asfalto', 'terra', 'acesso'];

export const SEGMENT_STYLE = {
  asfalto: { label: 'Asfalto', color: '#374151', swatch: 'bg-slate-700' },
  terra: { label: 'Estrada de terra', color: '#92400e', swatch: 'bg-amber-800' },
  acesso: { label: 'Acesso', color: '#f97316', swatch: 'bg-orange-500' },
};

export const ACTION_LABELS = {
  acesso: 'Acesso da torre',
  rota_guia: 'Rota-guia',
  ignorar: 'Ignorar',
};

export const FLAG_LABELS = {
  sem_osm: 'Sem vias do OSM nesta área',
  tipo_inferido: 'Tipo de via inferido',
  passa_perto_da_torre: 'Passa perto de uma torre',
  acesso_curto: 'Trecho de acesso curto (< 30 m)',
};

export function nextSegmentType(tipo) {
  const index = SEGMENT_TYPES.indexOf(tipo);
  return SEGMENT_TYPES[(index + 1) % SEGMENT_TYPES.length];
}

/** Troca o tipo de um trecho (repintura manual). */
export function repaintSegment(segments, index) {
  return segments.map((segment, i) => (i === index
    ? { ...segment, tipo: nextSegmentType(segment.tipo), manual: true, inferido: false }
    : segment));
}

export function summarizeSegments(segments = []) {
  return segments.reduce((acc, s) => {
    acc[s.tipo] = (acc[s.tipo] || 0) + (Number(s.comprimentoM) || 0);
    return acc;
  }, {});
}

export function formatLength(meters) {
  const value = Number(meters) || 0;
  return value >= 1000
    ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
    : `${Math.round(value).toLocaleString('pt-BR')} m`;
}

/** "1,2 km de terra + 290 m de acesso" */
export function describeSegments(segments = []) {
  const totals = summarizeSegments(segments);
  return SEGMENT_TYPES
    .filter((tipo) => totals[tipo] > 0)
    .map((tipo) => `${formatLength(totals[tipo])} de ${SEGMENT_STYLE[tipo].label.toLowerCase()}`)
    .join(' + ');
}

export const toLatLng = (coords = []) => coords.map(([lon, lat]) => [lat, lon]);

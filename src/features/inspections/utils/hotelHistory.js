export const HOTEL_FIELD_NAMES = [
  'hotelNome',
  'hotelMunicipio',
  'hotelLogisticaNota',
  'hotelReservaNota',
  'hotelEstadiaNota',
  'hotelTorreBase',
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeHotelKey(hotelNome, hotelMunicipio) {
  return `${normalizeText(hotelNome).toLowerCase()}|${normalizeText(hotelMunicipio).toLowerCase()}`;
}

function toIsoDate(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getInspectionDayIsoDate(inspection, day) {
  return toIsoDate(day?.data)
    || toIsoDate(inspection?.dataFim)
    || toIsoDate(inspection?.dataInicio)
    || toIsoDate(inspection?.data)
    || '';
}

function toDateScore(isoDate) {
  if (!isoDate) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return Number.NEGATIVE_INFINITY;
  return parsed.getTime();
}

export function extractHotelFields(day = {}) {
  return {
    hotelNome: normalizeText(day?.hotelNome),
    hotelMunicipio: normalizeText(day?.hotelMunicipio),
    hotelLogisticaNota: normalizeText(day?.hotelLogisticaNota),
    hotelReservaNota: normalizeText(day?.hotelReservaNota),
    hotelEstadiaNota: normalizeText(day?.hotelEstadiaNota),
    hotelTorreBase: normalizeText(day?.hotelTorreBase),
  };
}

export function hasAnyHotelData(day = {}) {
  const hotelData = extractHotelFields(day);
  return HOTEL_FIELD_NAMES.some((field) => normalizeText(hotelData[field]) !== '');
}

function createSourceList({ inspections = [], draftInspection, projectId }) {
  const normalizedProjectId = normalizeText(projectId);
  if (!normalizedProjectId) return [];

  const source = (inspections || [])
    .filter((inspection) => normalizeText(inspection?.projetoId) === normalizedProjectId);

  if (!draftInspection || normalizeText(draftInspection?.projetoId) !== normalizedProjectId) {
    return source;
  }

  const draftId = normalizeText(draftInspection?.id);
  if (!draftId) return [...source, draftInspection];

  let replaced = false;
  const withDraft = source.map((inspection) => {
    if (normalizeText(inspection?.id) !== draftId) return inspection;
    replaced = true;
    return draftInspection;
  });

  return replaced ? withDraft : [...withDraft, draftInspection];
}

export function buildHotelHistory({ inspections = [], draftInspection = null, projectId = '' } = {}) {
  const grouped = new Map();

  createSourceList({ inspections, draftInspection, projectId }).forEach((inspection) => {
    const days = Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias : [];
    days.forEach((day) => {
      const hotelData = extractHotelFields(day);
      if (!hotelData.hotelNome) return;

      const key = normalizeHotelKey(hotelData.hotelNome, hotelData.hotelMunicipio);
      const isoDate = getInspectionDayIsoDate(inspection, day);
      const score = toDateScore(isoDate);

      const previous = grouped.get(key) || {
        key,
        usageCount: 0,
        lastDate: '',
        lastDateScore: Number.NEGATIVE_INFINITY,
        ...hotelData,
      };

      previous.usageCount += 1;
      if (score > previous.lastDateScore) {
        previous.lastDate = isoDate;
        previous.lastDateScore = score;
        previous.hotelNome = hotelData.hotelNome;
        previous.hotelMunicipio = hotelData.hotelMunicipio;
        previous.hotelLogisticaNota = hotelData.hotelLogisticaNota;
        previous.hotelReservaNota = hotelData.hotelReservaNota;
        previous.hotelEstadiaNota = hotelData.hotelEstadiaNota;
        previous.hotelTorreBase = hotelData.hotelTorreBase;
      }

      grouped.set(key, previous);
    });
  });

  return [...grouped.values()]
    .sort((a, b) => {
      if (a.lastDateScore !== b.lastDateScore) return b.lastDateScore - a.lastDateScore;
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
      return String(a.hotelNome || '').localeCompare(String(b.hotelNome || ''), 'pt-BR', { sensitivity: 'base' });
    })
    .map((item) => ({
      key: item.key,
      usageCount: item.usageCount,
      lastDate: item.lastDate,
      hotelNome: item.hotelNome,
      hotelMunicipio: item.hotelMunicipio,
      hotelLogisticaNota: item.hotelLogisticaNota,
      hotelReservaNota: item.hotelReservaNota,
      hotelEstadiaNota: item.hotelEstadiaNota,
      hotelTorreBase: item.hotelTorreBase,
    }));
}

function getPreviousIsoDate(currentIsoDate) {
  const date = toIsoDate(currentIsoDate);
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setDate(parsed.getDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

export function findPreviousDayHotel(detailsDays = [], selectedDate = '') {
  const previousIsoDate = getPreviousIsoDate(selectedDate);
  if (!previousIsoDate) return null;

  const previousDay = (Array.isArray(detailsDays) ? detailsDays : [])
    .find((day) => normalizeText(day?.data) === previousIsoDate);
  if (!previousDay || !hasAnyHotelData(previousDay)) return null;

  return {
    date: previousIsoDate,
    ...extractHotelFields(previousDay),
  };
}

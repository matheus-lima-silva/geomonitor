/**
 * Analise pura das fotos de uma campanha de vistoria a partir dos metadados
 * EXIF (`utils/photoCampaign/exifMeta.js`): resolve a torre de cada foto
 * (etiqueta > pasta > GPS), agrupa por dia e por torre em ordem de visita,
 * aponta divergencias de legenda e propoe a mesclagem no diario da vistoria.
 *
 * Sem React, sem rede, sem DOM: tudo determinístico e testavel. Consumido pelo
 * wizard de vistoria (PR1) e pelo import de fotos do workspace (PR3).
 *
 * Datas: `capturedDate`/`capturedTime` sao strings locais ("YYYY-MM-DD",
 * "HH:MM") vindas do EXIF — nunca passam por Date/UTC aqui.
 */
import { gerarPeriodoDias, preservarDetalhesDias } from '../dateUtils';
import { isValidLatLon } from '../exifGps';
import { compareTowerNumbers } from '../../features/projects/utils/kmlUtils';
import {
  haversineMeters,
  inferTowerIdFromRelativePath,
  normalizeTowerToken,
} from '../../features/reports/utils/reportUtils';

/** Limiares calibrados na campanha BMDOPR set/2026 (413 fotos, 369 torres). */
export const TOWER_MATCH = Object.freeze({
  confirmM: 150, // etiqueta confirmada pelo GPS
  suggestM: 400, // sem etiqueta: GPS so sugere ate aqui
  conflictNearM: 50, // outra torre a menos disto...
  conflictFarM: 250, // ...e a etiquetada a mais disto => legenda errada
  sessionGapMin: 20, // gap entre fotos da mesma torre => sessao dupla
  spreadM: 200, // espalhamento entre fotos da mesma torre
});

export const GAP_DAY_REASONS = Object.freeze([
  { value: '', label: 'Selecione o motivo...' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'chuva', label: 'Chuva - sem atividade em campo' },
  { value: 'deslocamento', label: 'Deslocamento entre trechos' },
  { value: 'outro', label: 'Outro' },
]);

const LABEL_RE = /^([A-Z0-9_-]{2,})\s*[\r\n]+\s*(\d{1,4}[A-Z]?)\s*$/i;
const FREE_TEXT_TOWER_RE = /\bT(?:ORRE)?\.?\s*(\d{1,4}[A-Z]?)\b/i;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTowerKey(value) {
  const normalized = normalizeTowerToken(value);
  if (normalized) return normalized;
  return String(value || '').trim().toUpperCase();
}

function toFinite(value) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function timeToMinutes(time) {
  const match = /^(\d{2}):(\d{2})/.exec(String(time || ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function weekdayOf(dateIso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || ''));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
}

function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function formatMeters(value) {
  if (!Number.isFinite(value)) return '';
  return `${Math.round(value).toLocaleString('pt-BR')} m`;
}

/**
 * Interpreta a `ImageDescription` do Timestamp Camera.
 *
 * Forma canonica: "SIGLA\nNUMERO" (espacos/quebras extras tolerados). Texto
 * livre ("... TORRE 333") so vale se citar a sigla ou o nome do empreendimento.
 * `projectNames` aceita string ou lista (id e nome do empreendimento).
 */
export function parseDescriptionLabel(description, projectNames) {
  const text = String(description || '').replace(/\0/g, '').trim();
  if (!text) return null;
  const names = (Array.isArray(projectNames) ? projectNames : [projectNames])
    .map(normalizeText)
    .filter(Boolean);
  const matchesProject = (candidate) => {
    const normalized = normalizeText(candidate);
    return names.length === 0 || names.some((name) => normalized === name || normalized.includes(name));
  };

  const canonical = LABEL_RE.exec(text);
  if (canonical) {
    const sigla = canonical[1].toUpperCase();
    const tower = normalizeTowerKey(canonical[2]);
    return { sigla, tower, siglaMismatch: !matchesProject(sigla) };
  }

  const free = FREE_TEXT_TOWER_RE.exec(text);
  if (free) {
    const mentionsProject = matchesProject(text);
    return {
      sigla: mentionsProject ? (names[0] || '') : '',
      tower: normalizeTowerKey(free[1]),
      siglaMismatch: !mentionsProject,
    };
  }
  return null;
}

/** Torres com coordenada do empreendimento, numero normalizado. */
export function buildTowerIndex(project) {
  const coords = Array.isArray(project?.torresCoordenadas) ? project.torresCoordenadas : [];
  const index = [];
  const seen = new Set();
  for (const item of coords) {
    const numero = normalizeTowerKey(item?.numero);
    const lat = toFinite(item?.latitude);
    const lon = toFinite(item?.longitude);
    if (!numero || lat === null || lon === null || !isValidLatLon(lat, lon) || seen.has(numero)) continue;
    seen.add(numero);
    index.push({ numero, lat, lon });
  }
  return index;
}

/** As `k` torres mais proximas de um ponto, com distancia em metros. */
export function findNearestTowers(index, lat, lon, k = 2) {
  if (!Array.isArray(index) || !isValidLatLon(lat, lon)) return [];
  const ranked = [];
  for (const tower of index) {
    const distanceM = haversineMeters([lat, lon], [tower.lat, tower.lon]);
    if (distanceM === null) continue;
    ranked.push({ numero: tower.numero, distanceM });
  }
  ranked.sort((a, b) => a.distanceM - b.distanceM);
  return ranked.slice(0, Math.max(0, k));
}

/** Contexto de resolucao para um empreendimento. */
export function buildResolutionContext(project, { thresholds } = {}) {
  const towerIndex = buildTowerIndex(project);
  const knownTowers = new Set(towerIndex.map((tower) => tower.numero));
  const total = Number(project?.torres || 0);
  if (knownTowers.size === 0 && Number.isInteger(total) && total > 0 && total <= 5000) {
    for (let i = 1; i <= total; i += 1) knownTowers.add(String(i));
  }
  return {
    projectId: String(project?.id || '').trim(),
    projectNames: [project?.id, project?.nome].filter(Boolean),
    towerIndex,
    towerById: new Map(towerIndex.map((tower) => [tower.numero, tower])),
    knownTowers,
    thresholds: { ...TOWER_MATCH, ...(thresholds || {}) },
  };
}

/**
 * Resolve a torre de UMA foto. `photo` traz os metadados EXIF
 * ({ key, name, relativePath, gpsLat, gpsLon, capturedAt, capturedDate,
 * capturedTime, description }).
 */
export function resolvePhotoTower(photo, ctx) {
  const t = ctx.thresholds || TOWER_MATCH;
  const issues = [];
  const label = parseDescriptionLabel(photo?.description, ctx.projectNames);
  const labelTower = label && !label.siglaMismatch ? label.tower : null;
  if (label?.siglaMismatch) issues.push('sigla_mismatch');

  const folderTower = inferTowerIdFromRelativePath(photo?.relativePath) || null;
  const lat = toFinite(photo?.gpsLat);
  const lon = toFinite(photo?.gpsLon);
  const hasGps = lat !== null && lon !== null && isValidLatLon(lat, lon);
  if (!hasGps) issues.push('no_gps');
  if (!photo?.capturedDate) issues.push('no_date');

  const [nearest = null, second = null] = hasGps ? findNearestTowers(ctx.towerIndex, lat, lon, 2) : [];

  const base = {
    ...photo,
    labelTower,
    folderTower,
    nearest,
    second,
    tower: null,
    source: null,
    confidence: null,
    distanceToTowerM: null,
    conflict: null,
    issues,
  };

  const candidate = labelTower ?? folderTower ?? null;
  if (candidate) {
    const source = labelTower ? 'label' : 'folder';
    if (ctx.knownTowers.size > 0 && !ctx.knownTowers.has(candidate)) issues.push('unknown_tower');
    const coord = ctx.towerById.get(candidate);
    const d = hasGps && coord ? haversineMeters([lat, lon], [coord.lat, coord.lon]) : null;

    if (d === null) {
      return { ...base, tower: candidate, source, confidence: 'medium' };
    }
    if (d <= t.confirmM) {
      return { ...base, tower: candidate, source, confidence: 'high', distanceToTowerM: d };
    }
    if (nearest && nearest.numero !== candidate && nearest.distanceM <= t.conflictNearM && d >= t.conflictFarM) {
      return {
        ...base,
        tower: candidate,
        source,
        confidence: 'low',
        distanceToTowerM: d,
        conflict: {
          labeled: candidate,
          suggested: nearest.numero,
          labeledDistanceM: d,
          suggestedDistanceM: nearest.distanceM,
        },
      };
    }
    if (d > t.conflictFarM) issues.push('far_from_label');
    return { ...base, tower: candidate, source, confidence: 'medium', distanceToTowerM: d };
  }

  if (hasGps && nearest) {
    if (nearest.distanceM <= t.confirmM) {
      return { ...base, tower: nearest.numero, source: 'gps', confidence: 'medium', distanceToTowerM: nearest.distanceM };
    }
    if (nearest.distanceM <= t.suggestM) {
      return { ...base, tower: nearest.numero, source: 'gps', confidence: 'low', distanceToTowerM: nearest.distanceM };
    }
    issues.push('far_from_any_tower');
  }
  return base;
}

const SOURCE_RANK = { label: 3, folder: 2, gps: 1 };

function pickSource(photos) {
  let best = null;
  for (const photo of photos) {
    if (!photo.source) continue;
    if (!best || SOURCE_RANK[photo.source] > SOURCE_RANK[best]) best = photo.source;
  }
  return best;
}

function pickConfidence(photos) {
  if (photos.some((p) => p.conflict)) return 'low';
  if (photos.some((p) => p.confidence === 'high')) return 'high';
  if (photos.every((p) => p.confidence === 'low')) return 'low';
  return 'medium';
}

function summarizeConflict(photos) {
  const conflicting = photos.filter((p) => p.conflict);
  if (!conflicting.length) return null;
  const counts = new Map();
  for (const p of conflicting) counts.set(p.conflict.suggested, (counts.get(p.conflict.suggested) || 0) + 1);
  const [suggested] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const chosen = conflicting.filter((p) => p.conflict.suggested === suggested);
  return {
    labeled: chosen[0].conflict.labeled,
    suggested,
    count: chosen.length,
    labeledDistanceM: median(chosen.map((p) => p.conflict.labeledDistanceM)),
    suggestedDistanceM: Math.min(...chosen.map((p) => p.conflict.suggestedDistanceM)),
    firstAt: chosen[0].capturedTime || null,
    lastAt: chosen[chosen.length - 1].capturedTime || null,
    photoKeys: chosen.map((p) => p.key),
  };
}

function splitSessions(photos, gapMinutes) {
  const sessions = [];
  for (const photo of photos) {
    const minutes = timeToMinutes(photo.capturedTime);
    const current = sessions[sessions.length - 1];
    if (!current || minutes === null || current.lastMinutes === null || minutes - current.lastMinutes > gapMinutes) {
      sessions.push({ photos: [photo], firstAt: photo.capturedTime, lastAt: photo.capturedTime, lastMinutes: minutes });
    } else {
      current.photos.push(photo);
      current.lastAt = photo.capturedTime;
      current.lastMinutes = minutes;
    }
  }
  return sessions;
}

function maxSpread(photos) {
  let max = 0;
  const points = photos
    .map((p) => [toFinite(p.gpsLat), toFinite(p.gpsLon)])
    .filter(([lat, lon]) => lat !== null && lon !== null && isValidLatLon(lat, lon));
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const d = haversineMeters(points[i], points[j]);
      if (d !== null && d > max) max = d;
    }
  }
  return max;
}

function buildTowerGroup(date, numero, photos, t) {
  const sorted = [...photos].sort((a, b) => String(a.capturedAt || '').localeCompare(String(b.capturedAt || '')));
  const conflict = summarizeConflict(sorted);
  const source = pickSource(sorted);
  const nearestAlt = (() => {
    const counts = new Map();
    for (const p of sorted) {
      const alt = p.nearest?.numero;
      if (alt && alt !== numero) counts.set(alt, (counts.get(alt) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();
  const distances = sorted.map((p) => p.distanceToTowerM).filter(Number.isFinite);
  return {
    key: `${date}|${numero}`,
    date,
    numero,
    count: sorted.length,
    firstAt: sorted[0]?.capturedTime || null,
    lastAt: sorted[sorted.length - 1]?.capturedTime || null,
    source,
    confidence: pickConfidence(sorted),
    conflict,
    nearestAlt,
    medianDistanceM: median(distances),
    defaultIncluded: source !== 'gps',
    sessions: splitSessions(sorted, t.sessionGapMin),
    spreadM: maxSpread(sorted),
    photos: sorted,
  };
}

function describeConflict(group) {
  const c = group.conflict;
  return `${c.count} foto${c.count > 1 ? 's' : ''} etiquetada${c.count > 1 ? 's' : ''} ${c.labeled}`
    + `${c.firstAt ? ` às ${c.firstAt}` : ''} ${c.count > 1 ? 'estão' : 'está'} a ${formatMeters(c.suggestedDistanceM)} da torre ${c.suggested}.`
    + ` A torre ${c.labeled} fica a ${formatMeters(c.labeledDistanceM)}.`;
}

function buildDivergences(group, t) {
  const out = [];
  if (group.conflict) {
    out.push({
      id: `conflict|${group.key}`,
      kind: 'label_conflict',
      severity: 'action',
      date: group.date,
      numero: group.numero,
      suggested: group.conflict.suggested,
      photoCount: group.conflict.count,
      photoKeys: group.conflict.photoKeys,
      text: describeConflict(group),
    });
  }
  if (group.sessions.length > 1) {
    const parts = group.sessions.map((s) => {
      const med = median(s.photos.map((p) => p.distanceToTowerM));
      return `${s.firstAt}${s.lastAt && s.lastAt !== s.firstAt ? `–${s.lastAt}` : ''} (${s.photos.length} foto${s.photos.length > 1 ? 's' : ''}${Number.isFinite(med) ? `, ${formatMeters(med)} da torre` : ''})`;
    });
    out.push({
      id: `session|${group.key}`,
      kind: 'double_session',
      severity: 'info',
      date: group.date,
      numero: group.numero,
      suggested: null,
      photoCount: group.count,
      photoKeys: group.photos.map((p) => p.key),
      text: `Torre ${group.numero} fotografada em ${group.sessions.length} momentos separados: ${parts.join(' | ')}.`,
    });
  }
  if (group.spreadM > t.spreadM) {
    out.push({
      id: `spread|${group.key}`,
      kind: 'spread',
      severity: 'info',
      date: group.date,
      numero: group.numero,
      suggested: null,
      photoCount: group.count,
      photoKeys: group.photos.map((p) => p.key),
      text: `Fotos da torre ${group.numero} espalhadas por ${formatMeters(group.spreadM)} entre si.`,
    });
  }
  const far = group.photos.filter((p) => !p.conflict && Number.isFinite(p.distanceToTowerM) && p.distanceToTowerM > t.conflictFarM);
  if (far.length) {
    out.push({
      id: `far|${group.key}`,
      kind: 'far_from_label',
      severity: 'info',
      date: group.date,
      numero: group.numero,
      suggested: group.nearestAlt,
      photoCount: far.length,
      photoKeys: far.map((p) => p.key),
      text: `${far.length} foto${far.length > 1 ? 's' : ''} da torre ${group.numero} a ${formatMeters(median(far.map((p) => p.distanceToTowerM)))} da torre cadastrada`
        + `${group.nearestAlt ? ` (torre vizinha ${group.nearestAlt} a ${formatMeters(Math.min(...far.map((p) => p.nearest?.distanceM ?? Infinity)))})` : ''}. Provavelmente foto de longe.`,
    });
  }
  return out;
}

/**
 * Analisa a campanha inteira. `photos` sao metadados por foto; `project` traz
 * `id`, `nome`, `torres` e `torresCoordenadas`; `holidaysIndex` e o Map do
 * `buildFeriadosIndex` (opcional).
 */
export function analyzePhotoCampaign(photos, project, { thresholds, holidaysIndex } = {}) {
  const ctx = buildResolutionContext(project, { thresholds });
  const t = ctx.thresholds;
  const resolved = (Array.isArray(photos) ? photos : []).map((photo, index) => resolvePhotoTower(
    { ...photo, key: photo?.key || `${photo?.name || 'foto'}#${index}` },
    ctx,
  ));

  const undated = resolved.filter((p) => !p.capturedDate);
  const dated = resolved.filter((p) => p.capturedDate);

  const byDate = new Map();
  for (const photo of dated) {
    if (!byDate.has(photo.capturedDate)) byDate.set(photo.capturedDate, []);
    byDate.get(photo.capturedDate).push(photo);
  }

  const holidayOf = (date) => (holidaysIndex && typeof holidaysIndex.get === 'function' ? holidaysIndex.get(date) || null : null);

  const days = [...byDate.keys()].sort().map((date) => {
    const list = byDate.get(date);
    const byTower = new Map();
    const unresolved = [];
    for (const photo of list) {
      if (!photo.tower) {
        unresolved.push(photo);
        continue;
      }
      const key = normalizeTowerKey(photo.tower);
      if (!byTower.has(key)) byTower.set(key, []);
      byTower.get(key).push(photo);
    }
    const towers = [...byTower.entries()]
      .map(([numero, group]) => buildTowerGroup(date, numero, group, t))
      .sort((a, b) => String(a.firstAt || '').localeCompare(String(b.firstAt || '')) || compareTowerNumbers(a.numero, b.numero));
    const times = list.map((p) => p.capturedTime).filter(Boolean).sort();
    const holiday = holidayOf(date);
    return {
      data: date,
      weekday: weekdayOf(date),
      firstAt: times[0] || null,
      lastAt: times[times.length - 1] || null,
      photoCount: list.length,
      towers,
      unresolved,
      isHoliday: Boolean(holiday),
      holidayName: holiday?.nome || null,
      hasPhotos: true,
    };
  });

  const dateRange = days.length ? { start: days[0].data, end: days[days.length - 1].data } : null;
  const photoDates = new Set(days.map((d) => d.data));
  const gapDays = dateRange
    ? gerarPeriodoDias(dateRange.start, dateRange.end)
      .filter((date) => !photoDates.has(date))
      .map((date) => {
        const holiday = holidayOf(date);
        return { data: date, weekday: weekdayOf(date), isHoliday: Boolean(holiday), holidayName: holiday?.nome || null, isWeekend: false };
      })
    : [];

  const divergences = days.flatMap((day) => day.towers.flatMap((group) => buildDivergences(group, t)));

  const towerDays = new Map();
  for (const day of days) {
    for (const group of day.towers) {
      if (!towerDays.has(group.numero)) towerDays.set(group.numero, new Set());
      towerDays.get(group.numero).add(day.data);
    }
  }

  const stats = {
    total: resolved.length,
    dated: dated.length,
    undated: undated.length,
    withGps: resolved.filter((p) => !p.issues.includes('no_gps')).length,
    byLabel: resolved.filter((p) => p.source === 'label').length,
    byFolder: resolved.filter((p) => p.source === 'folder').length,
    byGps: resolved.filter((p) => p.source === 'gps').length,
    unresolved: resolved.filter((p) => !p.tower).length,
    conflicts: divergences.filter((d) => d.kind === 'label_conflict').length,
    infoDivergences: divergences.filter((d) => d.severity === 'info').length,
    towers: towerDays.size,
    gpsOnlyGroups: days.reduce((acc, day) => acc + day.towers.filter((g) => g.source === 'gps').length, 0),
    towersRepeatedAcrossDays: [...towerDays.entries()].filter(([, dates]) => dates.size > 1).map(([numero]) => numero).sort(compareTowerNumbers),
    gapDays: gapDays.length,
  };

  return { projectId: ctx.projectId, days, gapDays, undated, dateRange, divergences, stats };
}

/** Decisoes iniciais da revisao: torres GPS-only desmarcadas, conflitos pendentes, dias de gap mantidos. */
export function buildDefaultDecisions(analysis) {
  const towers = {};
  const divergences = {};
  const gapDays = {};
  for (const day of analysis?.days || []) {
    for (const group of day.towers) {
      towers[group.key] = { include: group.defaultIncluded, numero: group.numero };
    }
  }
  for (const divergence of analysis?.divergences || []) {
    if (divergence.kind !== 'label_conflict') continue;
    divergences[divergence.id] = { status: 'pending', numero: divergence.suggested };
  }
  for (const gap of analysis?.gapDays || []) {
    gapDays[gap.data] = { keep: true, reason: gap.isHoliday ? 'feriado' : '' };
  }
  return { towers, divergences, gapDays };
}

function defaultShapeDay(day) {
  const towers = [...(day?.torresDetalhadas || [])]
    .map((tower) => ({ numero: String(tower?.numero || '').trim(), obs: String(tower?.obs || ''), temErosao: !!tower?.temErosao }))
    .filter((tower) => tower.numero)
    .sort((a, b) => compareTowerNumbers(a.numero, b.numero));
  const numbers = towers.map((tower) => tower.numero);
  return {
    ...day,
    data: String(day?.data || '').trim(),
    clima: String(day?.clima || '').trim(),
    torres: numbers,
    torresInput: numbers.join(', '),
    torresDetalhadas: towers,
  };
}

/**
 * Mescla a analise (filtrada pelas decisoes) no form da vistoria. Nunca remove
 * torres nem altera clima/hotel/obs existentes; datas so expandem.
 * `ensureDayShape` pode ser injetado (o do wizard) para normalizar os dias.
 */
export function mergeAnalysisIntoForm(form, analysis, decisions, { ensureDayShape = defaultShapeDay } = {}) {
  const source = { ...(form || {}) };
  const towersDecisions = decisions?.towers || {};
  const divergenceDecisions = decisions?.divergences || {};
  const gapDecisions = decisions?.gapDays || {};

  // 1. Torres aceitas por dia (ja aplicando correcoes de divergencia confirmadas).
  const additions = new Map(); // date -> Set(numero)
  const addTower = (date, numero) => {
    if (!date || !numero) return;
    if (!additions.has(date)) additions.set(date, new Set());
    additions.get(date).add(normalizeTowerKey(numero));
  };
  const conflictByGroup = new Map();
  for (const divergence of analysis?.divergences || []) {
    if (divergence.kind === 'label_conflict') conflictByGroup.set(`${divergence.date}|${divergence.numero}`, divergence);
  }

  let skippedUnresolved = 0;
  for (const day of analysis?.days || []) {
    skippedUnresolved += day.unresolved.length;
    for (const group of day.towers) {
      const decision = towersDecisions[group.key] || { include: group.defaultIncluded, numero: group.numero };
      if (!decision.include) continue;
      const conflict = conflictByGroup.get(group.key);
      const conflictDecision = conflict ? divergenceDecisions[conflict.id] : null;
      if (conflict && conflictDecision?.status === 'confirmed' && conflictDecision.numero && normalizeTowerKey(conflictDecision.numero) !== normalizeTowerKey(group.numero)) {
        addTower(day.data, conflictDecision.numero);
        if (group.count - conflict.photoCount > 0) addTower(day.data, decision.numero || group.numero);
      } else {
        addTower(day.data, decision.numero || group.numero);
      }
    }
  }

  // 2. Periodo: so expande.
  const photoDates = [...additions.keys()].sort();
  const range = analysis?.dateRange || null;
  const currentStart = String(source.dataInicio || '').trim();
  const currentEnd = String(source.dataFim || '').trim() || currentStart;
  const candidates = [currentStart, currentEnd, range?.start, range?.end, ...photoDates].filter(Boolean).sort();
  const start = candidates[0] || '';
  const end = candidates[candidates.length - 1] || '';
  const periodChanged = start !== currentStart || end !== currentEnd ? { from: { dataInicio: currentStart, dataFim: currentEnd }, to: { dataInicio: start, dataFim: end } } : null;

  // 3. Lista de dias: uteis do periodo ∪ existentes ∪ dias com fotos (fins de semana entram), menos gaps descartados.
  const existingDays = Array.isArray(source.detalhesDias) ? source.detalhesDias : [];
  const existingDates = existingDays.map((day) => String(day?.data || '').trim()).filter(Boolean);
  const dateSet = new Set([...(start && end ? gerarPeriodoDias(start, end) : []), ...existingDates, ...photoDates]);
  let gapDaysKept = 0;
  for (const gap of analysis?.gapDays || []) {
    const decision = gapDecisions[gap.data] || { keep: true, reason: '' };
    const existing = existingDays.find((day) => String(day?.data || '').trim() === gap.data);
    const hasExistingTowers = (existing?.torresDetalhadas || []).length > 0;
    if (!decision.keep && !hasExistingTowers) dateSet.delete(gap.data);
    else gapDaysKept += 1;
  }
  const dates = [...dateSet].sort();

  // 4. Mescla por dia.
  let daysCreated = 0;
  let daysTouched = 0;
  let towersAdded = 0;
  let towersKept = 0;
  const detalhesDias = preservarDetalhesDias(existingDays, dates).map((day) => {
    const date = String(day?.data || '').trim();
    const isNew = !existingDates.includes(date);
    if (isNew) daysCreated += 1;
    const next = { ...day };
    const toAdd = additions.get(date);
    if (toAdd && toAdd.size) {
      daysTouched += 1;
      const existingTowers = Array.isArray(day?.torresDetalhadas) ? [...day.torresDetalhadas] : [];
      const have = new Set(existingTowers.map((tower) => normalizeTowerKey(tower?.numero)));
      for (const numero of toAdd) {
        if (have.has(numero)) {
          towersKept += 1;
          continue;
        }
        existingTowers.push({ numero, obs: '', temErosao: false });
        have.add(numero);
        towersAdded += 1;
      }
      next.torresDetalhadas = existingTowers;
    }
    const gapDecision = gapDecisions[date];
    if (gapDecision?.reason === 'chuva' && !String(next.clima || '').trim()) next.clima = 'Chuva';
    return ensureDayShape(next);
  });

  return {
    form: { ...source, dataInicio: start, dataFim: end, detalhesDias },
    summary: {
      daysCreated,
      daysTouched,
      towersAdded,
      towersKept,
      gapDaysKept,
      skippedUnresolved,
      skippedUndated: (analysis?.undated || []).length,
      pendingConflicts: Object.values(divergenceDecisions).filter((d) => d.status !== 'confirmed').length,
      periodChanged,
    },
  };
}

import { parseTowerInput } from '../../../utils/parseTowerInput';

function toDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeTower(value) {
  return String(value ?? '').trim();
}

function sortTowers(values) {
  return [...values].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
}

function formatInspectionDate(inspection, fallbackDayDate) {
  const raw = fallbackDayDate || inspection?.dataInicio || inspection?.data || '';
  if (!raw) return '';
  const d = toDate(raw);
  if (!d) return String(raw);
  return d.toISOString().slice(0, 10);
}

function hashStringSeed(input) {
  const text = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function createPrng(seedNumber) {
  let t = seedNumber >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, seed) {
  const list = [...values];
  const rand = createPrng(hashStringSeed(seed));
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function samplingRate(total) {
  if (total <= 100) return 0.30;
  if (total <= 200) return 0.20;
  if (total <= 400) return 0.18;
  return 0.15;
}

function parseTowerNumber(value) {
  const text = normalizeTower(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHotelRating(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 5) return null;
  return parsed;
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function toFiniteOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  const valid = values.map((item) => toFiniteOrNull(item)).filter((item) => item !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
}

function collectDayTowers(day) {
  const towers = new Set();
  (Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : []).forEach((item) => {
    const tower = normalizeTower(item?.numero);
    if (tower) towers.add(tower);
  });

  if (Array.isArray(day?.torres)) {
    day.torres.forEach((item) => {
      const tower = normalizeTower(item);
      if (tower) towers.add(tower);
    });
  } else {
    const parsedTorres = parseTowerInput(String(day?.torres || ''));
    parsedTorres.forEach((item) => towers.add(String(item)));
  }

  const parsedInput = parseTowerInput(String(day?.torresInput || ''));
  parsedInput.forEach((item) => towers.add(String(item)));
  return towers;
}

function dayContainsTower(day, towerRef) {
  return collectDayTowers(day).has(normalizeTower(towerRef));
}

function compareHotelCandidates(a, b) {
  if (!!a.hasTorreBase !== !!b.hasTorreBase) return a.hasTorreBase ? -1 : 1;

  const aDistance = toFiniteOrNull(a.distanciaTorreAlvo);
  const bDistance = toFiniteOrNull(b.distanciaTorreAlvo);
  if (aDistance !== null && bDistance !== null && aDistance !== bDistance) return aDistance - bDistance;
  if (aDistance !== null && bDistance === null) return -1;
  if (aDistance === null && bDistance !== null) return 1;

  const aAvg = toFiniteOrNull(a.notaMedia) ?? -1;
  const bAvg = toFiniteOrNull(b.notaMedia) ?? -1;
  if (aAvg !== bAvg) return bAvg - aAvg;

  const byDate = String(b.ultimaData || '').localeCompare(String(a.ultimaData || ''));
  if (byDate !== 0) return byDate;

  const aLabel = `${a.hotelNome || ''}|${a.hotelMunicipio || ''}`;
  const bLabel = `${b.hotelNome || ''}|${b.hotelMunicipio || ''}`;
  return aLabel.localeCompare(bLabel);
}

function normalizeHotelCandidateGroup(group, targetTower) {
  const targetNum = parseTowerNumber(targetTower);
  const torreBase = normalizeTower(group.torreBase);
  const baseNum = parseTowerNumber(torreBase);
  const distanciaTorreAlvo = targetNum !== null && baseNum !== null ? Math.abs(baseNum - targetNum) : null;

  const hotelLogisticaNota = average(group.logisticaNotas);
  const hotelReservaNota = average(group.reservaNotas);
  const hotelEstadiaNota = average(group.estadiaNotas);
  const notaMedia = average([hotelLogisticaNota, hotelReservaNota, hotelEstadiaNota]);

  return {
    hotelNome: group.hotelNome,
    hotelMunicipio: group.hotelMunicipio,
    hotelTorreBase: torreBase,
    hasTorreBase: !!torreBase,
    hotelLogisticaNota: hotelLogisticaNota === null ? '' : roundOneDecimal(hotelLogisticaNota),
    hotelReservaNota: hotelReservaNota === null ? '' : roundOneDecimal(hotelReservaNota),
    hotelEstadiaNota: hotelEstadiaNota === null ? '' : roundOneDecimal(hotelEstadiaNota),
    notaMedia: notaMedia === null ? null : roundOneDecimal(notaMedia),
    distanciaTorreAlvo,
    ultimaData: group.ultimaData || '',
  };
}

function collectHotelCandidatesForTower(inspections, projectId, towerRef, targetTower) {
  const tower = normalizeTower(towerRef);
  if (!tower || !projectId) return [];

  const grouped = new Map();
  (inspections || []).forEach((inspection) => {
    if (String(inspection?.projetoId || '').trim() !== projectId) return;

    (inspection?.detalhesDias || []).forEach((day) => {
      if (!dayContainsTower(day, tower)) return;

      const hotelNome = String(day?.hotelNome || '').trim();
      if (!hotelNome) return;

      const hotelMunicipio = String(day?.hotelMunicipio || '').trim();
      const hotelTorreBase = normalizeTower(day?.hotelTorreBase);
      const key = `${hotelNome.toLowerCase()}|${hotelMunicipio.toLowerCase()}|${hotelTorreBase.toLowerCase()}`;
      const date = formatInspectionDate(inspection, day?.data);
      const logistica = parseHotelRating(day?.hotelLogisticaNota);
      const reserva = parseHotelRating(day?.hotelReservaNota);
      const estadia = parseHotelRating(day?.hotelEstadiaNota);

      const current = grouped.get(key) || {
        hotelNome,
        hotelMunicipio,
        torreBase: hotelTorreBase,
        logisticaNotas: [],
        reservaNotas: [],
        estadiaNotas: [],
        ultimaData: '',
      };
      if (logistica !== null) current.logisticaNotas.push(logistica);
      if (reserva !== null) current.reservaNotas.push(reserva);
      if (estadia !== null) current.estadiaNotas.push(estadia);
      if (date && String(date).localeCompare(String(current.ultimaData || '')) > 0) current.ultimaData = date;
      grouped.set(key, current);
    });
  });

  return [...grouped.values()].map((group) => normalizeHotelCandidateGroup(group, targetTower));
}

export function getTargetTowerFromSelection(selectedTowers = []) {
  const list = Array.isArray(selectedTowers) ? selectedTowers : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const tower = normalizeTower(list[i]);
    if (tower) return tower;
  }
  return '';
}

export function recommendHotelForTower({
  inspections,
  projectId,
  tower,
  targetTower,
}) {
  const candidates = collectHotelCandidatesForTower(inspections, projectId, tower, targetTower)
    .sort(compareHotelCandidates);

  const selected = candidates[0];
  if (!selected) {
    return {
      hotelSugeridoNome: '',
      hotelSugeridoMunicipio: '',
      hotelSugeridoLogisticaNota: '',
      hotelSugeridoReservaNota: '',
      hotelSugeridoEstadiaNota: '',
      hotelSugeridoTorreBase: '',
      hotelSugeridoDistanciaTorreAlvo: '',
      hotelSugeridoNotaMedia: '',
      hotelSugeridoUltimaData: '',
    };
  }

  return {
    hotelSugeridoNome: selected.hotelNome,
    hotelSugeridoMunicipio: selected.hotelMunicipio,
    hotelSugeridoLogisticaNota: selected.hotelLogisticaNota,
    hotelSugeridoReservaNota: selected.hotelReservaNota,
    hotelSugeridoEstadiaNota: selected.hotelEstadiaNota,
    hotelSugeridoTorreBase: selected.hotelTorreBase,
    hotelSugeridoDistanciaTorreAlvo: selected.distanciaTorreAlvo ?? '',
    hotelSugeridoNotaMedia: selected.notaMedia ?? '',
    hotelSugeridoUltimaData: selected.ultimaData || '',
  };
}

export function enrichPlanningItemsWithHotelRecommendation(items = [], { inspections, projectId, targetTower } = {}) {
  return (items || []).map((item) => ({
    ...item,
    ...recommendHotelForTower({
      inspections,
      projectId,
      tower: item?.torre,
      targetTower,
    }),
  }));
}

function compareRecommendedItems(a, b) {
  const aHasName = !!String(a?.hotelSugeridoNome || '').trim();
  const bHasName = !!String(b?.hotelSugeridoNome || '').trim();
  if (aHasName !== bHasName) return aHasName ? -1 : 1;

  const aHasBase = !!String(a?.hotelSugeridoTorreBase || '').trim();
  const bHasBase = !!String(b?.hotelSugeridoTorreBase || '').trim();
  if (aHasBase !== bHasBase) return aHasBase ? -1 : 1;

  const aDistance = toFiniteOrNull(a?.hotelSugeridoDistanciaTorreAlvo);
  const bDistance = toFiniteOrNull(b?.hotelSugeridoDistanciaTorreAlvo);
  if (aDistance !== null && bDistance !== null && aDistance !== bDistance) return aDistance - bDistance;
  if (aDistance !== null && bDistance === null) return -1;
  if (aDistance === null && bDistance !== null) return 1;

  const aAvg = toFiniteOrNull(a?.hotelSugeridoNotaMedia) ?? -1;
  const bAvg = toFiniteOrNull(b?.hotelSugeridoNotaMedia) ?? -1;
  if (aAvg !== bAvg) return bAvg - aAvg;

  return String(b?.hotelSugeridoUltimaData || '').localeCompare(String(a?.hotelSugeridoUltimaData || ''));
}

export function pickPriorityHotelFromItems(items = [], targetTower = '') {
  const normalizedTarget = normalizeTower(targetTower);
  const list = Array.isArray(items) ? items : [];

  if (normalizedTarget) {
    const exactTarget = list.find(
      (item) => normalizeTower(item?.torre) === normalizedTarget && String(item?.hotelSugeridoNome || '').trim(),
    );
    if (exactTarget) return exactTarget;
  }

  const withHotels = list.filter((item) => String(item?.hotelSugeridoNome || '').trim());
  if (withHotels.length === 0) return null;
  return [...withHotels].sort(compareRecommendedItems)[0] || null;
}

export function collectVisitedTowers(inspection) {
  const set = new Set();
  (inspection?.detalhesDias || []).forEach((day) => {
    (day?.torresDetalhadas || []).forEach((tower) => {
      const normalized = normalizeTower(tower?.numero);
      if (normalized) set.add(normalized);
    });
  });
  return set;
}

function collectTowerComments(inspections, towerRef, limit = 5) {
  const tower = normalizeTower(towerRef);
  if (!tower) return [];
  const comments = [];

  (inspections || []).forEach((inspection) => {
    (inspection?.detalhesDias || []).forEach((day) => {
      (day?.torresDetalhadas || []).forEach((item) => {
        if (normalizeTower(item?.numero) !== tower) return;
        const obs = String(item?.obs || '').trim();
        if (!obs) return;
        comments.push({
          inspectionId: inspection?.id || '',
          data: formatInspectionDate(inspection, day?.data),
          obs,
        });
      });
    });
  });

  return comments
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    .slice(0, limit);
}

function collectProjectTowers(project, inspections, erosions) {
  const set = new Set();
  const total = Number(project?.torres || 0);

  if (Number.isInteger(total) && total > 0 && total <= 5000) {
    for (let i = 1; i <= total; i += 1) set.add(String(i));
  }

  (inspections || []).forEach((inspection) => {
    collectVisitedTowers(inspection).forEach((tower) => set.add(tower));
  });

  (erosions || []).forEach((erosion) => {
    const tower = normalizeTower(erosion?.torreRef);
    if (tower) set.add(tower);
  });

  return set;
}

function getTowerMapsLink(tower, project, erosions = []) {
  const normalized = normalizeTower(tower);
  if (!normalized) return '';

  const coords = Array.isArray(project?.torresCoordenadas) ? project.torresCoordenadas : [];
  const projectTower = coords.find((item) => normalizeTower(item?.numero) === normalized);
  const lat = Number(projectTower?.latitude);
  const lng = Number(projectTower?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  const erosionRows = (erosions || [])
    .filter((item) => normalizeTower(item?.torreRef) === normalized)
    .sort((a, b) => String(b?.ultimaAtualizacao || '').localeCompare(String(a?.ultimaAtualizacao || '')));
  const fallback = erosionRows[0];
  const flat = Number(fallback?.latitude);
  const flng = Number(fallback?.longitude);
  if (Number.isFinite(flat) && Number.isFinite(flng)) {
    return `https://www.google.com/maps/search/?api=1&query=${flat},${flng}`;
  }

  return '';
}

function selectFromGroups(groups, count, seed) {
  const selected = [];
  for (let g = 0; g < groups.length; g += 1) {
    if (selected.length >= count) break;
    const group = groups[g];
    if (!group || group.length === 0) continue;
    const shuffledGroup = shuffled(group, `${seed}|g${g}`);
    for (let i = 0; i < shuffledGroup.length; i += 1) {
      if (selected.length >= count) break;
      selected.push(shuffledGroup[i]);
    }
  }
  return selected;
}

function sortTowerItems(items) {
  const towersSorted = sortTowers((items || []).map((item) => normalizeTower(item?.torre)).filter(Boolean));
  const indexByTower = new Map(towersSorted.map((tower, idx) => [tower, idx]));
  return [...(items || [])].sort(
    (a, b) => (indexByTower.get(normalizeTower(a?.torre)) ?? Number.MAX_SAFE_INTEGER)
      - (indexByTower.get(normalizeTower(b?.torre)) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function computeVisitPlanning({ project, inspections, erosions, year = new Date().getFullYear() }) {
  const projectId = String(project?.id || '').trim();
  if (!projectId) {
    return {
      obrigatorias: [],
      amostragemSelecionada: [],
      naoPriorizar: [],
      metaAmostragem: 0,
      totalTorres: 0,
      seed: '',
    };
  }

  const projectInspections = (inspections || [])
    .filter((item) => String(item?.projetoId || '').trim() === projectId)
    .sort((a, b) => {
      const da = toDate(a?.dataInicio || a?.data);
      const db = toDate(b?.dataInicio || b?.data);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });

  const projectErosions = (erosions || []).filter((item) => String(item?.projetoId || '').trim() === projectId);
  const mandatorySet = new Set(projectErosions.map((item) => normalizeTower(item?.torreRef)).filter(Boolean));

  const allTowers = sortTowers(collectProjectTowers(project, projectInspections, projectErosions));
  const totalTorres = allTowers.length;
  const metaAmostragem = Math.ceil(totalTorres * samplingRate(totalTorres));
  const extraWhenOverflow = Math.ceil(totalTorres * 0.05);
  const lastTwo = projectInspections.slice(0, 2);

  const seed = `${projectId}|${year}|${totalTorres}|${projectInspections.length}|${projectErosions.length}`;

  const buildItem = (tower, motivo, categoria) => ({
    torre: tower,
    motivo,
    categoria,
    comentariosAnteriores: collectTowerComments(projectInspections, tower),
    mapsLink: getTowerMapsLink(tower, project, projectErosions),
  });

  const obrigatorias = sortTowers([...mandatorySet]).map((tower) => buildItem(tower, 'Possui histórico de erosão cadastrado.', 'obrigatoria'));

  const candidatesNotVisited = [];
  const candidatesInsufficient = [];
  const candidatesNaoPriorizar = [];

  allTowers.forEach((tower) => {
    if (mandatorySet.has(tower)) return;

    if (lastTwo.length < 2) {
      candidatesInsufficient.push(buildItem(tower, 'Histórico insuficiente (menos de 2 vistorias recentes).', 'nao_priorizar'));
      return;
    }

    const visitedCount = lastTwo.reduce(
      (acc, inspection) => acc + (collectVisitedTowers(inspection).has(tower) ? 1 : 0),
      0,
    );

    if (visitedCount === 0) {
      candidatesNotVisited.push(buildItem(tower, 'Não foi visitada nas 2 últimas vistorias.', 'amostragem'));
      return;
    }

    candidatesNaoPriorizar.push(buildItem(
      tower,
      visitedCount === 1
        ? 'Visitada em 1 das 2 últimas vistorias (sem erosão recente).'
        : 'Visitada nas 2 últimas vistorias (sem erosão recente).',
      'nao_priorizar',
    ));
  });

  const fillTarget = obrigatorias.length > metaAmostragem
    ? obrigatorias.length + extraWhenOverflow
    : metaAmostragem;
  const neededNonMandatory = Math.max(0, fillTarget - obrigatorias.length);

  const sampled = selectFromGroups(
    [candidatesNotVisited, candidatesInsufficient, candidatesNaoPriorizar],
    neededNonMandatory,
    seed,
  ).map((item) => ({ ...item, categoria: 'amostragem' }));
  const sampledSorted = sortTowerItems(sampled);

  const sampledSet = new Set(sampledSorted.map((item) => item.torre));
  const naoPriorizar = [...candidatesInsufficient, ...candidatesNaoPriorizar]
    .filter((item) => !sampledSet.has(item.torre));

  return {
    obrigatorias,
    amostragemSelecionada: sampledSorted,
    naoPriorizar,
    metaAmostragem,
    totalTorres,
    seed,
  };
}

export function serializeTowersForInput(towers) {
  return sortTowers((towers || []).map((item) => normalizeTower(item?.torre || item)).filter(Boolean)).join(', ');
}

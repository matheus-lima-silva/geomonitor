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

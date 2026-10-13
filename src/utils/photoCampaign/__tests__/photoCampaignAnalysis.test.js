import { describe, it, expect } from 'vitest';

import {
  TOWER_MATCH,
  analyzePhotoCampaign,
  buildDefaultDecisions,
  buildDefaultSubjectCaption,
  buildFileKey,
  buildPhotoAssignments,
  buildSubjectOverrides,
  toIsoWithLocalOffset,
  buildTowerIndex,
  findNearestTowers,
  mergeAnalysisIntoForm,
  parseDescriptionLabel,
  resolvePhotoTower,
  buildResolutionContext,
} from '../photoCampaignAnalysis';

// Linha sintetica: torre N em lat -20 + N * 0.003 (~333 m entre torres), lon -44.
const DEG_PER_M_LAT = 1 / 111320;
function towerLat(n) { return -20 + n * 0.003; }
const PROJECT = {
  id: 'BMDOPR',
  nome: 'Bom Despacho - Ouro Preto',
  torres: '20',
  torresCoordenadas: Array.from({ length: 20 }, (_, i) => ({ numero: String(i + 1), latitude: towerLat(i + 1), longitude: -44 })),
};

// Foto a `offsetM` metros (ao norte) da torre `n`, etiquetada `label`, no dia/hora dados.
function photo({ n, offsetM = 10, label = `BMDOPR\n${n}`, date = '2026-09-22', time = '10:00', name, relativePath = '', gps = true, description }) {
  const key = name || `${n}-${time}`;
  return {
    key,
    name: key,
    relativePath,
    gpsLat: gps ? towerLat(n) + offsetM * DEG_PER_M_LAT : null,
    gpsLon: gps ? -44 : null,
    capturedAt: date ? `${date}T${time}:00` : null,
    capturedDate: date,
    capturedTime: date ? time : null,
    description: description === undefined ? label : description,
  };
}

const ctx = () => buildResolutionContext(PROJECT);

describe('parseDescriptionLabel', () => {
  it('le a etiqueta canonica do Timestamp Camera', () => {
    expect(parseDescriptionLabel('BMDOPR\n126', ['BMDOPR', 'Bom Despacho - Ouro Preto'])).toEqual({ sigla: 'BMDOPR', tower: '126', siglaMismatch: false, subject: null });
    expect(parseDescriptionLabel('BMDOPR \n319', 'BMDOPR').tower).toBe('319');
    expect(parseDescriptionLabel('BMDOPR\n16\n    ', 'BMDOPR').tower).toBe('16');
    expect(parseDescriptionLabel('bmdopr\n0007', 'BMDOPR').tower).toBe('7');
  });

  it('aceita texto livre com TORRE n quando cita o empreendimento', () => {
    const parsed = parseDescriptionLabel('PLACA AREDES \nBOM DESPACHO - OURO PRETO. TORRE 333', ['BMDOPR', 'Bom Despacho - Ouro Preto']);
    expect(parsed.tower).toBe('333');
    expect(parsed.siglaMismatch).toBe(false);
  });

  it('marca siglaMismatch quando a etiqueta e de outro empreendimento', () => {
    expect(parseDescriptionLabel('IABTPR2\n605', 'BMDOPR')).toEqual({ sigla: 'IABTPR2', tower: '605', siglaMismatch: true, subject: null });
    expect(parseDescriptionLabel('Erosao perto da torre 12', 'BMDOPR').siglaMismatch).toBe(true);
  });

  it('le a 3a linha ACESSO/CONTEXTO como assunto da foto', () => {
    expect(parseDescriptionLabel('BMDOPR\n195\nACESSO', 'BMDOPR')).toMatchObject({ tower: '195', subject: 'acesso' });
    expect(parseDescriptionLabel('BMDOPR\n195\n contexto ', 'BMDOPR')).toMatchObject({ tower: '195', subject: 'contexto' });
    expect(parseDescriptionLabel('BMDOPR\n195', 'BMDOPR').subject).toBeNull();
    expect(parseDescriptionLabel('BMDOPR\n195\nOUTRA', 'BMDOPR')).toBeNull();
    expect(parseDescriptionLabel('BOM DESPACHO - OURO PRETO. TORRE 333 ACESSO', ['BMDOPR', 'Bom Despacho - Ouro Preto']).subject).toBe('acesso');
  });

  it('devolve null sem torre reconhecivel', () => {
    expect(parseDescriptionLabel('', 'BMDOPR')).toBeNull();
    expect(parseDescriptionLabel('Reservatorio funil erosao', 'BMDOPR')).toBeNull();
    expect(parseDescriptionLabel(null, 'BMDOPR')).toBeNull();
  });
});

describe('buildTowerIndex / findNearestTowers', () => {
  it('indexa torres com coordenada valida e ignora duplicadas ou sem coordenada', () => {
    const index = buildTowerIndex({ torresCoordenadas: [
      { numero: '001', latitude: '-20.1', longitude: '-44.1' },
      { numero: '1', latitude: -20.1, longitude: -44.1 },
      { numero: '2', latitude: 0, longitude: 0 },
      { numero: '3' },
    ] });
    expect(index).toEqual([{ numero: '1', lat: -20.1, lon: -44.1 }]);
  });

  it('ordena pela distancia', () => {
    const nearest = findNearestTowers(buildTowerIndex(PROJECT), towerLat(5) + 20 * DEG_PER_M_LAT, -44, 2);
    expect(nearest.map((t) => t.numero)).toEqual(['5', '6']);
    expect(nearest[0].distanceM).toBeCloseTo(20, 0);
  });
});

describe('resolvePhotoTower', () => {
  it('etiqueta confirmada pelo GPS ate 150 m', () => {
    expect(resolvePhotoTower(photo({ n: 5, offsetM: 149 }), ctx())).toMatchObject({ tower: '5', source: 'label', confidence: 'high' });
    expect(resolvePhotoTower(photo({ n: 5, offsetM: 150 }), ctx()).confidence).toBe('high');
    expect(resolvePhotoTower(photo({ n: 5, offsetM: 151 }), ctx()).confidence).toBe('medium');
  });

  it('legenda errada: outra torre a < 50 m e a etiquetada a > 250 m (caso 217 -> 218)', () => {
    // Foto a 10 m da torre 6, etiquetada 5 (333 m de distancia).
    const resolved = resolvePhotoTower(photo({ n: 6, offsetM: 10, label: 'BMDOPR\n5' }), ctx());
    expect(resolved.tower).toBe('5');
    expect(resolved.confidence).toBe('low');
    expect(resolved.conflict).toMatchObject({ labeled: '5', suggested: '6' });
    expect(resolved.conflict.suggestedDistanceM).toBeCloseTo(10, 0);
  });

  it('foto de longe sem torre vizinha perto nao vira conflito (caso 161)', () => {
    // 84 m da torre 6 e ~249 m da torre 5 (etiquetada): vizinha nao esta a < 50 m.
    const resolved = resolvePhotoTower(photo({ n: 6, offsetM: -84, label: 'BMDOPR\n5' }), ctx());
    expect(resolved.tower).toBe('5');
    expect(resolved.conflict).toBeNull();
    expect(resolved.confidence).toBe('medium');
  });

  it('etiqueta longe (> 250 m) sem vizinha perto recebe far_from_label', () => {
    const resolved = resolvePhotoTower(photo({ n: 5, offsetM: 160, label: 'BMDOPR\n5' }), ctx());
    expect(resolved.issues).not.toContain('far_from_label');
    const far = resolvePhotoTower(photo({ n: 5, offsetM: -166, label: 'BMDOPR\n5' }), ctx()); // 166 m da 5, 167 m da 4
    expect(far.confidence).toBe('medium');
  });

  it('pasta vale quando nao ha etiqueta; etiqueta de outro projeto e ignorada', () => {
    const byFolder = resolvePhotoTower(photo({ n: 7, label: null, relativePath: 'BMDOPR/7/foto.jpg' }), ctx());
    expect(byFolder).toMatchObject({ tower: '7', source: 'folder', confidence: 'high' });

    const other = resolvePhotoTower(photo({ n: 7, label: 'IABTPR2\n7', relativePath: 'BMDOPR/T-7/foto.jpg' }), ctx());
    expect(other.source).toBe('folder');
    expect(other.issues).toContain('sigla_mismatch');
  });

  it('sem etiqueta nem pasta, GPS resolve ate 150 m (medium) e sugere ate 400 m (low)', () => {
    expect(resolvePhotoTower(photo({ n: 8, offsetM: 100, label: null }), ctx())).toMatchObject({ tower: '8', source: 'gps', confidence: 'medium' });
    expect(resolvePhotoTower(photo({ n: 8, offsetM: 160, label: null }), ctx())).toMatchObject({ tower: '8', source: 'gps', confidence: 'low' });
    // 1.000 m ao norte da ultima torre: longe de todas.
    const far = resolvePhotoTower(photo({ n: 20, offsetM: 1000, label: null }), ctx());
    expect(far.tower).toBeNull();
    expect(far.issues).toContain('far_from_any_tower');
  });

  it('sem GPS a etiqueta vale com confianca medium; sem nada fica nao resolvida', () => {
    expect(resolvePhotoTower(photo({ n: 3, gps: false }), ctx())).toMatchObject({ tower: '3', source: 'label', confidence: 'medium' });
    const nothing = resolvePhotoTower(photo({ n: 3, gps: false, label: null }), ctx());
    expect(nothing.tower).toBeNull();
    expect(nothing.issues).toEqual(expect.arrayContaining(['no_gps']));
  });

  it('foto de acesso longe da torre nao vira conflito nem far_from_label, mas mantem a torre', () => {
    // Mesma geometria do caso 217 -> 218, agora etiquetada como acesso.
    const access = resolvePhotoTower(photo({ n: 6, offsetM: 10, label: 'BMDOPR\n5\nACESSO' }), ctx());
    expect(access).toMatchObject({ tower: '5', source: 'label', subject: 'acesso', conflict: null, confidence: 'medium' });
    expect(access.issues).not.toContain('far_from_label');
    // Override do usuario via ctx.subjects vence a etiqueta.
    const overridden = resolvePhotoTower(photo({ n: 6, offsetM: 10, label: 'BMDOPR\n5', name: 'x' }), { ...ctx(), subjects: { x: 'contexto' } });
    expect(overridden).toMatchObject({ subject: 'contexto', conflict: null });
    // Sem assunto a regra continua valendo.
    expect(resolvePhotoTower(photo({ n: 6, offsetM: 10, label: 'BMDOPR\n5' }), ctx()).conflict).not.toBeNull();
  });

  it('empreendimento sem coordenadas: etiqueta vale, torre desconhecida e sinalizada', () => {
    const noCoords = buildResolutionContext({ id: 'XX', nome: 'Linha XX', torres: '5' });
    expect(resolvePhotoTower(photo({ n: 2, label: 'XX\n2' }), noCoords)).toMatchObject({ tower: '2', confidence: 'medium' });
    expect(resolvePhotoTower(photo({ n: 2, label: 'XX\n99' }), noCoords).issues).toContain('unknown_tower');
  });
});

describe('analyzePhotoCampaign', () => {
  const campaign = [
    // 21/09: torres 1 e 2 (ordem de visita 2 antes de 1)
    photo({ n: 2, date: '2026-09-21', time: '14:31', name: 'a' }),
    photo({ n: 2, date: '2026-09-21', time: '14:33', name: 'b' }),
    photo({ n: 1, date: '2026-09-21', time: '14:50', name: 'c' }),
    // 22/09: torre 5 etiquetada, 3 fotos reais da 6 etiquetadas 5 (conflito), segunda sessao
    photo({ n: 5, date: '2026-09-22', time: '09:00', name: 'd' }),
    photo({ n: 5, date: '2026-09-22', time: '09:02', name: 'e' }),
    photo({ n: 6, offsetM: 8, label: 'BMDOPR\n5', date: '2026-09-22', time: '10:30', name: 'f' }),
    photo({ n: 6, offsetM: 9, label: 'BMDOPR\n5', date: '2026-09-22', time: '10:31', name: 'g' }),
    photo({ n: 6, offsetM: 12, label: 'BMDOPR\n5', date: '2026-09-22', time: '10:32', name: 'h' }),
    // 22/09: foto so com GPS perto da torre 7
    photo({ n: 7, offsetM: 30, label: null, date: '2026-09-22', time: '11:00', name: 'i' }),
    // 24/09 (quinta): torre 9. 23/09 fica sem fotos (gap util).
    photo({ n: 9, date: '2026-09-24', time: '08:00', name: 'j' }),
    // sem data
    photo({ n: 9, date: null, time: null, name: 'k' }),
  ];

  it('agrupa por dia e por torre em ordem de visita, com gap days e undated', () => {
    const analysis = analyzePhotoCampaign(campaign, PROJECT);
    expect(analysis.days.map((d) => d.data)).toEqual(['2026-09-21', '2026-09-22', '2026-09-24']);
    expect(analysis.days[0].towers.map((t) => t.numero)).toEqual(['2', '1']);
    expect(analysis.days[0].towers[0]).toMatchObject({ count: 2, firstAt: '14:31', lastAt: '14:33', source: 'label', confidence: 'high', defaultIncluded: true });
    expect(analysis.dateRange).toEqual({ start: '2026-09-21', end: '2026-09-24' });
    expect(analysis.gapDays.map((g) => g.data)).toEqual(['2026-09-23']);
    expect(analysis.undated.map((p) => p.key)).toEqual(['k']);
    expect(analysis.stats).toMatchObject({ total: 11, undated: 1, towers: 5, byGps: 1 });
  });

  it('torre GPS-only vem desmarcada por padrao e o conflito gera divergencia acionavel', () => {
    const analysis = analyzePhotoCampaign(campaign, PROJECT);
    const day22 = analysis.days[1];
    const gpsGroup = day22.towers.find((t) => t.numero === '7');
    expect(gpsGroup.source).toBe('gps');
    expect(gpsGroup.defaultIncluded).toBe(false);

    const group5 = day22.towers.find((t) => t.numero === '5');
    expect(group5.confidence).toBe('low');
    expect(group5.conflict).toMatchObject({ labeled: '5', suggested: '6', count: 3 });
    expect(group5.sessions).toHaveLength(2);

    const conflict = analysis.divergences.find((d) => d.kind === 'label_conflict');
    expect(conflict).toMatchObject({ severity: 'action', date: '2026-09-22', numero: '5', suggested: '6', photoCount: 3 });
    expect(conflict.text).toMatch(/3 fotos etiquetadas 5 às 10:30 estão a \d+ m da torre 6/);
    expect(analysis.divergences.some((d) => d.kind === 'double_session' && d.numero === '5')).toBe(true);
    expect(analysis.divergences.some((d) => d.kind === 'spread' && d.numero === '5')).toBe(true);
  });

  it('fotos de acesso saem das regras de divergencia (conflito, sessao dupla, dispersao, longe) e sao contadas', () => {
    const withAccess = campaign.map((p) => (['f', 'g', 'h'].includes(p.name) ? { ...p, description: 'BMDOPR\n5\nACESSO' } : p));
    const analysis = analyzePhotoCampaign(withAccess, PROJECT);
    const day = analysis.days.find((d) => d.data === '2026-09-22');
    const group5 = day.towers.find((g) => g.numero === '5');
    expect(group5.count).toBe(5);
    expect(group5.accessCount).toBe(3);
    expect(group5.towerPhotos.map((p) => p.name)).toEqual(['d', 'e']);
    expect(group5.conflict).toBeNull();
    expect(analysis.divergences.filter((d) => d.numero === '5')).toEqual([]);
    expect(analysis.stats.accessPhotos).toBe(3);

    // Mesmo efeito via decisoes da revisao (re-rodar a analise com subjects).
    const base = analyzePhotoCampaign(campaign, PROJECT);
    expect(base.divergences.some((d) => d.kind === 'label_conflict')).toBe(true);
    const decisions = buildDefaultDecisions(base);
    expect(decisions.photos).toEqual({});
    decisions.photos.f = { subject: 'acesso' };
    decisions.photos.g = { subject: 'acesso' };
    decisions.photos.h = { subject: 'acesso' };
    const rerun = analyzePhotoCampaign(campaign, PROJECT, { subjects: buildSubjectOverrides(decisions) });
    expect(rerun.divergences.filter((d) => d.numero === '5')).toEqual([]);
  });

  it('marca feriado nos dias e nos gaps pelo indice informado', () => {
    const holidaysIndex = new Map([['2026-09-23', { nome: 'Feriado teste', tipo: 'nacional' }]]);
    const analysis = analyzePhotoCampaign(campaign, PROJECT, { holidaysIndex });
    expect(analysis.gapDays[0]).toMatchObject({ isHoliday: true, holidayName: 'Feriado teste' });
    expect(analysis.days[0].isHoliday).toBe(false);
  });

  it('lista torres repetidas em mais de um dia', () => {
    const analysis = analyzePhotoCampaign([
      photo({ n: 4, date: '2026-09-21', time: '09:00', name: 'x' }),
      photo({ n: 4, date: '2026-09-22', time: '09:00', name: 'y' }),
    ], PROJECT);
    expect(analysis.stats.towersRepeatedAcrossDays).toEqual(['4']);
  });

  it('respeita limiares customizados', () => {
    const analysis = analyzePhotoCampaign([photo({ n: 5, offsetM: 120, name: 'z' })], PROJECT, { thresholds: { confirmM: 100 } });
    expect(analysis.days[0].towers[0].confidence).toBe('medium');
    expect(TOWER_MATCH.confirmM).toBe(150);
  });
});

describe('buildDefaultDecisions + mergeAnalysisIntoForm', () => {
  const analysisOf = (photos, opts) => analyzePhotoCampaign(photos, PROJECT, opts);
  const emptyForm = { id: '', projetoId: 'BMDOPR', dataInicio: '', dataFim: '', detalhesDias: [] };

  it('form vazio: datas vem das fotos, dias uteis do periodo sao criados e torres entram', () => {
    const analysis = analysisOf([
      photo({ n: 2, date: '2026-09-21', time: '14:31', name: 'a' }),
      photo({ n: 9, date: '2026-09-24', time: '08:00', name: 'b' }),
    ]);
    const decisions = buildDefaultDecisions(analysis);
    const { form, summary } = mergeAnalysisIntoForm(emptyForm, analysis, decisions);
    expect(form.dataInicio).toBe('2026-09-21');
    expect(form.dataFim).toBe('2026-09-24');
    expect(form.detalhesDias.map((d) => d.data)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
    expect(form.detalhesDias[0].torres).toEqual(['2']);
    expect(form.detalhesDias[0].torresDetalhadas).toEqual([{ numero: '2', obs: '', temErosao: false }]);
    expect(form.detalhesDias[3].torresInput).toBe('9');
    expect(summary).toMatchObject({ daysCreated: 4, towersAdded: 2, towersKept: 0, gapDaysKept: 2, periodChanged: { to: { dataInicio: '2026-09-21', dataFim: '2026-09-24' } } });
  });

  it('GPS-only fica fora ate ser marcada; marcar inclui', () => {
    const analysis = analysisOf([photo({ n: 7, offsetM: 30, label: null, name: 'g' })]);
    const decisions = buildDefaultDecisions(analysis);
    expect(mergeAnalysisIntoForm(emptyForm, analysis, decisions).form.detalhesDias[0].torres).toEqual([]);
    decisions.towers['2026-09-22|7'].include = true;
    expect(mergeAnalysisIntoForm(emptyForm, analysis, decisions).form.detalhesDias[0].torres).toEqual(['7']);
  });

  it('conflito confirmado move as fotos para a torre sugerida e mantem a original so se sobrar foto propria', () => {
    const analysis = analysisOf([
      photo({ n: 5, name: 'a', time: '09:00' }),
      photo({ n: 6, offsetM: 8, label: 'BMDOPR\n5', name: 'b', time: '10:30' }),
    ]);
    const decisions = buildDefaultDecisions(analysis);
    const conflictId = Object.keys(decisions.divergences)[0];
    expect(decisions.divergences[conflictId]).toEqual({ status: 'pending', numero: '6' });

    // pendente: fica na etiqueta
    expect(mergeAnalysisIntoForm(emptyForm, analysis, decisions).form.detalhesDias[0].torres).toEqual(['5']);
    expect(mergeAnalysisIntoForm(emptyForm, analysis, decisions).summary.pendingConflicts).toBe(1);

    // confirmado: 5 (foto propria) + 6
    decisions.divergences[conflictId].status = 'confirmed';
    expect(mergeAnalysisIntoForm(emptyForm, analysis, decisions).form.detalhesDias[0].torres).toEqual(['5', '6']);

    // confirmado mas sem foto propria da 5: so a 6
    const onlyConflict = analysisOf([photo({ n: 6, offsetM: 8, label: 'BMDOPR\n5', name: 'b', time: '10:30' })]);
    const d2 = buildDefaultDecisions(onlyConflict);
    d2.divergences[Object.keys(d2.divergences)[0]].status = 'confirmed';
    expect(mergeAnalysisIntoForm(emptyForm, onlyConflict, d2).form.detalhesDias[0].torres).toEqual(['6']);
  });

  it('preserva clima, hotel, obs e temErosao de dias existentes e nao duplica torres', () => {
    const existingForm = {
      ...emptyForm,
      dataInicio: '2026-09-22',
      dataFim: '2026-09-22',
      detalhesDias: [{
        data: '2026-09-22', clima: 'Sol', hotelNome: 'Hotel Ravenna', hotelMunicipio: 'Divinopolis', hotelTorreBase: '5',
        torres: ['5'], torresInput: '5', torresDetalhadas: [{ numero: '5', obs: 'Acesso facil', temErosao: true }],
      }],
    };
    const analysis = analysisOf([photo({ n: 5, name: 'a' }), photo({ n: 3, name: 'b', time: '11:00' })]);
    const { form, summary } = mergeAnalysisIntoForm(existingForm, analysis, buildDefaultDecisions(analysis));
    const day = form.detalhesDias[0];
    expect(day.clima).toBe('Sol');
    expect(day.hotelNome).toBe('Hotel Ravenna');
    expect(day.torresDetalhadas).toEqual([
      { numero: '3', obs: '', temErosao: false },
      { numero: '5', obs: 'Acesso facil', temErosao: true },
    ]);
    expect(summary).toMatchObject({ towersAdded: 1, towersKept: 1, daysCreated: 0 });
  });

  it('periodo so expande, nunca encolhe', () => {
    const wideForm = { ...emptyForm, dataInicio: '2026-09-14', dataFim: '2026-09-30', detalhesDias: [] };
    const analysis = analysisOf([photo({ n: 2, name: 'a' })]);
    const { form, summary } = mergeAnalysisIntoForm(wideForm, analysis, buildDefaultDecisions(analysis));
    expect(form.dataInicio).toBe('2026-09-14');
    expect(form.dataFim).toBe('2026-09-30');
    expect(summary.periodChanged).toBeNull();
  });

  it('fim de semana com fotos entra no diario; sem fotos fica fora', () => {
    const analysis = analysisOf([
      photo({ n: 2, date: '2026-09-25', time: '09:00', name: 'fri' }), // sexta
      photo({ n: 3, date: '2026-09-26', time: '09:00', name: 'sat' }), // sabado
    ]);
    const { form } = mergeAnalysisIntoForm(emptyForm, analysis, buildDefaultDecisions(analysis));
    expect(form.detalhesDias.map((d) => d.data)).toEqual(['2026-09-25', '2026-09-26']);
    expect(form.detalhesDias[1].torres).toEqual(['3']);
  });

  it('dia de gap: manter com motivo chuva define clima; descartar remove o dia; feriado vem pre-marcado', () => {
    const holidaysIndex = new Map([['2026-09-23', { nome: 'Feriado', tipo: 'nacional' }]]);
    const analysis = analysisOf([
      photo({ n: 2, date: '2026-09-22', time: '09:00', name: 'a' }),
      photo({ n: 9, date: '2026-09-24', time: '09:00', name: 'b' }),
    ], { holidaysIndex });
    const decisions = buildDefaultDecisions(analysis);
    expect(decisions.gapDays['2026-09-23']).toEqual({ keep: true, reason: 'feriado' });

    decisions.gapDays['2026-09-23'] = { keep: true, reason: 'chuva' };
    let result = mergeAnalysisIntoForm(emptyForm, analysis, decisions);
    expect(result.form.detalhesDias.find((d) => d.data === '2026-09-23').clima).toBe('Chuva');

    decisions.gapDays['2026-09-23'] = { keep: false, reason: '' };
    result = mergeAnalysisIntoForm(emptyForm, analysis, decisions);
    expect(result.form.detalhesDias.map((d) => d.data)).toEqual(['2026-09-22', '2026-09-24']);
    expect(result.summary.gapDaysKept).toBe(0);
  });

  it('e idempotente: aplicar duas vezes nao duplica nem altera', () => {
    const analysis = analysisOf([photo({ n: 2, name: 'a' }), photo({ n: 3, name: 'b', time: '11:00' })]);
    const decisions = buildDefaultDecisions(analysis);
    const once = mergeAnalysisIntoForm(emptyForm, analysis, decisions).form;
    const twice = mergeAnalysisIntoForm(once, analysis, decisions);
    expect(twice.form.detalhesDias).toEqual(once.detalhesDias);
    expect(twice.summary.towersAdded).toBe(0);
    expect(twice.summary.towersKept).toBe(2);
  });

  it('fotos nao resolvidas e sem data nao entram e sao contadas', () => {
    const analysis = analysisOf([
      photo({ n: 20, offsetM: 1000, label: null, name: 'far' }),
      photo({ n: 2, date: null, time: null, name: 'undated' }),
      photo({ n: 2, name: 'ok' }),
    ]);
    const { form, summary } = mergeAnalysisIntoForm(emptyForm, analysis, buildDefaultDecisions(analysis));
    expect(form.detalhesDias[0].torres).toEqual(['2']);
    expect(summary).toMatchObject({ skippedUnresolved: 1, skippedUndated: 1 });
  });

  it('usa o ensureDayShape injetado', () => {
    const analysis = analysisOf([photo({ n: 2, name: 'a' })]);
    const ensureDayShape = (day) => ({ ...day, marcado: true });
    const { form } = mergeAnalysisIntoForm(emptyForm, analysis, buildDefaultDecisions(analysis), { ensureDayShape });
    expect(form.detalhesDias[0].marcado).toBe(true);
  });
});

describe('buildFileKey / toIsoWithLocalOffset', () => {
  it('monta a chave estavel do arquivo', () => {
    expect(buildFileKey({ webkitRelativePath: 'BMDOPR/126/a.jpg', name: 'a.jpg', size: 10, lastModified: 5 })).toBe('BMDOPR/126/a.jpg|10|5');
    expect(buildFileKey({ name: 'a.jpg' })).toBe('a.jpg|0|0');
  });

  it('converte a hora local do EXIF em ISO com o offset do navegador', () => {
    expect(toIsoWithLocalOffset('2026-09-22T14:14:00')).toBe(new Date(2026, 8, 22, 14, 14, 0).toISOString());
    expect(toIsoWithLocalOffset('2026-09-22T14:14')).toBe(new Date(2026, 8, 22, 14, 14, 0).toISOString());
    expect(toIsoWithLocalOffset('')).toBeNull();
    expect(toIsoWithLocalOffset('ontem')).toBeNull();
  });
});

describe('buildPhotoAssignments', () => {
  const latOf = (n, offsetM = 10) => towerLat(n) + offsetM * DEG_PER_M_LAT;
  const mk = (key, n, extra = {}) => ({
    key,
    name: key,
    relativePath: '',
    gpsLat: latOf(n, extra.offsetM ?? 10),
    gpsLon: -44,
    capturedAt: '2026-09-22T10:00:00',
    capturedDate: '2026-09-22',
    capturedTime: '10:00',
    description: `BMDOPR\n${n}`,
    ...extra,
  });

  it('torre da etiqueta vira exif_label com captureAt ISO; GPS puro vira gps_nearest desmarcado', () => {
    const analysis = analyzePhotoCampaign([
      mk('a', 5),
      mk('g', 7, { description: null, offsetM: 30, capturedTime: '11:00', capturedAt: '2026-09-22T11:00:00' }),
    ], PROJECT);
    const assignments = buildPhotoAssignments(analysis, buildDefaultDecisions(analysis));
    expect(assignments.a).toMatchObject({ towerId: '5', towerSource: 'exif_label', include: true, captureAt: new Date(2026, 8, 22, 10, 0, 0).toISOString() });
    expect(assignments.a.gpsLat).toBeCloseTo(latOf(5), 6);
    expect(assignments.g).toMatchObject({ towerId: '7', towerSource: 'gps_nearest', include: false });
  });

  it('conflito confirmado move so as fotos do conflito para a torre sugerida', () => {
    const analysis = analyzePhotoCampaign([
      mk('own', 5),
      mk('wrong', 6, { offsetM: 8, description: 'BMDOPR\n5', capturedTime: '10:30', capturedAt: '2026-09-22T10:30:00' }),
    ], PROJECT);
    const decisions = buildDefaultDecisions(analysis);
    expect(buildPhotoAssignments(analysis, decisions).wrong).toMatchObject({ towerId: '5', towerSource: 'exif_label' });

    decisions.divergences[Object.keys(decisions.divergences)[0]].status = 'confirmed';
    const confirmed = buildPhotoAssignments(analysis, decisions);
    expect(confirmed.own).toMatchObject({ towerId: '5', towerSource: 'exif_label' });
    expect(confirmed.wrong).toMatchObject({ towerId: '6', towerSource: 'gps_nearest' });
  });

  it('assunto e legenda padrao: acesso/contexto ganham legenda com a torre, torre fica sem legenda', () => {
    const analysis = analyzePhotoCampaign([
      mk('t', 5),
      mk('a', 5, { description: 'BMDOPR\n5\nACESSO', offsetM: 400 }),
      mk('c', 5, { description: 'BMDOPR\n5\nCONTEXTO' }),
    ], PROJECT);
    const assignments = buildPhotoAssignments(analysis, buildDefaultDecisions(analysis));
    expect(assignments.t).toMatchObject({ towerId: '5', subject: 'torre', caption: null });
    expect(assignments.a).toMatchObject({ towerId: '5', towerSource: 'exif_label', subject: 'acesso', caption: 'Acesso a torre 5', include: true });
    expect(assignments.c).toMatchObject({ subject: 'contexto', caption: 'Contexto - torre 5' });
    expect(buildDefaultSubjectCaption('acesso', '')).toBe('Acesso');
    expect(buildDefaultSubjectCaption('torre', '5')).toBeNull();
  });

  it('pasta vira folder_path; nao resolvidas e sem data ficam pending/incluidas', () => {
    const analysis = analyzePhotoCampaign([
      mk('f', 3, { description: null, relativePath: 'BMDOPR/3/f.jpg' }),
      mk('far', 20, { description: null, offsetM: 1000 }),
      mk('nodate', 4, { capturedAt: null, capturedDate: null, capturedTime: null }),
    ], PROJECT);
    const assignments = buildPhotoAssignments(analysis, buildDefaultDecisions(analysis));
    expect(assignments.f).toMatchObject({ towerId: '3', towerSource: 'folder_path', include: true });
    expect(assignments.far).toMatchObject({ towerId: null, towerSource: 'pending', include: true });
    expect(assignments.nodate).toMatchObject({ towerId: '4', towerSource: 'exif_label', captureAt: null, include: true });
  });
});

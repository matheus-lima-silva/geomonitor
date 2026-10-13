import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Checkbox, HintText, Input, Modal, Select, Skeleton } from '../../../components/ui';
import { readExifMetaFromFile } from '../../../utils/photoCampaign/exifMeta';
import {
  GAP_DAY_REASONS,
  analyzePhotoCampaign,
  buildDefaultDecisions,
  buildFileKey,
  buildSubjectOverrides,
  mergeAnalysisIntoForm,
} from '../../../utils/photoCampaign/photoCampaignAnalysis';
import { toBrDate } from '../../inspections/utils/inspectionWorkflow';
import { PHOTO_SUBJECTS, PHOTO_SUBJECT_LABELS } from '../utils/reportUtils';

/**
 * "Preencher vistoria pelas fotos": le o EXIF das fotos da campanha no
 * navegador (nada e enviado), propoe dias e torres do diario, lista as
 * divergencias de legenda e devolve ao wizard as decisoes do usuario.
 *
 * Estados: pick (escolher pasta) -> analyzing (progresso) -> review.
 * `readExifMeta` e injetavel para testes.
 */

const WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];
const READ_CONCURRENCY = 4;
const YIELD_EVERY = 25;

function isJpegFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return true;
  return /\.jpe?g$/i.test(String(file?.name || ''));
}

const fileKey = buildFileKey;

const DEFAULT_DESTINATIONS = {
  diary: { available: true, enabled: true, locked: true, options: [], value: '' },
  workspace: { available: false, enabled: false, locked: false, options: [], value: '', allowCreate: false },
};

function normalizeDestinations(config) {
  const source = config && typeof config === 'object' ? config : {};
  const diary = { ...DEFAULT_DESTINATIONS.diary, ...(source.diary || {}) };
  const workspace = { ...DEFAULT_DESTINATIONS.workspace, ...(source.workspace || {}) };
  return { diary, workspace };
}

function supportsDirectoryPicker() {
  if (typeof document === 'undefined') return false;
  try {
    return 'webkitdirectory' in document.createElement('input');
  } catch {
    return false;
  }
}

function weekdayLabel(weekday) {
  return Number.isInteger(weekday) ? WEEKDAYS_PT[weekday] : '';
}

function formatMeters(value) {
  return Number.isFinite(value) ? `${Math.round(value)} m` : '';
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function towerBadge(group) {
  if (group.conflict) return { tone: 'danger', text: 'Conflito de legenda' };
  if (group.source === 'gps') return { tone: 'warning', text: `Sugestão GPS · ${formatMeters(group.medianDistanceM)}` };
  const origin = group.source === 'folder' ? 'Pasta' : 'Etiqueta';
  if (group.confidence === 'high') return { tone: 'ok', text: `${origin} + GPS ${formatMeters(group.medianDistanceM)}` };
  if (Number.isFinite(group.medianDistanceM) && group.medianDistanceM > 250) {
    return { tone: 'warning', text: `Conferir · ${formatMeters(group.medianDistanceM)} da torre` };
  }
  return { tone: 'neutral', text: Number.isFinite(group.medianDistanceM) ? `${origin} · GPS ${formatMeters(group.medianDistanceM)}` : `${origin} · sem GPS` };
}

async function readAllMetas(files, readExifMeta, { onProgress, isCancelled }) {
  const results = new Array(files.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < files.length) {
      if (isCancelled()) return;
      const index = cursor;
      cursor += 1;
      const file = files[index];
      let meta = null;
      try {
        meta = await readExifMeta(file);
      } catch {
        meta = null;
      }
      results[index] = {
        key: fileKey(file),
        name: file.name,
        relativePath: file.webkitRelativePath || '',
        ...(meta || {}),
      };
      done += 1;
      onProgress(done);
      if (done % YIELD_EVERY === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, files.length) }, () => worker()));
  return results.filter(Boolean);
}

export default function CampaignPhotoIntakeModal({
  open,
  project,
  currentForm,
  feriadosIndex,
  onCancel,
  onApply,
  readExifMeta = readExifMetaFromFile,
  // Destinos da captacao (ver DEFAULT_DESTINATIONS). O wizard trava o diario e
  // oferece o workspace como opcional; o import do workspace faz o inverso.
  destinations: destinationsConfig = null,
}) {
  const [stage, setStage] = useState('pick');
  const [destinations, setDestinations] = useState(() => normalizeDestinations(destinationsConfig));
  const [files, setFiles] = useState([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // Metadados EXIF lidos: ficam para re-rodar a analise quando o usuario marca
  // fotos como acesso/contexto (a analise das ~400 fotos leva ~100 ms).
  const [metas, setMetas] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [showInfoDivergences, setShowInfoDivergences] = useState(false);
  // Pilha de acoes desfazíveis: { type: 'confirm', id } | { type: 'subject', subject, changes: [{ key, prev }] }.
  const [undoStack, setUndoStack] = useState([]);
  const [confirmPending, setConfirmPending] = useState(false);
  const cancelledRef = useRef(false);
  const directorySupported = useMemo(() => supportsDirectoryPicker(), []);

  // Reseta ao fechar/abrir.
  useEffect(() => {
    if (open) return undefined;
    cancelledRef.current = true;
    setStage('pick');
    setFiles([]);
    setIgnoredCount(0);
    setProgress({ done: 0, total: 0 });
    setMetas([]);
    setAnalysis(null);
    setDecisions(null);
    setExpandedDays(new Set());
    setExpandedGroups(new Set());
    setShowInfoDivergences(false);
    setUndoStack([]);
    setConfirmPending(false);
    setDestinations(normalizeDestinations(destinationsConfig));
    return undefined;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const existingTowersByDate = useMemo(() => {
    const map = new Map();
    for (const day of currentForm?.detalhesDias || []) {
      const date = String(day?.data || '').trim();
      if (!date) continue;
      map.set(date, new Set((day?.torresDetalhadas || []).map((tower) => String(tower?.numero || '').trim())));
    }
    return map;
  }, [currentForm]);

  const conflictDivergences = useMemo(
    () => (analysis?.divergences || []).filter((d) => d.kind === 'label_conflict'),
    [analysis],
  );
  const infoDivergences = useMemo(
    () => (analysis?.divergences || []).filter((d) => d.severity === 'info'),
    [analysis],
  );
  const pendingConflicts = conflictDivergences.filter((d) => decisions?.divergences?.[d.id]?.status !== 'confirmed');
  const resolvedConflicts = conflictDivergences.filter((d) => decisions?.divergences?.[d.id]?.status === 'confirmed');

  const includedCount = useMemo(() => {
    if (!analysis || !decisions) return 0;
    let count = 0;
    for (const day of analysis.days) {
      for (const group of day.towers) {
        if (decisions.towers[group.key]?.include) count += 1;
      }
    }
    return count;
  }, [analysis, decisions]);

  const daysWithIncluded = useMemo(() => {
    if (!analysis || !decisions) return 0;
    return analysis.days.filter((day) => day.towers.some((group) => decisions.towers[group.key]?.include)).length;
  }, [analysis, decisions]);

  const previewSummary = useMemo(() => {
    if (!analysis || !decisions) return null;
    return mergeAnalysisIntoForm(currentForm || {}, analysis, decisions).summary;
  }, [analysis, decisions, currentForm]);

  const includedPhotoCount = useMemo(() => {
    if (!analysis || !decisions) return 0;
    let count = 0;
    for (const day of analysis.days) {
      for (const group of day.towers) {
        if (decisions.towers[group.key]?.include) count += group.count;
      }
      count += day.unresolved.length;
    }
    return count + (analysis.undated?.length || 0);
  }, [analysis, decisions]);

  const subjectMarkedCount = undoStack
    .filter((entry) => entry.type === 'subject')
    .reduce((acc, entry) => acc + entry.changes.length, 0);

  if (!open) return null;

  function handleFilesSelected(event) {
    const list = Array.from(event.target.files || []);
    const jpegs = list.filter(isJpegFile);
    setFiles(jpegs);
    setIgnoredCount(list.length - jpegs.length);
  }

  async function handleAnalyze() {
    if (!files.length) return;
    cancelledRef.current = false;
    setStage('analyzing');
    setProgress({ done: 0, total: files.length });
    const metas = await readAllMetas(files, readExifMeta, {
      onProgress: (done) => setProgress({ done, total: files.length }),
      isCancelled: () => cancelledRef.current,
    });
    if (cancelledRef.current) return;
    const result = analyzePhotoCampaign(metas, project, { holidaysIndex: feriadosIndex });
    setMetas(metas);
    setAnalysis(result);
    setDecisions(buildDefaultDecisions(result));
    setExpandedDays(new Set(result.days.slice(0, 1).map((day) => day.data)));
    setExpandedGroups(new Set());
    setUndoStack([]);
    setConfirmPending(false);
    setStage('review');
  }

  // Re-roda a analise com os assuntos decididos pelo usuario e preserva as
  // decisoes por chave (grupos/divergencias que sumiram sao descartadas).
  function reanalyze(nextDecisions) {
    const result = analyzePhotoCampaign(metas, project, { holidaysIndex: feriadosIndex, subjects: buildSubjectOverrides(nextDecisions) });
    const defaults = buildDefaultDecisions(result);
    const pick = (defaultMap, prevMap) => Object.fromEntries(
      Object.keys(defaultMap).map((key) => [key, prevMap?.[key] || defaultMap[key]]),
    );
    const reconciled = {
      towers: pick(defaults.towers, nextDecisions.towers),
      divergences: pick(defaults.divergences, nextDecisions.divergences),
      gapDays: pick(defaults.gapDays, nextDecisions.gapDays),
      photos: nextDecisions.photos || {},
    };
    setAnalysis(result);
    setDecisions(reconciled);
    setUndoStack((prev) => prev.filter((entry) => entry.type !== 'confirm' || reconciled.divergences[entry.id]));
  }

  function setPhotoSubject(keys, subject, { record = true } = {}) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    if (!list.length || !decisions) return;
    const photos = { ...(decisions.photos || {}) };
    const changes = list.map((key) => ({ key, prev: photos[key]?.subject || null }));
    for (const key of list) photos[key] = { ...(photos[key] || {}), subject };
    if (record) setUndoStack((prev) => [...prev, { type: 'subject', subject, changes }]);
    reanalyze({ ...decisions, photos });
  }

  function toggleGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCancelAnalysis() {
    cancelledRef.current = true;
    setStage('pick');
  }

  function updateTowerDecision(key, patch) {
    setDecisions((prev) => ({ ...prev, towers: { ...prev.towers, [key]: { ...prev.towers[key], ...patch } } }));
  }

  function setDayIncluded(day, include) {
    setDecisions((prev) => {
      const towers = { ...prev.towers };
      for (const group of day.towers) towers[group.key] = { ...towers[group.key], include };
      return { ...prev, towers };
    });
  }

  function updateDivergenceDecision(id, patch) {
    setDecisions((prev) => ({ ...prev, divergences: { ...prev.divergences, [id]: { ...prev.divergences[id], ...patch } } }));
  }

  function confirmDivergence(id) {
    updateDivergenceDecision(id, { status: 'confirmed' });
    setUndoStack((prev) => [...prev, { type: 'confirm', id }]);
  }

  function undoLast() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((prev) => prev.slice(0, -1));
    if (last.type === 'confirm') {
      updateDivergenceDecision(last.id, { status: 'pending' });
      return;
    }
    const photos = { ...(decisions?.photos || {}) };
    for (const { key, prev } of last.changes) {
      if (prev) photos[key] = { ...(photos[key] || {}), subject: prev };
      else delete photos[key];
    }
    reanalyze({ ...decisions, photos });
  }

  function updateGapDecision(date, patch) {
    setDecisions((prev) => ({ ...prev, gapDays: { ...prev.gapDays, [date]: { ...prev.gapDays[date], ...patch } } }));
  }

  function toggleDay(date) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  const diaryOn = destinations.diary.available && destinations.diary.enabled;
  const workspaceOn = destinations.workspace.available && destinations.workspace.enabled;

  function updateDestination(key, patch) {
    setDestinations((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function handleApply() {
    if (!analysis || !decisions) return;
    if (pendingConflicts.length > 0 && !confirmPending) {
      setConfirmPending(true);
      return;
    }
    // Os File ficam so no estado do modal: entrega um mapa chave -> File para
    // quem for subir as fotos depois (o estado e limpo ao fechar).
    const filesByKey = new Map(files.map((file) => [fileKey(file), file]));
    onApply?.({
      analysis,
      decisions,
      filesByKey,
      destinations: {
        diary: { enabled: diaryOn, value: destinations.diary.value || '' },
        workspace: { enabled: workspaceOn, value: destinations.workspace.value || '' },
      },
    });
  }

  function renderDestinations() {
    // Sem configuracao explicita o modal e so "preencher o diario" (sem bloco).
    if (!destinationsConfig) return null;
    const { diary, workspace } = destinations;
    if (!diary.available && !workspace.available) return null;
    const diaryOptions = Array.isArray(diary.options) ? diary.options : [];
    const workspaceOptions = Array.isArray(workspace.options) ? workspace.options : [];
    return (
      <section aria-label="Destinos" className="flex flex-col gap-2" data-testid="photo-intake-destinations">
        <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">Destinos</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {diary.available ? (
            <div className={`flex gap-3 rounded-xl border p-3 ${diary.enabled ? 'border-info-border bg-info-light' : 'border-slate-200 bg-white'}`}>
              <Checkbox
                id="photo-intake-dest-diary"
                checked={Boolean(diary.enabled)}
                disabled={Boolean(diary.locked)}
                aria-label="Preencher o diário da vistoria"
                onChange={(event) => updateDestination('diary', { enabled: event.target.checked })}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <label htmlFor="photo-intake-dest-diary" className="text-sm font-semibold text-slate-800">Preencher o diário da vistoria</label>
                {diaryOptions.length > 0 ? (
                  <Select
                    id="photo-intake-dest-diary-target"
                    aria-label="Vistoria de destino"
                    value={diary.value || ''}
                    disabled={!diary.enabled || Boolean(diary.locked)}
                    onChange={(event) => updateDestination('diary', { value: event.target.value })}
                  >
                    {diaryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                ) : null}
                <span className="text-xs text-slate-500">{diary.hint || 'Dias e torres entram no diário; clima e hotel continuam manuais.'}</span>
              </div>
            </div>
          ) : null}
          {workspace.available ? (
            <div className={`flex gap-3 rounded-xl border p-3 ${workspace.enabled ? 'border-info-border bg-info-light' : 'border-slate-200 bg-white'}`}>
              <Checkbox
                id="photo-intake-dest-workspace"
                checked={Boolean(workspace.enabled)}
                disabled={Boolean(workspace.locked)}
                aria-label="Enviar fotos para o workspace de relatório"
                onChange={(event) => updateDestination('workspace', { enabled: event.target.checked })}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <label htmlFor="photo-intake-dest-workspace" className="text-sm font-semibold text-slate-800">Enviar fotos para o workspace de relatório</label>
                {workspaceOptions.length > 0 ? (
                  <Select
                    id="photo-intake-dest-workspace-target"
                    aria-label="Workspace de destino"
                    value={workspace.value || ''}
                    disabled={!workspace.enabled || Boolean(workspace.locked)}
                    onChange={(event) => updateDestination('workspace', { value: event.target.value })}
                  >
                    {workspaceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                ) : null}
                <span className="text-xs text-slate-500">{workspace.hint || 'Cada foto sobe com torre, data da foto e origem da torre (etiqueta EXIF, pasta ou GPS).'}</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const projectLabel = project ? `${project.id}${project.nome ? ` — ${project.nome}` : ''}` : '';
  const hasCoordinates = Array.isArray(project?.torresCoordenadas) && project.torresCoordenadas.length > 0;

  function renderPick() {
    return (
      <div className="flex flex-col gap-4" data-testid="photo-autofill-pick">
        <div className="flex items-start gap-3 rounded-xl border border-info-border bg-info-light p-4 text-sm text-slate-700">
          <AppIcon name="info" className="w-5 h-5 text-info shrink-0 mt-0.5" aria-hidden="true" />
          <p className="m-0">
            As fotos são lidas apenas no seu navegador: só o cabeçalho EXIF (data, GPS e a etiqueta
            <span className="font-mono text-xs"> SIGLA / torre</span> gravada pelo Timestamp Camera) é lido. Nenhuma foto é enviada agora.
            Uma 3ª linha <span className="font-mono text-xs">ACESSO</span> ou <span className="font-mono text-xs">CONTEXTO</span> na etiqueta marca a foto como acesso/contexto (fora dos avisos de divergência).
          </p>
        </div>
        <Input
          id="inspection-photo-autofill-folder"
          label="Pasta das fotos"
          hint={directorySupported
            ? 'Selecione a pasta da campanha. Subpastas por torre ajudam a identificar fotos sem etiqueta.'
            : 'Seu navegador não permite selecionar pastas; selecione as fotos diretamente.'}
          type="file"
          multiple
          accept="image/jpeg"
          onChange={handleFilesSelected}
          {...(directorySupported ? { webkitdirectory: '', directory: '' } : {})}
        />
        {files.length > 0 ? (
          <p className="m-0 text-sm text-slate-600" data-testid="photo-autofill-count">
            {pluralize(files.length, 'foto JPEG encontrada', 'fotos JPEG encontradas')}
            {ignoredCount > 0 ? ` · ${pluralize(ignoredCount, 'arquivo ignorado', 'arquivos ignorados')} (não JPEG)` : ''}
          </p>
        ) : null}
        {!hasCoordinates ? (
          <Badge tone="warning" size="md">Empreendimento sem coordenadas de torres: só etiqueta e pasta serão usadas.</Badge>
        ) : null}
      </div>
    );
  }

  function renderAnalyzing() {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="flex flex-col gap-4" data-testid="photo-autofill-analyzing">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <AppIcon name="loader" className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Lendo EXIF das fotos... {progress.done}/{progress.total}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <Skeleton lines={4} />
      </div>
    );
  }

  function renderConflictRow(divergence) {
    const decision = decisions.divergences[divergence.id] || { status: 'pending', numero: divergence.suggested };
    const selectId = `divergence-${divergence.id.replace(/[^a-z0-9]/gi, '-')}`;
    return (
      <div key={divergence.id} className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 text-sm" data-testid="photo-autofill-conflict">
        <div className="flex items-start gap-2">
          <span className="font-mono text-sm font-semibold rounded border border-slate-300 bg-slate-100 px-2 text-slate-800">{divergence.numero}</span>
          <span className="text-slate-700">{divergence.text}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPhotoSubject(divergence.photoKeys, 'acesso')}
            title="Marca estas fotos como foto de acesso: saem das regras de divergência e ganham legenda 'Acesso a torre N'."
          >
            <AppIcon name="route-plan" className="w-4 h-4" aria-hidden="true" />
            É acesso
          </Button>
          <span className="flex-1" />
          <label htmlFor={selectId} className="text-2xs font-bold uppercase tracking-wide text-slate-500">Usar torre</label>
          <Select
            id={selectId}
            fullWidth={false}
            value={decision.numero}
            onChange={(event) => updateDivergenceDecision(divergence.id, { numero: event.target.value })}
          >
            <option value={divergence.suggested}>{divergence.suggested} (GPS)</option>
            <option value={divergence.numero}>{divergence.numero} (etiqueta)</option>
          </Select>
          <Button size="sm" variant="primary" onClick={() => confirmDivergence(divergence.id)}>
            <AppIcon name="check" className="w-4 h-4" aria-hidden="true" />
            Confirmar
          </Button>
        </div>
      </div>
    );
  }

  function renderDivergences() {
    if (!conflictDivergences.length && !infoDivergences.length && !undoStack.length) return null;
    const lastConfirmed = resolvedConflicts[resolvedConflicts.length - 1];
    const hasPanel = pendingConflicts.length > 0;
    const undoButton = undoStack.length > 0 ? (
      <Button size="sm" variant="ghost" onClick={undoLast} aria-label="Desfazer a última ação">
        <AppIcon name="undo" className="w-4 h-4" aria-hidden="true" />
        Desfazer
      </Button>
    ) : null;
    const subjectBadge = subjectMarkedCount > 0
      ? <Badge tone="neutral" data-testid="photo-autofill-subject-marked">{pluralize(subjectMarkedCount, 'foto marcada como acesso/contexto', 'fotos marcadas como acesso/contexto')}</Badge>
      : null;
    return (
      <section aria-label="Divergências de legenda" className="flex flex-col gap-2">
        {hasPanel ? (
          <div className="rounded-xl border border-danger-border bg-white overflow-hidden" data-testid="photo-autofill-divergences">
            <div className="flex flex-wrap items-center gap-2 border-b border-danger-border bg-danger-light px-3 py-2">
              <AppIcon name="alert" className="w-4 h-4 text-danger-dark" aria-hidden="true" />
              <strong className="text-sm text-danger-dark">Divergências de legenda ({pendingConflicts.length})</strong>
              <HintText label="divergências de legenda">
                A etiqueta da foto aponta uma torre, o GPS aponta outra. Escolha qual vale e confirme. Enquanto houver pendência, aplicar ao diário pede confirmação.
              </HintText>
              <span className="flex-1" />
              {resolvedConflicts.length > 0 ? (
                <Badge tone="ok">{resolvedConflicts.length} resolvida{resolvedConflicts.length > 1 ? 's' : ''}{lastConfirmed ? ` · ${lastConfirmed.numero} → ${decisions.divergences[lastConfirmed.id]?.numero}` : ''}</Badge>
              ) : null}
              {subjectBadge}
              {undoButton}
              <Badge tone="warning">{pendingConflicts.length} pendente{pendingConflicts.length > 1 ? 's' : ''}</Badge>
            </div>
            {pendingConflicts.map(renderConflictRow)}
          </div>
        ) : (resolvedConflicts.length > 0 || subjectMarkedCount > 0) ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success-border bg-success-light px-3 py-2 text-sm text-green-800" data-testid="photo-autofill-divergences-resolved">
            <AppIcon name="check-circle-2" className="w-4 h-4" aria-hidden="true" />
            <span className="flex-1">
              {resolvedConflicts.length > 0 ? `Divergências resolvidas: ${resolvedConflicts.map((d) => `${d.numero} → ${decisions.divergences[d.id]?.numero}`).join(', ')}.` : 'Sem divergências pendentes.'}
            </span>
            {subjectBadge}
            {undoButton}
          </div>
        ) : null}
        {infoDivergences.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50">
            <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => setShowInfoDivergences((prev) => !prev)} aria-expanded={showInfoDivergences}>
              <AppIcon name="info" className="w-4 h-4" aria-hidden="true" />
              Só aviso, sem ação ({infoDivergences.length})
              <AppIcon name={showInfoDivergences ? 'chevron-up' : 'chevron-down'} className="w-4 h-4 ml-auto" aria-hidden="true" />
            </Button>
            {showInfoDivergences ? (
              <ul className="m-0 list-none flex flex-col gap-1 px-3 pb-3 text-xs text-slate-600">
                {infoDivergences.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2" data-testid="photo-autofill-info">
                    <span className="font-mono font-semibold text-slate-800">{d.numero}</span>
                    <span className="flex-1 min-w-[12rem]">{toBrDate(d.date)} · {d.text}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPhotoSubject(d.photoKeys, 'acesso')}
                      title="Marca as fotos deste aviso como foto de acesso."
                    >
                      <AppIcon name="route-plan" className="w-4 h-4" aria-hidden="true" />
                      É acesso
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  function renderGroupPhotos(group) {
    return (
      <ul className="m-0 list-none flex flex-col gap-1 border-t border-slate-100 bg-slate-50 px-3 py-2" data-testid="photo-autofill-group-photos">
        {group.photos.map((photo) => {
          const subject = photo.subject || 'torre';
          return (
            <li key={photo.key} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-mono text-slate-800 truncate max-w-[14rem]" title={photo.name}>{photo.name}</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <AppIcon name="clock" className="w-3 h-3" aria-hidden="true" />
                {photo.capturedTime || '--:--'}
              </span>
              <span className="whitespace-nowrap">{Number.isFinite(photo.distanceToTowerM) ? `${formatMeters(photo.distanceToTowerM)} da torre` : 'sem GPS'}</span>
              {photo.conflict ? <Badge tone="danger">GPS: torre {photo.conflict.suggested}</Badge> : null}
              <span className="flex-1" />
              <div className="inline-flex gap-1 rounded-md border border-slate-200 bg-white p-0.5" role="group" aria-label={`Assunto da foto ${photo.name}`}>
                {PHOTO_SUBJECTS.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={subject === option ? 'primary' : 'ghost'}
                    aria-pressed={subject === option}
                    onClick={() => { if (subject !== option) setPhotoSubject(photo.key, option); }}
                  >
                    {PHOTO_SUBJECT_LABELS[option]}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderTowerRow(day, group) {
    const decision = decisions.towers[group.key] || { include: group.defaultIncluded, numero: group.numero };
    const badge = towerBadge(group);
    const alreadyInDiary = existingTowersByDate.get(day.data)?.has(group.numero);
    const groupExpanded = expandedGroups.has(group.key);
    return (
      <div key={group.key}>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 px-3 py-1.5 text-sm" data-testid="photo-autofill-tower">
        <Checkbox
          id={`tower-${group.key.replace(/[^a-z0-9]/gi, '-')}`}
          aria-label={`Incluir torre ${group.numero} em ${toBrDate(day.data)}`}
          checked={Boolean(decision.include)}
          onChange={(event) => updateTowerDecision(group.key, { include: event.target.checked })}
        />
        <span className="font-mono text-sm font-semibold rounded border border-slate-300 bg-slate-100 px-2 text-slate-800 min-w-[2.5rem] text-center">{group.numero}</span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
          <AppIcon name="clock" className="w-3 h-3" aria-hidden="true" />
          {group.firstAt}{group.lastAt && group.lastAt !== group.firstAt ? ` – ${group.lastAt}` : ''}
        </span>
        <Button size="sm" variant="ghost" onClick={() => toggleGroup(group.key)} aria-expanded={groupExpanded} title="Listar as fotos desta torre">
          {pluralize(group.count, 'foto', 'fotos')}
          <AppIcon name={groupExpanded ? 'chevron-up' : 'chevron-down'} className="w-4 h-4" aria-hidden="true" />
        </Button>
        <span className="flex-1" />
        {group.accessCount > 0 ? <Badge tone="neutral">{group.accessCount} de acesso</Badge> : null}
        {group.contextCount > 0 ? <Badge tone="neutral">{group.contextCount} de contexto</Badge> : null}
        {alreadyInDiary ? <Badge tone="neutral">Já no diário</Badge> : null}
        <Badge tone={badge.tone}>{badge.text}</Badge>
      </div>
      {groupExpanded ? renderGroupPhotos(group) : null}
      </div>
    );
  }

  function renderDayCard(day) {
    const expanded = expandedDays.has(day.data);
    const includedHere = day.towers.filter((group) => decisions.towers[group.key]?.include).length;
    const dayConflicts = conflictDivergences.filter((d) => d.date === day.data && decisions.divergences[d.id]?.status !== 'confirmed').length;
    const isNewDay = !existingTowersByDate.has(day.data);
    const route = day.towers.map((group) => group.numero).join(' → ');
    return (
      <article key={day.data} className="rounded-xl border border-slate-200 bg-white shadow-card" data-testid="photo-autofill-day">
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
          <AppIcon name="calendar-days" className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <strong className="text-base text-slate-800">{toBrDate(day.data)}</strong>
          <span className="text-xs text-slate-500">{weekdayLabel(day.weekday)}</span>
          {isNewDay ? <Badge tone="info">Novo dia</Badge> : null}
          {day.isHoliday ? <Badge tone="warning">Feriado{day.holidayName ? ` - ${day.holidayName}` : ''}</Badge> : null}
          {dayConflicts > 0 ? <Badge tone="danger">{pluralize(dayConflicts, 'divergência', 'divergências')}</Badge> : null}
          <span className="flex-1 text-xs text-slate-500 truncate">
            {pluralize(day.towers.length, 'torre', 'torres')} · {pluralize(day.photoCount, 'foto', 'fotos')} · {day.firstAt} – {day.lastAt}
            {!expanded && route ? ` · ${route}` : ''}
          </span>
          <Button size="sm" variant="outline" onClick={() => toggleDay(day.data)} aria-expanded={expanded}>
            {expanded ? 'Ocultar' : 'Detalhar dia'}
          </Button>
        </div>
        {expanded ? (
          <div>
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              <span>{includedHere} de {day.towers.length} marcadas · ordem de visita</span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setDayIncluded(day, true)}>Marcar todas</Button>
              <Button size="sm" variant="ghost" onClick={() => setDayIncluded(day, false)}>Limpar</Button>
            </div>
            {day.towers.map((group) => renderTowerRow(day, group))}
            {day.unresolved.length > 0 ? (
              <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                {pluralize(day.unresolved.length, 'foto sem torre identificada', 'fotos sem torre identificada')} (não entram):{' '}
                {day.unresolved.map((photo) => `${photo.name}${photo.capturedTime ? ` ${photo.capturedTime}` : ''}`).join(', ')}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  function renderGapDay(gap) {
    const decision = decisions.gapDays[gap.data] || { keep: true, reason: '' };
    const selectId = `gap-reason-${gap.data}`;
    return (
      <article key={gap.data} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5" data-testid="photo-autofill-gap-day">
        <div className="flex flex-wrap items-center gap-2.5">
          <AppIcon name="calendar-days" className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <strong className="text-base text-slate-600">{toBrDate(gap.data)}</strong>
          <span className="text-xs text-slate-500">{weekdayLabel(gap.weekday)}</span>
          <Badge tone="warning">Sem fotos</Badge>
          {gap.isHoliday ? <Badge tone="warning">Feriado{gap.holidayName ? ` - ${gap.holidayName}` : ''}</Badge> : null}
          <span className="flex-1" />
          <label htmlFor={selectId} className="text-2xs font-bold uppercase tracking-wide text-slate-500">Motivo do dia</label>
          <Select id={selectId} fullWidth={false} value={decision.reason || ''} onChange={(event) => updateGapDecision(gap.data, { reason: event.target.value })}>
            {GAP_DAY_REASONS.map((option) => (
              <option key={option.value || 'none'} value={option.value}>{option.label}{option.value === 'feriado' && gap.isHoliday ? ' (detectado)' : ''}</option>
            ))}
          </Select>
          <Checkbox
            id={`gap-keep-${gap.data}`}
            label="Manter o dia no diário"
            checked={Boolean(decision.keep)}
            onChange={(event) => updateGapDecision(gap.data, { keep: event.target.checked })}
          />
        </div>
      </article>
    );
  }

  function renderReview() {
    const { stats, dateRange, gapDays, undated } = analysis;
    const currentStart = String(currentForm?.dataInicio || '').trim();
    const currentEnd = String(currentForm?.dataFim || '').trim();
    const periodChanged = previewSummary?.periodChanged;
    return (
      <div className="flex flex-col gap-4" data-testid="photo-autofill-review">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-xl text-slate-800">{stats.total}</strong>
            <span className="text-xs text-slate-500">fotos lidas{stats.undated ? ` · ${stats.undated} sem data` : ''}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-xl text-slate-800">{pluralize(analysis.days.length, 'dia', 'dias')}</strong>
            <span className="text-xs text-slate-500">{dateRange ? `${toBrDate(dateRange.start)} – ${toBrDate(dateRange.end)}` : 'sem datas'}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <strong className="block text-xl text-slate-800">{pluralize(stats.towers, 'torre', 'torres')}</strong>
            <span className="text-xs text-slate-500">{stats.byLabel} por etiqueta · {stats.byFolder} por pasta · {stats.byGps} por GPS</span>
          </div>
          <div className={`rounded-xl border p-3 ${pendingConflicts.length ? 'border-danger-border bg-danger-light' : 'border-slate-200 bg-white'}`}>
            <strong className={`block text-xl ${pendingConflicts.length ? 'text-danger-dark' : 'text-slate-800'}`}>{pendingConflicts.length}</strong>
            <span className={`text-xs ${pendingConflicts.length ? 'text-danger-dark' : 'text-slate-500'}`}>
              divergência{pendingConflicts.length === 1 ? '' : 's'} de legenda pendente{pendingConflicts.length === 1 ? '' : 's'}
              {resolvedConflicts.length ? ` · ${resolvedConflicts.length} resolvida${resolvedConflicts.length > 1 ? 's' : ''}` : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <AppIcon name="info" className="w-4 h-4" aria-hidden="true" />
          {periodChanged ? (
            <Badge tone="info">
              {currentStart ? `Amplia o período ${toBrDate(currentStart)} – ${toBrDate(currentEnd || currentStart)} para` : 'Define o período como'} {toBrDate(periodChanged.to.dataInicio)} – {toBrDate(periodChanged.to.dataFim)}
            </Badge>
          ) : (
            <Badge tone="neutral">Período da vistoria mantido</Badge>
          )}
          <Badge tone="neutral">Dias úteis no período sem fotos: {gapDays.length}</Badge>
          {stats.gpsOnlyGroups > 0 ? <Badge tone="warning">Sugestões só por GPS: {stats.gpsOnlyGroups} (desmarcadas)</Badge> : null}
          {stats.towersRepeatedAcrossDays.length > 0 ? <Badge tone="neutral">Torres em mais de um dia: {stats.towersRepeatedAcrossDays.join(', ')}</Badge> : null}
          {stats.unresolved > 0 ? <Badge tone="warning">Fotos sem torre: {stats.unresolved}</Badge> : null}
          {stats.accessPhotos > 0 ? <Badge tone="neutral">Fotos de acesso: {stats.accessPhotos}</Badge> : null}
          {stats.contextPhotos > 0 ? <Badge tone="neutral">Fotos de contexto: {stats.contextPhotos}</Badge> : null}
        </div>

        {renderDestinations()}

        {renderDivergences()}

        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">Diário proposto</span>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">{includedCount} torre{includedCount === 1 ? '' : 's'} marcada{includedCount === 1 ? '' : 's'}</span>
        </div>

        <div className="flex flex-col gap-3">
          {[...analysis.days.map((day) => ({ type: 'day', date: day.data, day })), ...gapDays.map((gap) => ({ type: 'gap', date: gap.data, gap }))]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((item) => (item.type === 'day' ? renderDayCard(item.day) : renderGapDay(item.gap)))}
        </div>

        {undated.length > 0 ? (
          <p className="m-0 text-xs text-slate-500">
            Fotos sem data ({undated.length}) não entram no diário: {undated.map((photo) => photo.name).join(', ')}
          </p>
        ) : null}
      </div>
    );
  }

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {stage === 'review' ? (
        <span className="text-xs text-slate-500">
          {workspaceOn
            ? 'As fotos sobem para o workspace ao aplicar. Clima, hotel e observações não são alterados.'
            : 'Clima, hotel e observações não são alterados. Nada é salvo até você salvar a vistoria.'}
        </span>
      ) : null}
      <span className="flex-1" />
      {stage === 'pick' ? (
        <>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={handleAnalyze} disabled={!files.length}>
            <AppIcon name="wand-2" className="w-4 h-4" aria-hidden="true" />
            Analisar fotos
          </Button>
        </>
      ) : null}
      {stage === 'analyzing' ? <Button variant="ghost" onClick={handleCancelAnalysis}>Cancelar</Button> : null}
      {stage === 'review' && !confirmPending ? (
        <>
          <Button variant="ghost" onClick={() => setStage('pick')}>Voltar</Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={(!diaryOn && !workspaceOn) || (diaryOn && !workspaceOn && includedCount === 0) || (workspaceOn && includedPhotoCount === 0)}
          >
            <AppIcon name={workspaceOn ? 'upload' : 'check'} className="w-4 h-4" aria-hidden="true" />
            {diaryOn && workspaceOn
              ? `Aplicar ao diário e enviar ${pluralize(includedPhotoCount, 'foto', 'fotos')}`
              : workspaceOn
                ? `Enviar ${pluralize(includedPhotoCount, 'foto', 'fotos')} para o workspace`
                : `Aplicar ao diário — ${pluralize(includedCount, 'torre', 'torres')} em ${pluralize(daysWithIncluded, 'dia', 'dias')}`}
          </Button>
        </>
      ) : null}
      {stage === 'review' && confirmPending ? (
        <span className="flex flex-wrap items-center gap-2 rounded-lg border border-warning-border bg-warning-light px-3 py-1.5 text-xs text-yellow-900" data-testid="photo-autofill-confirm-pending">
          <AppIcon name="alert" className="w-4 h-4" aria-hidden="true" />
          <span>Aplicar com {pluralize(pendingConflicts.length, 'divergência sem confirmar', 'divergências sem confirmar')}? Elas seguem com a torre da etiqueta.</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirmPending(false)}>Voltar</Button>
          <Button size="sm" variant="primary" onClick={handleApply}>Aplicar mesmo assim</Button>
        </span>
      ) : null}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Preencher vistoria pelas fotos"
      subtitle={projectLabel}
      icon="camera"
      size="2xl"
      footer={footer}
    >
      {stage === 'pick' ? renderPick() : null}
      {stage === 'analyzing' ? renderAnalyzing() : null}
      {stage === 'review' && analysis && decisions ? renderReview() : null}
    </Modal>
  );
}

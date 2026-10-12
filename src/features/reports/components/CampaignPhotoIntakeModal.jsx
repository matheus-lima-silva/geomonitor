import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Checkbox, HintText, Input, Modal, Select, Skeleton } from '../../../components/ui';
import { readExifMetaFromFile } from '../../../utils/photoCampaign/exifMeta';
import {
  GAP_DAY_REASONS,
  analyzePhotoCampaign,
  buildDefaultDecisions,
  mergeAnalysisIntoForm,
} from '../../../utils/photoCampaign/photoCampaignAnalysis';
import { toBrDate } from '../utils/inspectionWorkflow';

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

function fileKey(file) {
  return `${file?.webkitRelativePath || file?.name || 'foto'}|${file?.size || 0}|${file?.lastModified || 0}`;
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

export default function InspectionPhotoAutofillModal({
  open,
  project,
  currentForm,
  feriadosIndex,
  onCancel,
  onApply,
  readExifMeta = readExifMetaFromFile,
}) {
  const [stage, setStage] = useState('pick');
  const [files, setFiles] = useState([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [analysis, setAnalysis] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  const [showInfoDivergences, setShowInfoDivergences] = useState(false);
  const [confirmedStack, setConfirmedStack] = useState([]);
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
    setAnalysis(null);
    setDecisions(null);
    setExpandedDays(new Set());
    setShowInfoDivergences(false);
    setConfirmedStack([]);
    setConfirmPending(false);
    return undefined;
  }, [open]);

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
    setAnalysis(result);
    setDecisions(buildDefaultDecisions(result));
    setExpandedDays(new Set(result.days.slice(0, 1).map((day) => day.data)));
    setConfirmedStack([]);
    setConfirmPending(false);
    setStage('review');
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
    setConfirmedStack((prev) => [...prev, id]);
  }

  function undoLastConfirmation() {
    const last = confirmedStack[confirmedStack.length - 1];
    if (!last) return;
    updateDivergenceDecision(last, { status: 'pending' });
    setConfirmedStack((prev) => prev.slice(0, -1));
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

  function handleApply() {
    if (!analysis || !decisions) return;
    if (pendingConflicts.length > 0 && !confirmPending) {
      setConfirmPending(true);
      return;
    }
    onApply?.({ analysis, decisions });
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
        <div className="flex items-center justify-end gap-2">
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
    if (!conflictDivergences.length && !infoDivergences.length) return null;
    const lastConfirmed = resolvedConflicts[resolvedConflicts.length - 1];
    const hasPanel = pendingConflicts.length > 0;
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
                <>
                  <Badge tone="ok">{resolvedConflicts.length} resolvida{resolvedConflicts.length > 1 ? 's' : ''}{lastConfirmed ? ` · ${lastConfirmed.numero} → ${decisions.divergences[lastConfirmed.id]?.numero}` : ''}</Badge>
                  <Button size="sm" variant="ghost" onClick={undoLastConfirmation} aria-label="Desfazer a última confirmação">
                    <AppIcon name="undo" className="w-4 h-4" aria-hidden="true" />
                    Desfazer
                  </Button>
                </>
              ) : null}
              <Badge tone="warning">{pendingConflicts.length} pendente{pendingConflicts.length > 1 ? 's' : ''}</Badge>
            </div>
            {pendingConflicts.map(renderConflictRow)}
          </div>
        ) : resolvedConflicts.length > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-success-border bg-success-light px-3 py-2 text-sm text-green-800" data-testid="photo-autofill-divergences-resolved">
            <AppIcon name="check-circle-2" className="w-4 h-4" aria-hidden="true" />
            <span className="flex-1">Divergências resolvidas: {resolvedConflicts.map((d) => `${d.numero} → ${decisions.divergences[d.id]?.numero}`).join(', ')}.</span>
            <Button size="sm" variant="ghost" onClick={undoLastConfirmation} aria-label="Desfazer a última confirmação">
              <AppIcon name="undo" className="w-4 h-4" aria-hidden="true" />
              Desfazer
            </Button>
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
                  <li key={d.id} className="flex items-start gap-2">
                    <span className="font-mono font-semibold text-slate-800">{d.numero}</span>
                    <span>{toBrDate(d.date)} · {d.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  function renderTowerRow(day, group) {
    const decision = decisions.towers[group.key] || { include: group.defaultIncluded, numero: group.numero };
    const badge = towerBadge(group);
    const alreadyInDiary = existingTowersByDate.get(day.data)?.has(group.numero);
    return (
      <div key={group.key} className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 px-3 py-1.5 text-sm" data-testid="photo-autofill-tower">
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
        <span className="flex-1 text-slate-600">{pluralize(group.count, 'foto', 'fotos')}</span>
        {alreadyInDiary ? <Badge tone="neutral">Já no diário</Badge> : null}
        <Badge tone={badge.tone}>{badge.text}</Badge>
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
        </div>

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
        <span className="text-xs text-slate-500">Clima, hotel e observações não são alterados. Nada é salvo até você salvar a vistoria.</span>
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
          <Button variant="primary" onClick={handleApply} disabled={includedCount === 0}>
            <AppIcon name="check" className="w-4 h-4" aria-hidden="true" />
            Aplicar ao diário — {pluralize(includedCount, 'torre', 'torres')} em {pluralize(daysWithIncluded, 'dia', 'dias')}
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

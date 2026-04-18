import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import useCompoundDraftAutoSave from '../hooks/useCompoundDraftAutoSave';
import StepCabecalho from './compound-wizard/StepCabecalho';
import StepTextos from './compound-wizard/StepTextos';
import StepWorkspaces from './compound-wizard/StepWorkspaces';
import StepAssinaturas from './compound-wizard/StepAssinaturas';
import StepRevisao from './compound-wizard/StepRevisao';
import {
  DEFAULT_DRAFT,
  WIZARD_STEPS,
  getMissingRequired,
  isStepComplete,
} from './compound-wizard/wizardConstants';

// Hidrata um draft a partir de um compound existente (modo edit).
// As assinaturas em sharedTextsJson sao snapshots { nome, profissao, registro };
// precisamos reverte-los para IDs via match por nome nos signatariosCandidatos.
function draftFromCompound(compound, signatariosCandidatos = []) {
  if (!compound) return { ...DEFAULT_DRAFT };
  const shared = compound.sharedTextsJson || {};
  const snapshotToId = (snap) => {
    if (!snap) return null;
    if (typeof snap === 'string') return snap;
    const match = signatariosCandidatos.find((s) => s.nome === snap.nome);
    return match?.id || null;
  };
  const elaboradoresIds = (Array.isArray(shared.elaboradores) ? shared.elaboradores : [])
    .map(snapshotToId)
    .filter(Boolean);
  const revisoresIds = (Array.isArray(shared.revisores) ? shared.revisores : [])
    .map(snapshotToId)
    .filter(Boolean);
  return {
    nome: compound.nome || '',
    revisao: shared.revisao || '00',
    nome_lt: shared.nome_lt || '',
    titulo_programa: shared.titulo_programa || '',
    codigo_documento: shared.codigo_documento || '',
    introducao: shared.introducao || '',
    geologia: shared.geologia || '',
    geotecnia: shared.geotecnia || '',
    geomorfologia: shared.geomorfologia || '',
    descricao_atividades: shared.descricao_atividades || '',
    conclusoes: shared.conclusoes || '',
    analise_evolucao: shared.analise_evolucao || '',
    observacoes: shared.observacoes || '',
    elaboradores: elaboradoresIds,
    revisores: revisoresIds,
    includeTowerCoordinates: !!shared.includeTowerCoordinates,
    towerCoordinateFormat: shared.towerCoordinateFormat || 'decimal',
  };
}

function stepBubbleClass(state) {
  if (state === 'complete') return 'bg-success text-white border-success';
  if (state === 'warning') return 'bg-amber-100 text-amber-700 border-amber-300';
  if (state === 'current') return 'bg-brand-600 text-white border-brand-600';
  return 'bg-white text-slate-500 border-slate-300';
}

export default function CompoundWizard({
  mode: initialMode = 'create',
  initialCompound = null,
  compounds = [],
  signatariosCandidatos = [],
  profissoes = [],
  workspaces = [],
  workspaceLabelsById = new Map(),
  compoundWorkspaceSelections,
  setCompoundWorkspaceSelections,
  onAddWorkspace,
  onRemoveWorkspace,
  onReorder,
  onCreate,
  onUpdate,
  onClose,
  onOpenCompound,
  userEmail = '',
  busy = null,
  showToast = () => {},
}) {
  const [mode, setMode] = useState(initialMode);
  const [compound, setCompound] = useState(initialCompound);
  const [draft, setDraft] = useState(() => draftFromCompound(initialCompound, signatariosCandidatos));
  const [stepIndex, setStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState({ cabecalho: true });
  const [switchTargetId, setSwitchTargetId] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(null);
  const [restorePromptChecked, setRestorePromptChecked] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const enableAutoSave = mode === 'create';
  const { status: autoSaveStatus, savedAt, loadSaved, clearSaved } = useCompoundDraftAutoSave(
    draft,
    { userEmail, enabled: enableAutoSave },
  );

  // Oferece recuperar rascunho apenas uma vez, ao entrar em modo create com storage.
  useEffect(() => {
    if (restorePromptChecked) return;
    setRestorePromptChecked(true);
    if (mode !== 'create') return;
    const saved = loadSaved();
    if (saved?.draft && String(saved.draft.nome || '').trim()) {
      setPendingRestore(saved);
    }
  }, [loadSaved, mode, restorePromptChecked]);

  const currentStep = WIZARD_STEPS[stepIndex];
  const missingRequired = useMemo(() => getMissingRequired(draft), [draft]);

  function goToStepById(stepId) {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    setStepIndex(idx);
    setVisitedSteps((prev) => ({ ...prev, [stepId]: true }));
  }

  function goToStepIndex(idx) {
    if (idx < 0 || idx >= WIZARD_STEPS.length) return;
    setStepIndex(idx);
    const target = WIZARD_STEPS[idx];
    if (target) setVisitedSteps((prev) => ({ ...prev, [target.id]: true }));
  }

  async function handleSubmit() {
    if (missingRequired.length > 0) {
      showToast(
        `Preencha os obrigatórios: ${missingRequired.map((f) => f.label).join(', ')}`,
        'error',
      );
      const firstStepId = missingRequired[0].stepId;
      goToStepById(firstStepId);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'edit' && compound?.id) {
        await onUpdate?.(compound, draft);
      } else {
        await onCreate?.(draft);
        clearSaved();
      }
      onClose?.();
    } catch (error) {
      // onCreate/onUpdate ja faz showToast, so precisa impedir o close.
    } finally {
      setSubmitting(false);
    }
  }

  function handleSwitchCompound(targetId) {
    if (!targetId || (compound && targetId === compound.id)) return;
    setSwitchTargetId(targetId);
    const target = compounds.find((c) => c.id === targetId);
    if (!target) return;
    // Se o usuario tem texto novo no draft (modo create), perguntar antes.
    if (mode === 'create' && String(draft.nome || '').trim()) {
      setConfirmSwitch(target);
      return;
    }
    openCompound(target);
  }

  function openCompound(target) {
    if (onOpenCompound) {
      onOpenCompound(target);
      return;
    }
    setMode('edit');
    setCompound(target);
    setDraft(draftFromCompound(target, signatariosCandidatos));
    setStepIndex(0);
    setVisitedSteps({ cabecalho: true });
    setSwitchTargetId('');
    setConfirmSwitch(null);
  }

  function renderStepBubbleState(stepId, idx) {
    if (idx === stepIndex) return 'current';
    if (visitedSteps[stepId]) {
      return isStepComplete(stepId, draft) ? 'complete' : 'warning';
    }
    return 'pending';
  }

  const advanceMissing = currentStep
    ? getMissingRequired(draft).filter((f) => f.stepId === currentStep.id)
    : [];

  const otherCompounds = compounds.filter((c) => !c.deletedAt && c.id !== compound?.id);

  return (
    <Card variant="nested" className="flex flex-col gap-5">
      {/* Header do wizard */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <AppIcon name={mode === 'edit' ? 'edit' : 'plus'} className="text-brand-600" />
          <div>
            <h2 className="m-0 text-sm font-bold text-slate-800">
              {mode === 'edit'
                ? `Editando: ${compound?.nome || compound?.id || ''}`
                : 'Criar novo relatório'}
            </h2>
            {enableAutoSave ? (
              <p className="m-0 text-2xs text-slate-500" data-testid="autosave-indicator">
                {autoSaveStatus === 'saving' ? 'Salvando rascunho...' : null}
                {autoSaveStatus === 'saved' && savedAt
                  ? `Rascunho salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : null}
                {autoSaveStatus === 'idle' ? 'Rascunho local ativo' : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {otherCompounds.length > 0 ? (
            <div className="w-64">
              <SearchableSelect
                id="wizard-open-other"
                value={switchTargetId}
                onChange={handleSwitchCompound}
                options={otherCompounds.map((c) => ({
                  value: c.id,
                  label: c.nome || c.id,
                }))}
                placeholder="Abrir outro relatório..."
              />
            </div>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <AppIcon name="close" /> Fechar
          </Button>
        </div>
      </div>

      {/* Barra de progresso (bolinhas clicaveis) */}
      <ol className="flex flex-wrap items-center gap-3" aria-label="Etapas do wizard">
        {WIZARD_STEPS.map((step, idx) => {
          const state = renderStepBubbleState(step.id, idx);
          return (
            <li key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${stepBubbleClass(state)}`}
                onClick={() => goToStepIndex(idx)}
                aria-current={idx === stepIndex ? 'step' : undefined}
                data-testid={`wizard-step-bubble-${step.id}`}
                data-state={state}
              >
                {state === 'warning' ? <AppIcon name="alert" size={12} /> : idx + 1}
              </button>
              <span className={`text-xs ${idx === stepIndex ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                {step.label}
              </span>
              {idx < WIZARD_STEPS.length - 1 ? (
                <span className="h-px w-6 bg-slate-200" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Corpo do step atual */}
      <div className="min-h-40">
        {currentStep?.id === 'cabecalho' ? (
          <StepCabecalho
            draft={draft}
            onChange={setDraft}
            missingRequired={missingRequired}
          />
        ) : null}
        {currentStep?.id === 'textos' ? (
          <StepTextos draft={draft} onChange={setDraft} />
        ) : null}
        {currentStep?.id === 'workspaces' ? (
          <StepWorkspaces
            mode={mode}
            compound={compound}
            workspaces={workspaces}
            workspaceLabelsById={workspaceLabelsById}
            compoundWorkspaceSelections={compoundWorkspaceSelections}
            setCompoundWorkspaceSelections={setCompoundWorkspaceSelections}
            onAddWorkspace={onAddWorkspace}
            onRemoveWorkspace={onRemoveWorkspace}
            onReorder={onReorder}
            busy={busy}
          />
        ) : null}
        {currentStep?.id === 'assinaturas' ? (
          <StepAssinaturas
            draft={draft}
            onChange={setDraft}
            signatariosCandidatos={signatariosCandidatos}
            profissoes={profissoes}
          />
        ) : null}
        {currentStep?.id === 'revisao' ? (
          <StepRevisao
            draft={draft}
            mode={mode}
            missingRequired={missingRequired}
            onJumpToStep={goToStepById}
            signatariosCandidatos={signatariosCandidatos}
            workspaceLabelsById={workspaceLabelsById}
            compound={compound}
          />
        ) : null}
      </div>

      {/* Aviso nao-bloqueante ao tentar avancar com obrigatorio vazio */}
      {advanceMissing.length > 0 && stepIndex < WIZARD_STEPS.length - 1 ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          data-testid="wizard-advance-warning"
        >
          <AppIcon name="alert" size={12} className="mr-1 text-amber-600" />
          Faltam: <strong>{advanceMissing.map((f) => f.label).join(', ')}</strong>. Você pode
          continuar e voltar depois.
        </div>
      ) : null}

      {/* Footer: voltar / avancar / criar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <Button
          variant="outline"
          onClick={() => goToStepIndex(stepIndex - 1)}
          disabled={stepIndex === 0}
        >
          <AppIcon name="chevron-left" /> Voltar
        </Button>

        {stepIndex < WIZARD_STEPS.length - 1 ? (
          <Button onClick={() => goToStepIndex(stepIndex + 1)} data-testid="wizard-advance">
            Avançar <AppIcon name="chevron-right" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || missingRequired.length > 0}
            data-testid="wizard-submit"
          >
            <AppIcon name="save" />
            {submitting
              ? 'Salvando...'
              : mode === 'edit' ? 'Salvar alterações' : 'Criar Relatório'}
          </Button>
        )}
      </div>

      {/* Modal: confirmar troca de relatorio com draft pendente */}
      <Modal
        open={Boolean(confirmSwitch)}
        onClose={() => setConfirmSwitch(null)}
        title="Descartar rascunho?"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => { setConfirmSwitch(null); setSwitchTargetId(''); }}>
              Cancelar
            </Button>
            <Button onClick={() => openCompound(confirmSwitch)}>
              Descartar e abrir
            </Button>
          </>
        )}
      >
        <p className="m-0 text-sm text-slate-700">
          Você tem um rascunho em andamento. Abrir <strong>{confirmSwitch?.nome || confirmSwitch?.id}</strong>{' '}
          irá descartá-lo.
        </p>
      </Modal>

      {/* Modal: recuperar rascunho salvo */}
      <Modal
        open={Boolean(pendingRestore)}
        onClose={() => { clearSaved(); setPendingRestore(null); }}
        title="Recuperar rascunho anterior?"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => { clearSaved(); setPendingRestore(null); }}>
              Começar do zero
            </Button>
            <Button
              onClick={() => {
                if (pendingRestore?.draft) setDraft({ ...DEFAULT_DRAFT, ...pendingRestore.draft });
                setPendingRestore(null);
              }}
            >
              Continuar
            </Button>
          </>
        )}
      >
        <p className="m-0 text-sm text-slate-700">
          Encontramos um rascunho salvo localmente
          {pendingRestore?.savedAt
            ? ` em ${new Date(pendingRestore.savedAt).toLocaleString('pt-BR')}`
            : ''}
          . Deseja continuar de onde parou?
        </p>
      </Modal>
    </Card>
  );
}

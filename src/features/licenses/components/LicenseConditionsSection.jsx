import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import {
  Badge,
  Button,
  ConfirmDeleteModal,
  IconButton,
  Input,
  Select,
  Textarea,
} from '../../../components/ui';
import { MONTH_OPTIONS_PT } from '../../projects/utils/reportSchedule';
import {
  bulkReplaceConditions,
  createCondition,
  deleteCondition,
  listConditions,
  updateCondition,
} from '../services/licenseConditionService';

// Dois modos:
//   - Autonomo (licenseId truthy): cada add/edit/remove bate na API direto
//   - Draft   (licenseId vazio): buffer local; parent chama `persistConditions`
//     apos o save da LO (usado so na cria\u00e7\u00e3o de LO nova).
// Feedback imediato via toast. Confirma delete via ConfirmDeleteModal.

const TIPO_OPTIONS = [
  { value: 'processos_erosivos', label: 'Processos erosivos', tone: 'critical' },
  { value: 'prad', label: 'PRAD', tone: 'warning' },
  { value: 'supressao', label: 'Supressao', tone: 'warning' },
  { value: 'fauna', label: 'Fauna', tone: 'neutral' },
  { value: 'emergencia', label: 'Emergencia', tone: 'danger' },
  { value: 'comunicacao', label: 'Comunicacao', tone: 'neutral' },
  { value: 'compensacao', label: 'Compensacao', tone: 'neutral' },
  { value: 'geral', label: 'Geral', tone: 'neutral' },
  { value: 'outro', label: 'Outro', tone: 'neutral' },
];

const PERIODICITY_OPTIONS = ['', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'];

function toneForTipo(tipo) {
  return TIPO_OPTIONS.find((t) => t.value === tipo)?.tone || 'neutral';
}

function labelForTipo(tipo) {
  return TIPO_OPTIONS.find((t) => t.value === tipo)?.label || 'Geral';
}

function emptyDraft() {
  return {
    id: '',
    numero: '',
    titulo: '',
    texto: '',
    tipo: 'geral',
    prazo: '',
    periodicidadeRelatorio: '',
    mesesEntrega: [],
    parecerTecnicoRef: '',
  };
}

function validateDraft(draft) {
  const numero = String(draft.numero || '').trim();
  const texto = String(draft.texto || '').trim();
  if (!numero) return 'Informe o numero (ex.: 2.1).';
  if (!texto || texto.length < 20) return 'Texto da condicionante e obrigatorio (min 20 caracteres).';
  return '';
}

// ---------------------------------------------------------------------------
// Editor inline (usado para criar novo ou editar existente)
// ---------------------------------------------------------------------------
function ConditionEditor({ draft, onDraftChange, onCancel, onSubmit, busy }) {
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(
    draft.titulo || draft.prazo || draft.periodicidadeRelatorio
    || (draft.mesesEntrega && draft.mesesEntrega.length)
    || draft.parecerTecnicoRef,
  ));

  function toggleMes(month) {
    const set = new Set(draft.mesesEntrega || []);
    if (set.has(month)) set.delete(month); else set.add(month);
    onDraftChange({ ...draft, mesesEntrega: [...set].sort((a, b) => a - b) });
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3 bg-slate-50 border-t border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-[8rem_12rem_1fr] gap-3">
        <Input
          label="Numero"
          placeholder="Ex.: 2.1"
          value={draft.numero}
          onChange={(e) => onDraftChange({ ...draft, numero: e.target.value })}
          disabled={busy}
        />
        <Select
          label="Tipo"
          value={draft.tipo}
          onChange={(e) => onDraftChange({ ...draft, tipo: e.target.value })}
          disabled={busy}
        >
          {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <div className="md:row-start-2 md:col-span-3">
          <Textarea
            label="Texto"
            rows={4}
            value={draft.texto}
            onChange={(e) => onDraftChange({ ...draft, texto: e.target.value })}
            disabled={busy}
            placeholder="Texto literal da condicionante"
          />
        </div>
      </div>

      <details
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
        className="text-sm"
      >
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700 select-none">
          Mais campos
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Input
            label="Titulo (opcional)"
            value={draft.titulo || ''}
            onChange={(e) => onDraftChange({ ...draft, titulo: e.target.value })}
            disabled={busy}
          />
          <Input
            label="Prazo"
            placeholder="Ex.: 180 dias, durante vigencia"
            value={draft.prazo || ''}
            onChange={(e) => onDraftChange({ ...draft, prazo: e.target.value })}
            disabled={busy}
          />
          <Select
            label="Periodicidade do relatorio"
            value={draft.periodicidadeRelatorio || ''}
            onChange={(e) => onDraftChange({ ...draft, periodicidadeRelatorio: e.target.value })}
            disabled={busy}
          >
            {PERIODICITY_OPTIONS.map((p) => <option key={p || 'none'} value={p}>{p || '- (nao informada)'}</option>)}
          </Select>
          <Input
            label="Parecer tecnico de referencia"
            placeholder="Ex.: PT 151015/CEE/SUIMIS/2021"
            value={draft.parecerTecnicoRef || ''}
            onChange={(e) => onDraftChange({ ...draft, parecerTecnicoRef: e.target.value })}
            disabled={busy}
          />
          <div className="md:col-span-2">
            <label className="text-2xs font-bold uppercase tracking-wide text-slate-500 mb-1 block">
              Meses de entrega
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MONTH_OPTIONS_PT.map((m) => {
                const selected = (draft.mesesEntrega || []).includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleMes(m.value)}
                    className={`px-2 py-1 rounded-full text-2xs font-semibold border transition-colors ${selected ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400 hover:text-brand-600'} disabled:opacity-50`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </details>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          <AppIcon name="close" />
          Cancelar
        </Button>
        <Button variant="primary" size="sm" onClick={onSubmit} disabled={busy}>
          <AppIcon name="save" />
          {busy ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item de lista (compacto)
// ---------------------------------------------------------------------------
function ConditionRow({ item, onEdit, onRemove, saving }) {
  const numero = item.numero || '-';
  const tipo = item.tipo || 'geral';
  return (
    <li
      className={`flex items-start gap-3 px-3 py-2 border-b border-slate-100 last:border-b-0 ${saving ? 'animate-pulse bg-slate-50' : ''}`}
    >
      <span className="shrink-0 inline-flex items-center justify-center min-w-[3rem] h-6 px-2 rounded bg-slate-100 text-slate-700 text-xs font-bold font-mono tabular-nums">
        {numero}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={toneForTipo(tipo)} size="sm">{labelForTipo(tipo)}</Badge>
          {item.titulo && <span className="text-xs text-slate-500 truncate">{item.titulo}</span>}
        </div>
        <p className="text-sm text-slate-700 m-0 mt-1 line-clamp-2">{item.texto || '(sem texto)'}</p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
          aria-label={`Editar condicionante ${numero}`}
          disabled={saving}
        >
          <AppIcon name="edit" />
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item)}
          aria-label={`Remover condicionante ${numero}`}
          disabled={saving}
          className="text-slate-400 hover:text-danger hover:bg-danger-light"
        >
          <AppIcon name="trash" />
        </IconButton>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
function LicenseConditionsSection({ licenseId, onChange, showToast }) {
  const isAutonomous = useMemo(() => Boolean(String(licenseId || '').trim()), [licenseId]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);       // id do item em edicao, 'new' para novo
  const [draft, setDraft] = useState(null);                // valores do form
  const [busyId, setBusyId] = useState(null);              // id do item em operacao
  const [confirmRemove, setConfirmRemove] = useState(null);
  const lastEmittedRef = useRef(null);

  // Emite onChange quando a lista muda, sem repetir o mesmo snapshot em loop
  useEffect(() => {
    const snapshot = JSON.stringify(items);
    if (lastEmittedRef.current === snapshot) return;
    lastEmittedRef.current = snapshot;
    onChange?.(items);
  }, [items, onChange]);

  useEffect(() => {
    let cancelled = false;
    if (!isAutonomous) {
      setItems([]);
      return undefined;
    }
    setLoading(true);
    listConditions(licenseId)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch((err) => { if (!cancelled) showToast?.(err?.message || 'Erro ao carregar condicionantes.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [licenseId, isAutonomous, showToast]);

  const openCreate = useCallback(() => {
    setDraft(emptyDraft());
    setEditingId('new');
  }, []);

  const openEdit = useCallback((item) => {
    setDraft({ ...emptyDraft(), ...item });
    setEditingId(item.id || 'new');
  }, []);

  const closeEditor = useCallback(() => {
    setDraft(null);
    setEditingId(null);
  }, []);

  // Salvar (modo autonomo OU draft)
  const submitDraft = useCallback(async () => {
    if (!draft) return;
    const errMsg = validateDraft(draft);
    if (errMsg) {
      showToast?.(errMsg, 'error');
      return;
    }
    const isNew = editingId === 'new';

    // Checa duplicata por numero no cliente antes do POST (evita UPSERT silencioso)
    if (isNew && isAutonomous) {
      const dup = items.find((it) => String(it.numero).trim() === String(draft.numero).trim());
      if (dup) {
        showToast?.(`Ja existe condicionante ${draft.numero} nesta LO. Edite a existente.`, 'error');
        return;
      }
    }

    if (!isAutonomous) {
      // Modo draft: apenas atualiza a lista local
      setItems((prev) => {
        if (isNew) return [...prev, { ...draft, id: draft.id || `draft-${Date.now()}` }];
        return prev.map((it) => (it.id === draft.id ? { ...it, ...draft } : it));
      });
      closeEditor();
      return;
    }

    setBusyId(isNew ? 'new' : draft.id);
    try {
      const saved = isNew
        ? await createCondition(licenseId, { ...draft, id: undefined })
        : await updateCondition({ id: draft.id }, draft);
      setItems((prev) => {
        if (isNew) return [...prev, saved];
        return prev.map((it) => (it.id === saved.id ? saved : it));
      });
      closeEditor();
      showToast?.(isNew ? 'Condicionante adicionada.' : 'Condicionante atualizada.', 'success');
    } catch (err) {
      showToast?.(err?.message || 'Falha ao salvar condicionante.', 'error');
    } finally {
      setBusyId(null);
    }
  }, [draft, editingId, isAutonomous, items, licenseId, showToast, closeEditor]);

  // Delete (com confirmacao)
  const confirmDelete = useCallback(async () => {
    if (!confirmRemove) return;
    const item = confirmRemove;
    setConfirmRemove(null);
    if (!isAutonomous) {
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      return;
    }
    setBusyId(item.id);
    try {
      await deleteCondition({ id: item.id });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      showToast?.('Condicionante removida.', 'success');
    } catch (err) {
      showToast?.(err?.message || 'Falha ao remover condicionante.', 'error');
    } finally {
      setBusyId(null);
    }
  }, [confirmRemove, isAutonomous, showToast]);

  const editingNew = editingId === 'new';

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div>
          <h4 className="text-sm font-bold text-slate-800 m-0">Condicionantes</h4>
          <p className="text-2xs text-slate-500 m-0">
            {isAutonomous
              ? (loading ? 'Carregando...' : `${items.length} item(s)`)
              : 'Sera salva junto com a LO'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openCreate} disabled={editingId !== null}>
          <AppIcon name="plus" />
          Adicionar
        </Button>
      </header>

      {items.length === 0 && !loading && !editingNew && (
        <div className="px-3 py-6 text-center text-xs text-slate-500">
          Nenhuma condicionante cadastrada.
        </div>
      )}

      <ul className="flex flex-col m-0 p-0">
        {items.map((item) => {
          if (editingId === item.id) {
            return (
              <li key={item.id} className="border-b border-slate-100 last:border-b-0">
                <ConditionEditor
                  draft={draft}
                  onDraftChange={setDraft}
                  onCancel={closeEditor}
                  onSubmit={submitDraft}
                  busy={busyId === item.id}
                />
              </li>
            );
          }
          return (
            <ConditionRow
              key={item.id}
              item={item}
              onEdit={openEdit}
              onRemove={setConfirmRemove}
              saving={busyId === item.id}
            />
          );
        })}
        {editingNew && (
          <li className="border-b border-slate-100 last:border-b-0">
            <ConditionEditor
              draft={draft}
              onDraftChange={setDraft}
              onCancel={closeEditor}
              onSubmit={submitDraft}
              busy={busyId === 'new'}
            />
          </li>
        )}
      </ul>

      <ConfirmDeleteModal
        open={Boolean(confirmRemove)}
        itemName="a condicionante"
        itemId={confirmRemove?.numero || confirmRemove?.id}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}

/**
 * Helper para o fluxo de criacao de LO nova (modo draft): depois que o parent
 * criar a LO e souber o id, chama este helper com os items em buffer para
 * persistir via bulkReplace. Ignora itens invalidos (sem numero/texto).
 */
export async function persistConditions(licenseId, items) {
  const valid = (items || []).filter((c) => String(c?.numero || '').trim() && String(c?.texto || '').trim());
  if (!licenseId) return [];
  return bulkReplaceConditions(licenseId, valid);
}

export default LicenseConditionsSection;

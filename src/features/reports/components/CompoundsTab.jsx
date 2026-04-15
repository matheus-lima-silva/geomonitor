import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select, Textarea } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import {
  buildCompoundWorkspaceOrder,
  fmt,
  formatSignatarioRegistro,
  buildSignatarySnapshot,
  getTranslatedStatus,
  isPendingExecutionStatus,
  getStatusLabel,
  tone,
} from '../utils/reportUtils';

const TEXT_SECTIONS_PRE = [
  ['introducao', '1. Introducao', 'Contexto e objetivo do relatorio.'],
];

const CARACTERIZACAO_SUBTOPICOS = [
  ['geologia', 'Geologia', 'Aspectos geologicos relevantes da area da LT.'],
  ['geotecnia', 'Geotecnia', 'Caracteristicas geotecnicas dos solos e macios.'],
  ['geomorfologia', 'Geomorfologia', 'Formas de relevo e processos morfologicos da regiao.'],
];

const TEXT_SECTIONS_POST = [
  ['descricao_atividades', '3. Descricao das Atividades', 'Metodologia e atividades realizadas na vistoria.'],
  ['conclusoes', '5. Conclusoes e Recomendacoes', 'Diagnostico por torre e recomendacoes tecnicas.'],
  ['analise_evolucao', '6. Analise da Evolucao dos Processos Erosivos', 'Comparativo com relatorios anteriores.'],
  ['observacoes', '7. Consideracoes Finais', 'Texto de encerramento e consideracoes gerais.'],
];

export default function CompoundsTab({
  compoundDraft,
  setCompoundDraft,
  profissoes,
  signatariosCandidatos,
  compounds,
  workspaces,
  workspaceLabelsById,
  compoundWorkspaceSelections,
  setCompoundWorkspaceSelections,
  compoundPreflights,
  busy,
  handleCreateCompound,
  handleCompoundAddWorkspace,
  handleCompoundRemoveWorkspace,
  handleCompoundReorder,
  handleCompoundPreflight,
  handleCompoundGenerate,
  handleTrashCompound,
  handleRestoreCompound,
  handleHardDeleteCompound,
  handleDownloadReportOutput,
  buildCompoundDownloadFileName,
  handleUpdateCompoundSignatures,
}) {
  const [openSections, setOpenSections] = useState({});
  const [openPreflights, setOpenPreflights] = useState({});
  const [confirmGenerate, setConfirmGenerate] = useState(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState(null);
  const [confirmGenerateWithCoords, setConfirmGenerateWithCoords] = useState(null);
  const [coordFormatDraft, setCoordFormatDraft] = useState('decimal');
  const [showTrash, setShowTrash] = useState(false);
  const [editingSignaturesFor, setEditingSignaturesFor] = useState(null);
  const [editSignatures, setEditSignatures] = useState({ elaboradores: [], revisores: [] });

  function openGenerateWithCoords(compound) {
    const shared = compound?.sharedTextsJson || {};
    setCoordFormatDraft(shared.towerCoordinateFormat || 'decimal');
    setConfirmGenerateWithCoords(compound);
  }

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function togglePreflight(id) {
    setOpenPreflights((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function moveSignatario(role, sigId, direction) {
    setCompoundDraft((prev) => {
      const arr = [...(prev[role] || [])];
      const idx = arr.indexOf(sigId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, [role]: arr };
    });
  }

  function moveEditSignatario(role, sigId, direction) {
    setEditSignatures((prev) => {
      const arr = [...(prev[role] || [])];
      const idx = arr.indexOf(sigId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, [role]: arr };
    });
  }

  function startEditingSignatures(compound) {
    const shared = compound.sharedTextsJson || {};
    const existingElab = Array.isArray(shared.elaboradores) ? shared.elaboradores : [];
    const existingRev = Array.isArray(shared.revisores) ? shared.revisores : [];
    const elabArr = existingElab.map((snap) => signatariosCandidatos.find((s) => s.nome === snap.nome)?.id).filter(Boolean);
    const revArr = existingRev.map((snap) => signatariosCandidatos.find((s) => s.nome === snap.nome)?.id).filter(Boolean);
    setEditSignatures({ elaboradores: elabArr, revisores: revArr });
    setEditingSignaturesFor(compound.id);
  }

  async function saveEditedSignatures(compound) {
    const profLookup = Object.fromEntries(profissoes.map((p) => [p.id, p.nome]));
    const elaboradoresArr = (editSignatures.elaboradores || []).map((id) => {
      const sig = signatariosCandidatos.find((s) => s.id === id);
      return buildSignatarySnapshot(sig, profLookup);
    }).filter(Boolean);
    const revisoresArr = (editSignatures.revisores || []).map((id) => {
      const sig = signatariosCandidatos.find((s) => s.id === id);
      return buildSignatarySnapshot(sig, profLookup);
    }).filter(Boolean);
    await handleUpdateCompoundSignatures(compound, elaboradoresArr, revisoresArr);
    setEditingSignaturesFor(null);
  }

  return (
    <>
      {/* Formulario de criacao */}
      <Card variant="nested" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <AppIcon name="plus" />
          <span>Criar Relatorio Composto</span>
        </div>

        {/* Campos basicos */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="compound-name"
            label="Nome do relatorio"
            value={compoundDraft.nome}
            onChange={(event) => setCompoundDraft((prev) => ({ ...prev, nome: event.target.value }))}
            placeholder="Ex: Consolidado trimestral"
            hint="Identificador interno do relatorio composto."
          />
          <Input
            id="compound-revisao"
            label="Revisao"
            value={compoundDraft.revisao}
            onChange={(event) => setCompoundDraft((prev) => ({ ...prev, revisao: event.target.value }))}
            placeholder="Ex: 00"
            hint="Numero de revisao do documento."
          />
        </div>

        {/* Cabecalho do documento */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Cabecalho do documento</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="compound-nome-lt"
              label="Nome da LT"
              value={compoundDraft.nome_lt}
              onChange={(event) => setCompoundDraft((prev) => ({ ...prev, nome_lt: event.target.value }))}
              placeholder="Ex: LT 500 kV Cachoeira Paulista - Adrianopolis III"
              hint="Sera exibido no cabecalho de todas as paginas."
            />
            <Input
              id="compound-titulo-programa"
              label="Titulo do programa"
              value={compoundDraft.titulo_programa}
              onChange={(event) => setCompoundDraft((prev) => ({ ...prev, titulo_programa: event.target.value }))}
              placeholder="Ex: Programa de monitoramento de processos erosivos"
              hint="Subtitulo do relatorio exibido na capa e no cabecalho."
            />
            <Input
              id="compound-codigo-doc"
              label="Codigo do documento"
              value={compoundDraft.codigo_documento}
              onChange={(event) => setCompoundDraft((prev) => ({ ...prev, codigo_documento: event.target.value }))}
              placeholder="Ex: OOSEMB.RT.061.2026"
              hint="Numero do documento conforme sistema de gestao."
            />
          </div>
        </div>

        {/* Opcoes de fotos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Opcoes de fotos</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!compoundDraft.includeTowerCoordinates}
              onChange={(event) => setCompoundDraft((prev) => ({ ...prev, includeTowerCoordinates: event.target.checked }))}
            />
            <span>Incluir coordenada da torre antes das fotos</span>
          </label>
          {compoundDraft.includeTowerCoordinates ? (
            <div className="mt-3 max-w-sm">
              <Select
                id="compound-coord-format"
                label="Formato da coordenada"
                value={compoundDraft.towerCoordinateFormat || 'decimal'}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, towerCoordinateFormat: event.target.value }))}
              >
                <option value="decimal">Decimal (ex: -22.905556°, -43.199444°)</option>
                <option value="dms">Sexagesimal / GMS (ex: 22°54'20"S 43°11'58"W)</option>
                <option value="utm">UTM (ex: 686345E 7465123N 23S)</option>
              </Select>
              <HintText>
                Requer que o empreendimento do workspace tenha coordenadas de torres cadastradas (upload de KML).
              </HintText>
            </div>
          ) : null}
        </div>

        {/* Secoes de texto — accordion */}
        <div className="flex flex-col gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Secoes de texto</p>
          {TEXT_SECTIONS_PRE.map(([key, label, hint]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection(key)}
              >
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {compoundDraft[key]?.trim() ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-2xs font-medium text-emerald-700">Preenchido</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-500">Vazio</span>
                  )}
                  <AppIcon
                    name="chevron-right"
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${openSections[key] ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {openSections[key] ? (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <Textarea
                    id={`compound-${key}`}
                    label={hint}
                    rows={4}
                    value={compoundDraft[key]}
                    onChange={(event) => setCompoundDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </div>
              ) : null}
            </div>
          ))}

          {/* 2. Caracterizacao Tecnica — accordion com subtopicos */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              onClick={() => toggleSection('caracterizacao_tecnica')}
            >
              <span className="text-sm font-medium text-slate-700">2. Caracterizacao Tecnica</span>
              <div className="flex items-center gap-2 shrink-0">
                {CARACTERIZACAO_SUBTOPICOS.some(([k]) => compoundDraft[k]?.trim()) ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-2xs font-medium text-emerald-700">Preenchido</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-500">Vazio</span>
                )}
                <AppIcon
                  name="chevron-right"
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${openSections['caracterizacao_tecnica'] ? 'rotate-90' : ''}`}
                />
              </div>
            </button>
            {openSections['caracterizacao_tecnica'] ? (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 flex flex-col gap-4">
                {CARACTERIZACAO_SUBTOPICOS.map(([key, label, hint]) => (
                  <Textarea
                    key={key}
                    id={`compound-${key}`}
                    label={label}
                    hint={hint}
                    rows={4}
                    value={compoundDraft[key]}
                    onChange={(event) => setCompoundDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {TEXT_SECTIONS_POST.map(([key, label, hint]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection(key)}
              >
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {compoundDraft[key]?.trim() ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-2xs font-medium text-emerald-700">Preenchido</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-500">Vazio</span>
                  )}
                  <AppIcon
                    name="chevron-right"
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${openSections[key] ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {openSections[key] ? (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <Textarea
                    id={`compound-${key}`}
                    label={hint}
                    rows={4}
                    value={compoundDraft[key]}
                    onChange={(event) => setCompoundDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Assinaturas */}
        <div className="flex flex-col gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Assinaturas</p>
          {signatariosCandidatos.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
              {signatariosCandidatos.map((sig) => {
                const registro = formatSignatarioRegistro(sig);
                const profNome = profissoes.find((p) => p.id === sig.profissao_id)?.nome || sig.profissao_nome || '';
                const isElab = (compoundDraft.elaboradores || []).includes(sig.id);
                const isRev = (compoundDraft.revisores || []).includes(sig.id);
                return (
                  <div
                    key={sig.id}
                    className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${isElab || isRev ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-brand-600"
                          checked={isElab}
                          onChange={(e) => setCompoundDraft((prev) => ({
                            ...prev,
                            elaboradores: e.target.checked
                              ? [...(prev.elaboradores || []).filter((x) => x !== sig.id), sig.id]
                              : (prev.elaboradores || []).filter((x) => x !== sig.id),
                          }))}
                        />
                        Elaborador
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-brand-600"
                          checked={isRev}
                          onChange={(e) => setCompoundDraft((prev) => ({
                            ...prev,
                            revisores: e.target.checked
                              ? [...(prev.revisores || []).filter((x) => x !== sig.id), sig.id]
                              : (prev.revisores || []).filter((x) => x !== sig.id),
                          }))}
                        />
                        Revisor
                      </label>
                    </div>
                    <span className="flex-1 font-medium text-slate-800">{sig.nome}</span>
                    <span className="text-xs text-slate-500">{[profNome, registro].filter(Boolean).join(' – ')}</span>
                  </div>
                );
              })}

              {/* Ordem dos elaboradores */}
              {(compoundDraft.elaboradores || []).length >= 2 ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Ordem dos Elaboradores</p>
                  <div className="flex flex-col gap-1.5">
                    {(compoundDraft.elaboradores || []).map((sigId, index) => {
                      const sig = signatariosCandidatos.find((s) => s.id === sigId);
                      return (
                        <div key={sigId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-2xs font-bold text-slate-600">{index + 1}</span>
                            <span>{sig?.nome || sigId}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === 0} onClick={() => moveSignatario('elaboradores', sigId, 'up')} aria-label="Mover para cima">
                              <AppIcon name="chevron-left" size={12} className="-rotate-90" />
                            </button>
                            <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === (compoundDraft.elaboradores || []).length - 1} onClick={() => moveSignatario('elaboradores', sigId, 'down')} aria-label="Mover para baixo">
                              <AppIcon name="chevron-right" size={12} className="rotate-90" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Ordem dos revisores */}
              {(compoundDraft.revisores || []).length >= 2 ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Ordem dos Revisores</p>
                  <div className="flex flex-col gap-1.5">
                    {(compoundDraft.revisores || []).map((sigId, index) => {
                      const sig = signatariosCandidatos.find((s) => s.id === sigId);
                      return (
                        <div key={sigId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-2xs font-bold text-slate-600">{index + 1}</span>
                            <span>{sig?.nome || sigId}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === 0} onClick={() => moveSignatario('revisores', sigId, 'up')} aria-label="Mover para cima">
                              <AppIcon name="chevron-left" size={12} className="-rotate-90" />
                            </button>
                            <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === (compoundDraft.revisores || []).length - 1} onClick={() => moveSignatario('revisores', sigId, 'down')} aria-label="Mover para baixo">
                              <AppIcon name="chevron-right" size={12} className="rotate-90" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Nenhum signatario cadastrado. Adicione no seu perfil.</p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button onClick={handleCreateCompound} disabled={busy === 'compound'}>
            <AppIcon name="plus" />
            {busy === 'compound' ? 'Criando...' : 'Criar Relatorio Composto'}
          </Button>
        </div>
      </Card>

      {/* Lista de compostos */}
      <Card variant="nested" className="flex flex-col gap-3">
        <div className="text-sm font-bold text-slate-800">Relatorios compostos</div>
        {compounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum relatorio composto criado ainda.
          </div>
        ) : null}

        {compounds.filter((c) => !c.deletedAt).map((compound) => {
          const orderedIds = buildCompoundWorkspaceOrder(compound);
          const unlinkedWorkspaces = workspaces.filter((ws) => !(compound.workspaceIds || []).includes(ws.id));

          return (
            <article key={compound.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-slate-800">{compound.nome || compound.id}</strong>
                  <p className="mt-1 mb-0 text-xs text-slate-500">
                    {Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0} workspace(s) • Atualizado: {fmt(compound.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone(compound.status)}`}>
                    {getTranslatedStatus(compound.status)}
                  </span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Mover para lixeira"
                    onClick={() => handleTrashCompound(compound)}
                    disabled={busy === `compound-trash:${compound.id}`}
                  >
                    <AppIcon name="trash-2" size={14} />
                  </button>
                </div>
              </div>

              {/* Workspace tags */}
              {(Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0) === 0 ? (
                <div className="mt-3">
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Sem workspaces vinculados</span>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(compound.workspaceIds || []).map((wsId) => (
                    <span key={wsId} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {workspaceLabelsById.get(wsId) || wsId}
                    </span>
                  ))}
                </div>
              )}

              {/* Assinaturas do composto */}
              {(() => {
                const shared = compound.sharedTextsJson || {};
                const elab = Array.isArray(shared.elaboradores) ? shared.elaboradores : [];
                const rev = Array.isArray(shared.revisores) ? shared.revisores : [];
                const isEditing = editingSignaturesFor === compound.id;

                return (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Assinaturas</span>
                      {!isEditing ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          onClick={() => startEditingSignatures(compound)}
                        >
                          Editar
                        </button>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex flex-col gap-2">
                        {signatariosCandidatos.length > 0 ? (
                          signatariosCandidatos.map((sig) => {
                            const registro = formatSignatarioRegistro(sig);
                            const profNome = profissoes.find((p) => p.id === sig.profissao_id)?.nome || sig.profissao_nome || '';
                            const isElab = (editSignatures.elaboradores || []).includes(sig.id);
                            const isRev = (editSignatures.revisores || []).includes(sig.id);
                            return (
                              <div
                                key={sig.id}
                                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${isElab || isRev ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 accent-brand-600"
                                      checked={isElab}
                                      onChange={(e) => setEditSignatures((prev) => ({
                                        ...prev,
                                        elaboradores: e.target.checked
                                          ? [...(prev.elaboradores || []).filter((x) => x !== sig.id), sig.id]
                                          : (prev.elaboradores || []).filter((x) => x !== sig.id),
                                      }))}
                                    />
                                    Elaborador
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 accent-brand-600"
                                      checked={isRev}
                                      onChange={(e) => setEditSignatures((prev) => ({
                                        ...prev,
                                        revisores: e.target.checked
                                          ? [...(prev.revisores || []).filter((x) => x !== sig.id), sig.id]
                                          : (prev.revisores || []).filter((x) => x !== sig.id),
                                      }))}
                                    />
                                    Revisor
                                  </label>
                                </div>
                                <span className="flex-1 font-medium text-slate-800">{sig.nome}</span>
                                <span className="text-xs text-slate-500">{[profNome, registro].filter(Boolean).join(' – ')}</span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500">Nenhum signatario cadastrado. Adicione no seu perfil.</p>
                        )}

                        {/* Ordem dos elaboradores (edicao) */}
                        {(editSignatures.elaboradores || []).length >= 2 ? (
                          <div className="mt-2 rounded-xl border border-blue-200 bg-white p-3">
                            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Ordem dos Elaboradores</p>
                            <div className="flex flex-col gap-1.5">
                              {(editSignatures.elaboradores || []).map((sigId, index) => {
                                const sig = signatariosCandidatos.find((s) => s.id === sigId);
                                return (
                                  <div key={sigId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-2xs font-bold text-slate-600">{index + 1}</span>
                                      <span>{sig?.nome || sigId}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === 0} onClick={() => moveEditSignatario('elaboradores', sigId, 'up')} aria-label="Mover para cima">
                                        <AppIcon name="chevron-left" size={12} className="-rotate-90" />
                                      </button>
                                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === (editSignatures.elaboradores || []).length - 1} onClick={() => moveEditSignatario('elaboradores', sigId, 'down')} aria-label="Mover para baixo">
                                        <AppIcon name="chevron-right" size={12} className="rotate-90" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {/* Ordem dos revisores (edicao) */}
                        {(editSignatures.revisores || []).length >= 2 ? (
                          <div className="mt-2 rounded-xl border border-blue-200 bg-white p-3">
                            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Ordem dos Revisores</p>
                            <div className="flex flex-col gap-1.5">
                              {(editSignatures.revisores || []).map((sigId, index) => {
                                const sig = signatariosCandidatos.find((s) => s.id === sigId);
                                return (
                                  <div key={sigId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-2xs font-bold text-slate-600">{index + 1}</span>
                                      <span>{sig?.nome || sigId}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === 0} onClick={() => moveEditSignatario('revisores', sigId, 'up')} aria-label="Mover para cima">
                                        <AppIcon name="chevron-left" size={12} className="-rotate-90" />
                                      </button>
                                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={index === (editSignatures.revisores || []).length - 1} onClick={() => moveEditSignatario('revisores', sigId, 'down')} aria-label="Mover para baixo">
                                        <AppIcon name="chevron-right" size={12} className="rotate-90" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button variant="outline" size="sm" onClick={() => setEditingSignaturesFor(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={() => saveEditedSignatures(compound)} disabled={busy === `compound-update-sig:${compound.id}`}>
                            {busy === `compound-update-sig:${compound.id}` ? 'Salvando...' : 'Salvar Assinaturas'}
                          </Button>
                        </div>
                      </div>
                    ) : elab.length === 0 && rev.length === 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Nenhuma assinatura definida</span>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
                        {elab.length > 0 ? (
                          <div>
                            <span className="text-2xs font-semibold uppercase tracking-wide text-slate-400">Elaboradores</span>
                            <div className="mt-1 flex flex-col gap-1">
                              {elab.map((snap, i) => (
                                <div key={`elab-${i}`} className="flex items-center gap-2 text-sm text-slate-700">
                                  <span className="font-medium">{snap.nome}</span>
                                  {snap.profissao ? <span className="text-xs text-slate-500">{snap.profissao}</span> : null}
                                  {snap.registro ? <span className="text-xs text-slate-400">{snap.registro}</span> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {rev.length > 0 ? (
                          <div>
                            <span className="text-2xs font-semibold uppercase tracking-wide text-slate-400">Revisores</span>
                            <div className="mt-1 flex flex-col gap-1">
                              {rev.map((snap, i) => (
                                <div key={`rev-${i}`} className="flex items-center gap-2 text-sm text-slate-700">
                                  <span className="font-medium">{snap.nome}</span>
                                  {snap.profissao ? <span className="text-xs text-slate-500">{snap.profissao}</span> : null}
                                  {snap.registro ? <span className="text-xs text-slate-400">{snap.registro}</span> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Ordenacao dos blocos */}
              {orderedIds.length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <span>Ordem dos Blocos</span>
                    <HintText label="Ordenacao do composto">A ordem abaixo define a sequencia dos workspaces no relatorio composto.</HintText>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {orderedIds.map((workspaceId, index) => (
                      <div
                        key={`${compound.id}-${workspaceId}`}
                        id={`compound-order-${compound.id}-${workspaceId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                            {index + 1}
                          </span>
                          <span>{workspaceLabelsById.get(workspaceId) || workspaceId}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Mover ${workspaceLabelsById.get(workspaceId) || workspaceId} para cima`}
                            onClick={() => handleCompoundReorder(compound, workspaceId, 'up')}
                            disabled={index === 0 || busy === `compound-reorder:${compound.id}:${workspaceId}`}
                          >
                            <AppIcon name="chevron-left" size={14} className="-rotate-90" />
                          </button>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Mover ${workspaceLabelsById.get(workspaceId) || workspaceId} para baixo`}
                            onClick={() => handleCompoundReorder(compound, workspaceId, 'down')}
                            disabled={index === orderedIds.length - 1 || busy === `compound-reorder:${compound.id}:${workspaceId}`}
                          >
                            <AppIcon name="chevron-right" size={14} className="rotate-90" />
                          </button>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Remover ${workspaceLabelsById.get(workspaceId) || workspaceId}`}
                            onClick={() => handleCompoundRemoveWorkspace(compound, workspaceId)}
                            disabled={busy === `compound-remove:${compound.id}:${workspaceId}`}
                          >
                            <AppIcon name="x" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Adicionar workspace */}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <SearchableSelect
                  id={`compound-workspace-${compound.id}`}
                  label="Adicionar Workspace"
                  value={compoundWorkspaceSelections[compound.id] || ''}
                  onChange={(val) => setCompoundWorkspaceSelections((prev) => ({ ...prev, [compound.id]: val }))}
                  options={unlinkedWorkspaces.map((ws) => ({
                    value: ws.id,
                    label: workspaceLabelsById.get(ws.id) || ws.nome || ws.id,
                  }))}
                  placeholder="Selecione um workspace..."
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => handleCompoundAddWorkspace(compound)}
                    disabled={busy === `compound-add:${compound.id}`}
                  >
                    <AppIcon name="plus" />
                    {busy === `compound-add:${compound.id}` ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </div>
              </div>

              {/* Progresso de execucao */}
              {isPendingExecutionStatus(compound.status) && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <AppIcon name="loader" size={12} className="animate-spin" />
                    {getStatusLabel(compound.status)}
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                  </div>
                </div>
              )}

              {/* Erro */}
              {compound.lastError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {compound.lastError}
                </div>
              ) : null}

              {/* Preflight collapsible */}
              {compoundPreflights[compound.id] ? (
                <div className="mt-3">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                    onClick={() => togglePreflight(compound.id)}
                  >
                    <AppIcon name="chevron-right" size={12} className={openPreflights[compound.id] ? 'rotate-90' : ''} />
                    {openPreflights[compound.id] ? 'Ocultar' : 'Ver'} resultado do preflight
                    <span className={`rounded-full px-2 py-0.5 ${tone(compoundPreflights[compound.id]?.canGenerate ? 'ready' : 'pending')}`}>
                      {compoundPreflights[compound.id]?.canGenerate ? 'Pronto para gerar' : 'Ajustes necessarios'}
                    </span>
                  </button>
                  {openPreflights[compound.id] ? (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Declarados: {compoundPreflights[compound.id]?.workspaceCount ?? 0}</span>
                        <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Encontrados: {compoundPreflights[compound.id]?.foundWorkspaceCount ?? 0}</span>
                      </div>
                      {Array.isArray(compoundPreflights[compound.id]?.warnings) && compoundPreflights[compound.id].warnings.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {compoundPreflights[compound.id].warnings.map((warning) => (
                            <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Acoes primarias e secundarias separadas */}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  variant="outline"
                  onClick={() => handleCompoundPreflight(compound)}
                  disabled={busy === `compound-preflight:${compound.id}`}
                >
                  <AppIcon name="search" />
                  {busy === `compound-preflight:${compound.id}` ? 'Validando...' : 'Rodar Preflight'}
                </Button>
                {compound.outputDocxMediaId ? (
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadReportOutput(
                      compound.outputDocxMediaId,
                      buildCompoundDownloadFileName(compound),
                    )}
                    disabled={busy === `download:${compound.outputDocxMediaId}`}
                  >
                    <AppIcon
                      name={busy === `download:${compound.outputDocxMediaId}` ? 'loader' : 'download'}
                      className={busy === `download:${compound.outputDocxMediaId}` ? 'animate-spin' : ''}
                    />
                    {busy === `download:${compound.outputDocxMediaId}` ? 'Baixando...' : 'Baixar DOCX'}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => openGenerateWithCoords(compound)}
                  disabled={busy === `compound-generate:${compound.id}`}
                  title="Enfileira uma nova geracao forcando a inclusao de coordenadas de torres antes de cada grupo de fotos"
                >
                  <AppIcon name="map" />
                  Gerar com coordenadas
                </Button>
                <Button
                  onClick={() => setConfirmGenerate(compound)}
                  disabled={busy === `compound-generate:${compound.id}`}
                >
                  <AppIcon name="file-text" />
                  Enfileirar Geracao
                </Button>
              </div>
            </article>
          );
        })}
      </Card>

      {/* Lixeira de compostos */}
      {compounds.some((c) => c.deletedAt) ? (
        <div className="mt-2">
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
            onClick={() => setShowTrash((v) => !v)}
          >
            <AppIcon name="trash-2" size={12} />
            Lixeira ({compounds.filter((c) => c.deletedAt).length})
            <AppIcon name="chevron-right" size={12} className={`transition-transform ${showTrash ? 'rotate-90' : ''}`} />
          </button>
          {showTrash ? (
            <div className="mt-2 flex flex-col gap-2">
              {compounds.filter((c) => c.deletedAt).map((compound) => (
                <div key={compound.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{compound.nome || compound.id}</span>
                    <p className="mt-0.5 mb-0 text-xs text-red-400">Na lixeira • {fmt(compound.deletedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreCompound(compound)}
                      disabled={busy === `compound-restore:${compound.id}`}
                    >
                      <AppIcon name="undo" size={14} />
                      Restaurar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmHardDelete(compound)}
                      disabled={busy === `compound-delete:${compound.id}`}
                    >
                      <AppIcon name="trash-2" size={14} />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Modal confirmacao geracao */}
      <Modal
        open={Boolean(confirmGenerate)}
        onClose={() => setConfirmGenerate(null)}
        title="Confirmar geracao"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmGenerate(null)}>
              <AppIcon name="close" /> Cancelar
            </Button>
            <Button
              onClick={() => {
                handleCompoundGenerate(confirmGenerate);
                setConfirmGenerate(null);
              }}
              disabled={busy === `compound-generate:${confirmGenerate?.id}`}
            >
              <AppIcon name="file-text" />
              Confirmar Geracao
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-slate-700">
          Deseja enfileirar a geracao do relatorio composto{' '}
          <strong>{confirmGenerate?.nome || confirmGenerate?.id}</strong>?
          O documento sera processado em segundo plano.
        </p>
      </Modal>

      {/* Modal confirmacao geracao com coordenadas de torres */}
      <Modal
        open={Boolean(confirmGenerateWithCoords)}
        onClose={() => setConfirmGenerateWithCoords(null)}
        title="Gerar com coordenadas de torres"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmGenerateWithCoords(null)}>
              <AppIcon name="close" /> Cancelar
            </Button>
            <Button
              onClick={() => {
                handleCompoundGenerate(confirmGenerateWithCoords, {
                  ensureTowerCoordinates: true,
                  towerCoordinateFormat: coordFormatDraft || 'decimal',
                });
                setConfirmGenerateWithCoords(null);
              }}
              disabled={busy === `compound-generate:${confirmGenerateWithCoords?.id}`}
            >
              <AppIcon name="map" />
              Re-gerar com coordenadas
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-slate-700">
            Deseja re-gerar o relatorio composto{' '}
            <strong>{confirmGenerateWithCoords?.nome || confirmGenerateWithCoords?.id}</strong>{' '}
            forcando a inclusao de coordenadas de torres antes de cada grupo de fotos?
          </p>
          <p className="m-0 text-xs text-slate-500">
            O campo <code>includeTowerCoordinates</code> do relatorio sera marcado como
            verdadeiro e um novo DOCX sera gerado em segundo plano.
          </p>
          <Select
            id="compound-regen-coord-format"
            label="Formato da coordenada"
            value={coordFormatDraft}
            onChange={(event) => setCoordFormatDraft(event.target.value)}
          >
            <option value="decimal">Decimal (ex: -22.905556°, -43.199444°)</option>
            <option value="dms">Sexagesimal / GMS (ex: 22°54'20"S 43°11'58"W)</option>
            <option value="utm">UTM (ex: 686345E 7465123N 23S)</option>
          </Select>
          <HintText>
            Requer que o empreendimento do workspace tenha coordenadas de torres cadastradas (upload de KML).
          </HintText>
        </div>
      </Modal>
      {/* Modal confirmacao exclusao definitiva */}
      <Modal
        open={Boolean(confirmHardDelete)}
        onClose={() => setConfirmHardDelete(null)}
        title="Excluir definitivamente"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmHardDelete(null)}>
              <AppIcon name="close" /> Cancelar
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white border-red-500"
              onClick={() => {
                handleHardDeleteCompound(confirmHardDelete);
                setConfirmHardDelete(null);
              }}
              disabled={busy === `compound-delete:${confirmHardDelete?.id}`}
            >
              <AppIcon name="trash-2" />
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-slate-700">
          Deseja excluir permanentemente o relatorio composto{' '}
          <strong>{confirmHardDelete?.nome || confirmHardDelete?.id}</strong>?
          Essa acao nao pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}

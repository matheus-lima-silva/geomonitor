import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Textarea } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import {
  DOSSIER_SCOPE_FIELDS,
  buildDefaultDossierScope,
  getTranslatedStatus,
  isPendingExecutionStatus,
  getStatusLabel,
  summarizeDossierScope,
  tone,
} from '../utils/reportUtils';

export default function DossierTab({
  selectedProjectId,
  setSelectedProjectId,
  projectOptions,
  dossierDraft,
  setDossierDraft,
  projectDossiers,
  projectDossierPreflights,
  busy,
  handleCreateDossier,
  handleDossierPreflight,
  handleDossierGenerate,
  handleTrashDossier,
  handleRestoreDossier,
  handleHardDeleteDossier,
  handleDownloadReportOutput,
  buildDossierDownloadFileName,
}) {
  const [confirmGenerate, setConfirmGenerate] = useState(null); // dossier objeto
  const [confirmHardDelete, setConfirmHardDelete] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [openPreflights, setOpenPreflights] = useState({}); // id -> bool

  function togglePreflight(id) {
    setOpenPreflights((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      {/* Formulario de criacao */}
      <Card variant="nested" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <AppIcon name="plus" />
          <span>Criar Dossie</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SearchableSelect
            id="dossier-project"
            label="Empreendimento"
            hint="O dossie consolida dados operacionais de um unico empreendimento."
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val)}
            options={projectOptions}
            placeholder="Buscar empreendimento..."
          />
          <Input
            id="dossier-name"
            label="Nome do Dossie"
            value={dossierDraft.nome}
            onChange={(event) => setDossierDraft((prev) => ({ ...prev, nome: event.target.value }))}
            placeholder="Ex: Dossie operacional"
          />
          <Textarea
            id="dossier-notes"
            label="Observacoes"
            hint="O dossie tera seu proprio rascunho persistido, independente do workspace."
            rows={2}
            value={dossierDraft.observacoes}
            onChange={(event) => setDossierDraft((prev) => ({ ...prev, observacoes: event.target.value }))}
          />
        </div>

        {/* Escopo editorial */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <span>Escopo Editorial</span>
            <HintText label="Escopo editorial do dossie">Escolha quais blocos operacionais entram no preflight e na geracao do dossie.</HintText>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {DOSSIER_SCOPE_FIELDS.map(([key, label]) => (
              <label
                key={key}
                htmlFor={`dossier-scope-${key}`}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <input
                  id={`dossier-scope-${key}`}
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600"
                  checked={Boolean(dossierDraft.scopeJson?.[key])}
                  onChange={(event) => setDossierDraft((prev) => ({
                    ...prev,
                    scopeJson: {
                      ...(prev.scopeJson || buildDefaultDossierScope()),
                      [key]: event.target.checked,
                    },
                  }))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleCreateDossier}
            disabled={busy === 'dossier' || !selectedProjectId}
          >
            <AppIcon name="plus" />
            {busy === 'dossier' ? 'Criando...' : 'Criar Dossie'}
          </Button>
        </div>
      </Card>

      {/* Lista de dossies */}
      <Card variant="nested" className="flex flex-col gap-3">
        <div className="text-sm font-bold text-slate-800">Dossies do empreendimento</div>
        {!selectedProjectId ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Selecione um empreendimento para ver seus dossies.
          </div>
        ) : projectDossiers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum dossie criado ainda para este empreendimento.
          </div>
        ) : null}

        {projectDossiers.filter((d) => !d.deletedAt).map((dossier) => (
          <article key={dossier.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-slate-800">{dossier.nome || dossier.id}</strong>
                {dossier.observacoes ? (
                  <p className="mt-1 mb-0 text-xs text-slate-500">{dossier.observacoes}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone(dossier.status)}`}>
                  {getTranslatedStatus(dossier.status)}
                </span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Mover para lixeira"
                  onClick={() => handleTrashDossier(dossier)}
                  disabled={busy === `dossier-trash:${dossier.id}`}
                >
                  <AppIcon name="trash-2" size={14} />
                </button>
              </div>
            </div>

            {/* Escopo */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {summarizeDossierScope(dossier.scopeJson).map((label) => (
                <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{label}</span>
              ))}
              {summarizeDossierScope(dossier.scopeJson).length === 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Escopo vazio</span>
              ) : null}
            </div>

            {/* Progresso de execucao */}
            {isPendingExecutionStatus(dossier.status) && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <AppIcon name="loader" size={12} className="animate-spin" />
                  {getStatusLabel(dossier.status)}
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {/* Erro */}
            {dossier.lastError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {dossier.lastError}
              </div>
            ) : null}

            {/* Preflight collapsible */}
            {projectDossierPreflights[dossier.id] ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                  onClick={() => togglePreflight(dossier.id)}
                >
                  <AppIcon name={openPreflights[dossier.id] ? 'chevron-left' : 'chevron-right'} size={12} className={openPreflights[dossier.id] ? '-rotate-90' : 'rotate-90'} />
                  {openPreflights[dossier.id] ? 'Ocultar' : 'Ver'} resultado do preflight
                  <span className={`rounded-full px-2 py-0.5 ${tone(projectDossierPreflights[dossier.id]?.canGenerate ? 'ready' : 'pending')}`}>
                    {projectDossierPreflights[dossier.id]?.canGenerate ? 'Pronto para gerar' : 'Ajustes necessarios'}
                  </span>
                </button>
                {openPreflights[dossier.id] ? (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Licencas: {projectDossierPreflights[dossier.id]?.summary?.licenseCount ?? 0}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Inspecoes: {projectDossierPreflights[dossier.id]?.summary?.inspectionCount ?? 0}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Erosoes: {projectDossierPreflights[dossier.id]?.summary?.erosionCount ?? 0}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Entregas: {projectDossierPreflights[dossier.id]?.summary?.deliveryTrackingCount ?? 0}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Workspaces: {projectDossierPreflights[dossier.id]?.summary?.workspaceCount ?? 0}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1">Fotos: {projectDossierPreflights[dossier.id]?.summary?.photoCount ?? 0}</span>
                    </div>
                    {Array.isArray(projectDossierPreflights[dossier.id]?.warnings) && projectDossierPreflights[dossier.id].warnings.length > 0 ? (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {projectDossierPreflights[dossier.id].warnings.map((warning) => (
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

            {/* Acoes */}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleDossierPreflight(dossier)}
                disabled={busy === `dossier-preflight:${dossier.id}`}
              >
                <AppIcon name="search" />
                {busy === `dossier-preflight:${dossier.id}` ? 'Validando...' : 'Rodar Preflight'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmGenerate(dossier)}
                disabled={busy === `dossier-generate:${dossier.id}`}
              >
                <AppIcon name="file-text" />
                Enfileirar Geracao
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadReportOutput(
                  dossier.outputDocxMediaId,
                  buildDossierDownloadFileName(selectedProjectId, dossier),
                )}
                disabled={!dossier.outputDocxMediaId || busy === `download:${dossier.outputDocxMediaId}`}
              >
                <AppIcon
                  name={busy === `download:${dossier.outputDocxMediaId}` ? 'loader' : 'download'}
                  className={busy === `download:${dossier.outputDocxMediaId}` ? 'animate-spin' : ''}
                />
                {busy === `download:${dossier.outputDocxMediaId}` ? 'Baixando...' : 'Baixar DOCX'}
              </Button>
            </div>
          </article>
        ))}
      </Card>

      {/* Lixeira de dossies */}
      {projectDossiers.some((d) => d.deletedAt) ? (
        <div className="mt-2">
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
            onClick={() => setShowTrash((v) => !v)}
          >
            <AppIcon name="trash-2" size={12} />
            Lixeira ({projectDossiers.filter((d) => d.deletedAt).length})
            <AppIcon name="chevron-right" size={12} className={`transition-transform ${showTrash ? 'rotate-90' : ''}`} />
          </button>
          {showTrash ? (
            <div className="mt-2 flex flex-col gap-2">
              {projectDossiers.filter((d) => d.deletedAt).map((dossier) => (
                <div key={dossier.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{dossier.nome || dossier.id}</span>
                    <p className="mt-0.5 mb-0 text-xs text-red-400">Na lixeira</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreDossier(dossier)}
                      disabled={busy === `dossier-restore:${dossier.id}`}
                    >
                      <AppIcon name="undo" size={14} />
                      Restaurar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmHardDelete(dossier)}
                      disabled={busy === `dossier-delete:${dossier.id}`}
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

      {/* Modal de confirmacao de geracao */}
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
                handleDossierGenerate(confirmGenerate);
                setConfirmGenerate(null);
              }}
              disabled={busy === `dossier-generate:${confirmGenerate?.id}`}
            >
              <AppIcon name="file-text" />
              {busy === `dossier-generate:${confirmGenerate?.id}` ? 'Enfileirando...' : 'Confirmar Geracao'}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-slate-700">
          Deseja enfileirar a geracao do dossie{' '}
          <strong>{confirmGenerate?.nome || confirmGenerate?.id}</strong>?
          O documento sera processado em segundo plano.
        </p>
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
                handleHardDeleteDossier(confirmHardDelete);
                setConfirmHardDelete(null);
              }}
              disabled={busy === `dossier-delete:${confirmHardDelete?.id}`}
            >
              <AppIcon name="trash-2" />
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-slate-700">
          Deseja excluir permanentemente o dossie{' '}
          <strong>{confirmHardDelete?.nome || confirmHardDelete?.id}</strong>?
          Essa acao nao pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}

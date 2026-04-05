import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select, Textarea } from '../../../components/ui';
import IconButton from '../../../components/ui/IconButton';
import Modal from '../../../components/ui/Modal';
import { PhotoCardSkeleton } from '../../../components/ui/Skeleton';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import {
  IMPORT_MODES,
  STEPS,
  buildWorkspacePhotoDraft,
  fmt,
  getTranslatedStatus,
  getWorkspacePhotoStatus,
  isWorkspacePhotoDirty,
  tone,
} from '../utils/reportUtils';
import PhotoPreviewModal from './PhotoPreviewModal';

const PAGE_SIZE = 24;

export default function WorkspacesTab({
  // Projetos
  projects,
  projectOptions,
  projectNamesById,
  sortedProjects,
  // Workspaces
  workspaces,
  workspaceCandidates,
  filteredWorkspaceList,
  workspaceSearchQuery,
  setWorkspaceSearchQuery,
  selectedProjectId,
  setSelectedProjectId,
  workspaceImportTargetId,
  setWorkspaceImportTargetId,
  selectedWorkspace,
  selectedWorkspaceProject,
  workspaceTowerOptions,
  // Draft de criacao (desacoplado do selectedProjectId)
  workspaceDraft,
  setWorkspaceDraft,
  // Import
  workspaceImportMode,
  setWorkspaceImportMode,
  pendingFiles,
  setPendingFiles,
  uploadProgress,
  uploadPercent,
  // Textos
  workspaceTextsDraft,
  setWorkspaceTextsDraft,
  // Curadoria
  workspacePhotos,
  workspacePhotoDrafts,
  setWorkspacePhotoDrafts,
  workspaceMetrics,
  workspaceCurationSummary,
  workspaceAutosave,
  // Torres
  towerFilter,
  setTowerFilter,
  photoCountsByTower,
  filteredWorkspacePhotos,
  visibleWorkspacePhotos,
  // Foto preview
  activePreviewPhotoId,
  setActivePreviewPhotoId,
  photoPreviewUrls,
  photoPreviewLoading,
  // Lixeira
  deletedPhotoIds,
  lastDeletedPhotoId,
  // KMZ
  selectedWorkspaceKmzRequest,
  // Busy
  busy,
  // Handlers
  handleCreateWorkspace,
  handleImportWorkspace,
  handleSaveWorkspacePhoto,
  handleMovePhotoToTrash,
  handleUndoLastDeletedPhoto,
  handleRestoreAllDeletedPhotos,
  handleEmptyTrash,
  handleSaveWorkspaceTexts,
  handleRequestWorkspaceKmz,
  handleDownloadWorkspaceKmz,
  handleExportCaptions,
}) {
  const [sidebarTextsOpen, setSidebarTextsOpen] = useState(false);
  const [sidebarKmzOpen, setSidebarKmzOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const totalPages = Math.max(1, Math.ceil(filteredWorkspacePhotos.length / PAGE_SIZE));
  const pagedPhotos = filteredWorkspacePhotos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeImportMode = IMPORT_MODES[workspaceImportMode] || IMPORT_MODES.loose_photos;

  const activePreviewPhoto = workspacePhotos.find((p) => p.id === activePreviewPhotoId) || null;

  function handleTowerFilterChange(tower) {
    setTowerFilter(tower);
    setCurrentPage(1);
  }

  function handleWorkspaceSelect(workspaceId) {
    setWorkspaceImportTargetId(workspaceId);
    setCurrentPage(1);
    // Scroll para a secao de curadoria
    setTimeout(() => {
      document.getElementById('curadoria-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  return (
    <>
      {/* Guia de etapas */}
      <Card variant="nested">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <span>Fluxo do Workspace</span>
          <HintText label="Fluxo do workspace">O fluxo guiado substitui a logica dispersa e prepara curadoria, textos, preflight e geracao.</HintText>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {STEPS.map(([label, hint], index) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="mb-1 flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-slate-500">
                <span>Etapa {index + 1}</span>
                <HintText label={label}>{hint}</HintText>
              </div>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </Card>

      {/* Criar workspace */}
      <Card variant="nested" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <AppIcon name="plus" />
          <span>Criar Workspace</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SearchableSelect
            id="rw-project"
            label="Empreendimento"
            hint="Toda inferencia espacial acontece dentro do empreendimento selecionado."
            value={workspaceDraft.projectId}
            onChange={(val) => setWorkspaceDraft((prev) => ({ ...prev, projectId: val }))}
            options={projectOptions}
            placeholder="Buscar empreendimento..."
          />
          <Input
            id="rw-name"
            label="Nome"
            value={workspaceDraft.nome}
            onChange={(event) => setWorkspaceDraft((prev) => ({ ...prev, nome: event.target.value }))}
            placeholder="Ex: RT LT Norte - Abril"
          />
          <Input
            id="rw-desc"
            label="Descricao"
            hint="Os textos-base do empreendimento serao copiados para um rascunho editavel."
            value={workspaceDraft.descricao}
            onChange={(event) => setWorkspaceDraft((prev) => ({ ...prev, descricao: event.target.value }))}
            placeholder="Escopo, periodo ou observacoes"
          />
          <div className="md:col-span-3 flex justify-end">
            <Button
              onClick={handleCreateWorkspace}
              disabled={busy === 'workspace'}
            >
              <AppIcon name="plus" />
              {busy === 'workspace' ? 'Criando...' : 'Criar Workspace'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Importar fotos */}
      <Card variant="nested" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <AppIcon name="upload" />
          <span>Importar Fotos</span>
        </div>

        {/* Banner de progresso */}
        {busy === 'workspace-import' ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-brand-700">
              <span>Enviando arquivos... {uploadProgress.completed}/{uploadProgress.total} ({uploadPercent}%)</span>
            </div>
            {uploadProgress.currentFileName ? (
              <div className="mt-1 truncate text-xs text-brand-600" title={uploadProgress.currentFileName}>
                {uploadProgress.currentFileName}
              </div>
            ) : null}
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            id="rw-import-target"
            label="Workspace Alvo"
            hint="A importacao e a curadoria sempre acontecem dentro do workspace selecionado."
            value={workspaceImportTargetId}
            onChange={(event) => setWorkspaceImportTargetId(event.target.value)}
          >
            <option value="">Selecione...</option>
            {workspaceCandidates.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.nome || workspace.id}</option>
            ))}
          </Select>
          <Select
            id="rw-import-mode"
            label="Modo de Importacao"
            hint="Os contratos do backend ja aceitam fotos soltas, subpastas por torre e KMZ organizado."
            value={workspaceImportMode}
            onChange={(event) => { setWorkspaceImportMode(event.target.value); setPendingFiles([]); }}
          >
            {Object.entries(IMPORT_MODES).map(([mode, config]) => (
              <option key={mode} value={mode}>{config.label}</option>
            ))}
          </Select>
          <Input
            key={workspaceImportMode}
            id="rw-import-files"
            label={activeImportMode.inputLabel}
            hint={activeImportMode.hint}
            type="file"
            accept={activeImportMode.accept}
            multiple={activeImportMode.multiple}
            webkitdirectory={workspaceImportMode === 'tower_subfolders' ? '' : undefined}
            directory={workspaceImportMode === 'tower_subfolders' ? '' : undefined}
            onChange={(event) => setPendingFiles(Array.from(event.target.files || []))}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {pendingFiles.length > 0
              ? `${pendingFiles.length} arquivo(s) pronto(s) para envio.`
              : 'Nenhum arquivo selecionado.'}
          </span>
          <Button
            onClick={handleImportWorkspace}
            disabled={busy === 'workspace-import' || !workspaceImportTargetId || pendingFiles.length === 0}
          >
            <AppIcon name={workspaceImportMode === 'organized_kmz' ? 'file-text' : 'upload'} />
            {busy === 'workspace-import'
              ? (workspaceImportMode === 'organized_kmz' ? 'Registrando...' : 'Enviando...')
              : activeImportMode.buttonLabel}
          </Button>
        </div>
      </Card>

      {/* Curadoria */}
      <Card variant="nested" className="flex flex-col gap-4" id="curadoria-section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span>Curadoria do Workspace</span>
            <HintText label="Curadoria do workspace">Edite legenda, torre e inclusao da foto usando o workspace alvo atual.</HintText>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              {selectedWorkspace
                ? `${selectedWorkspace.nome || selectedWorkspace.id} • ${workspaceMetrics.total} foto(s)`
                : 'Selecione um workspace para comecar a curadoria.'}
            </span>
            {selectedWorkspace ? (
              <span className={`rounded-full px-2 py-1 text-xs ${tone(workspaceAutosave.status)}`}>
                {workspaceAutosave.status === 'saving' ? 'Salvando...' : null}
                {workspaceAutosave.status === 'pending' ? 'Pendente' : null}
                {workspaceAutosave.status === 'saved' ? `Salvo ${fmt(workspaceAutosave.savedAt)}` : null}
                {workspaceAutosave.status === 'error' ? 'Erro no autosave' : null}
                {workspaceAutosave.status === 'idle' ? 'Autosave inativo' : null}
              </span>
            ) : null}
          </div>
        </div>

        {/* Erros de autosave/KMZ */}
        {selectedWorkspace && workspaceAutosave.status === 'error' ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {workspaceAutosave.error || 'Erro ao autosalvar rascunho do workspace.'}
          </div>
        ) : null}
        {selectedWorkspaceKmzRequest?.lastError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {selectedWorkspaceKmzRequest.lastError}
          </div>
        ) : null}

        {selectedWorkspace ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            {/* Sidebar de curadoria */}
            <aside className="flex h-fit flex-col gap-3 xl:sticky xl:top-4">
              {/* Info + Resumo (unificados) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="m-0 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace Ativo</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                    {workspaceCurationSummary.completionPercent}% curado
                  </span>
                </div>
                <p className="mt-0 mb-1 text-sm font-bold text-slate-800">{selectedWorkspace.nome || selectedWorkspace.id}</p>
                <p className="m-0 mb-3 text-xs text-slate-400">{selectedWorkspace.id}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${workspaceCurationSummary.completionPercent}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                    <strong className="text-slate-800">{workspaceMetrics.total}</strong>
                    <p className="mt-1 mb-0 text-slate-500">Fotos</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
                    <strong className="text-emerald-700">{workspaceCurationSummary.curated}</strong>
                    <p className="mt-1 mb-0 text-emerald-700">Curadas</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                    <strong className="text-amber-700">{workspaceCurationSummary.pending}</strong>
                    <p className="mt-1 mb-0 text-amber-700">Pendentes</p>
                  </div>
                  <div className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-2">
                    <strong className="text-brand-700">{workspaceMetrics.included}</strong>
                    <p className="mt-1 mb-0 text-brand-700">No relatorio</p>
                  </div>
                </div>
                {(workspaceMetrics.missingCaption > 0 || workspaceMetrics.missingTower > 0) ? (
                  <p className="mt-3 mb-0 text-xs text-amber-600">
                    {workspaceMetrics.missingCaption > 0 ? `${workspaceMetrics.missingCaption} sem legenda` : null}
                    {workspaceMetrics.missingCaption > 0 && workspaceMetrics.missingTower > 0 ? ' • ' : null}
                    {workspaceMetrics.missingTower > 0 ? `${workspaceMetrics.missingTower} sem torre` : null}
                  </p>
                ) : null}
              </div>

              {/* Textos + KMZ (colapsavel) */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setSidebarTextsOpen((v) => !v)}
                >
                  <span className="text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Textos e KMZ</span>
                  <AppIcon name="chevron-right" size={14} className={`text-slate-400 transition-transform duration-200 ${sidebarTextsOpen ? 'rotate-90' : ''}`} />
                </button>
                {sidebarTextsOpen ? (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 flex flex-col gap-3">
                    <Textarea
                      id="ws-texto-intro"
                      label="Introducao"
                      hint="Texto de introducao do workspace no DOCX."
                      rows={3}
                      value={workspaceTextsDraft.introducao}
                      onChange={(event) => setWorkspaceTextsDraft((prev) => ({ ...prev, introducao: event.target.value }))}
                      placeholder="Descreva o contexto desta campanha..."
                    />
                    <Textarea
                      id="ws-texto-obs"
                      label="Observacoes"
                      hint="Texto de observacoes ao final do workspace no DOCX."
                      rows={2}
                      value={workspaceTextsDraft.observacoes}
                      onChange={(event) => setWorkspaceTextsDraft((prev) => ({ ...prev, observacoes: event.target.value }))}
                      placeholder="Observacoes gerais ou pendencias..."
                    />
                    <Button variant="outline" onClick={handleSaveWorkspaceTexts} disabled={busy === 'workspace-texts'}>
                      <AppIcon name="save" />
                      {busy === 'workspace-texts' ? 'Salvando...' : 'Salvar Textos'}
                    </Button>
                    <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={handleRequestWorkspaceKmz}
                        disabled={busy === 'workspace-kmz' || !selectedWorkspace}
                      >
                        <AppIcon name="file-text" />
                        {busy === 'workspace-kmz' ? 'Enfileirando KMZ...' : 'Gerar KMZ com Fotos'}
                      </Button>
                      {selectedWorkspaceKmzRequest?.outputKmzMediaId ? (
                        <Button
                          variant="outline"
                          onClick={() => handleDownloadWorkspaceKmz(selectedWorkspaceKmzRequest)}
                          disabled={busy === `download:${selectedWorkspaceKmzRequest.outputKmzMediaId}`}
                        >
                          <AppIcon name="download" />
                          {busy === `download:${selectedWorkspaceKmzRequest.outputKmzMediaId}` ? 'Baixando...' : 'Baixar KMZ'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Torres + Exportar Legendas (unificados) */}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="m-0 mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Torres</p>
                <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                  <button
                    type="button"
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${!towerFilter ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    onClick={() => handleTowerFilterChange('')}
                  >
                    <span>Todas</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-slate-600">{visibleWorkspacePhotos.length}</span>
                  </button>
                  {(photoCountsByTower.__none__ || 0) > 0 && (
                    <button
                      type="button"
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${towerFilter === '__none__' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      onClick={() => handleTowerFilterChange('__none__')}
                    >
                      <span className="italic">Sem torre</span>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">{photoCountsByTower.__none__}</span>
                    </button>
                  )}
                  {workspaceTowerOptions.filter((tower) => (photoCountsByTower[tower] || 0) > 0).map((tower) => (
                    <button
                      key={tower}
                      type="button"
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${towerFilter === tower ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      onClick={() => handleTowerFilterChange(tower)}
                    >
                      <span>Torre {tower}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-slate-600">{photoCountsByTower[tower] || 0}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 mt-3 pt-3">
                  <p className="m-0 mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Exportar Legendas</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleExportCaptions('csv')} disabled={visibleWorkspacePhotos.length === 0}>
                      <AppIcon name="download" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportCaptions('md')} disabled={visibleWorkspacePhotos.length === 0}>
                      <AppIcon name="download" />
                      Markdown
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            {/* Area principal de fotos */}
            <div className="flex min-w-0 flex-col gap-3">
              {/* Status bar */}
              <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{workspaceCurationSummary.reviewed} revisadas</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{workspaceCurationSummary.curated} aptas</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{workspaceCurationSummary.pending} pendentes</span>
                  <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700">{workspaceMetrics.included} no DOCX</span>
                  {towerFilter && (
                    <button
                      type="button"
                      className="rounded-full bg-brand-100 px-2 py-1 text-brand-700 hover:bg-brand-200 transition-colors"
                      onClick={() => handleTowerFilterChange('')}
                    >
                      {towerFilter === '__none__' ? 'Sem torre' : `Torre ${towerFilter}`} ({filteredWorkspacePhotos.length}) ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Lixeira */}
              {deletedPhotoIds.length > 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-rose-800">
                    <span className="font-semibold">{deletedPhotoIds.length} foto(s) na lixeira.</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleUndoLastDeletedPhoto} disabled={!lastDeletedPhotoId || busy === 'empty-trash'}>
                        <AppIcon name="chevron-left" />Desfazer ultima
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleRestoreAllDeletedPhotos} disabled={busy === 'empty-trash'}>
                        <AppIcon name="reset" />Restaurar todas
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setConfirmEmptyTrash(true)}
                        disabled={busy === 'empty-trash'}
                        className="bg-rose-600 hover:bg-rose-700 text-white border-0"
                      >
                        <AppIcon name="trash" className="text-white" />
                        {busy === 'empty-trash' ? 'Esvaziando...' : 'Esvaziar'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Grid de fotos */}
              {busy === 'workspace-import' && visibleWorkspacePhotos.length === 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, i) => <PhotoCardSkeleton key={i} />)}
                </div>
              ) : visibleWorkspacePhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <AppIcon name="upload" size={32} className="text-slate-300" />
                  <div>
                    <p className="m-0 text-sm font-medium text-slate-600">Nenhuma foto neste workspace</p>
                    <p className="mt-1 m-0 text-xs text-slate-400">Use a secao de importacao acima para adicionar fotos.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('rw-import-target')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  >
                    <AppIcon name="upload" />
                    Ir para importacao
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {pagedPhotos.map((photo) => {
                      const draft = workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo);
                      const dirty = isWorkspacePhotoDirty(photo, draft);
                      const currentStatus = getWorkspacePhotoStatus(photo, draft);
                      const towerOptions = draft.towerId && !workspaceTowerOptions.includes(draft.towerId)
                        ? [draft.towerId, ...workspaceTowerOptions]
                        : workspaceTowerOptions;
                      const previewUrl = photoPreviewUrls[photo.id];
                      const previewLoading = Boolean(photoPreviewLoading[photo.id]);

                      return (
                        <article key={photo.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          {/* Thumbnail com acoes sobrepostas */}
                          <div className="relative bg-slate-100">
                            {previewUrl ? (
                              <button
                                type="button"
                                className="block w-full"
                                onClick={() => setActivePreviewPhotoId(photo.id)}
                                title="Abrir preview"
                              >
                                <img
                                  src={previewUrl}
                                  alt={draft.caption || photo.id}
                                  className="aspect-[4/3] w-full object-cover transition-transform duration-200 hover:scale-105"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="flex aspect-[4/3] w-full items-center justify-center text-xs text-slate-500">
                                {previewLoading ? 'Carregando...' : 'Miniatura indisponivel'}
                              </div>
                            )}
                            {/* Acoes sobre thumbnail */}
                            <div className="absolute top-2 right-2 flex gap-1">
                              <IconButton
                                variant="outline"
                                size="sm"
                                aria-label="Visualizar foto"
                                onClick={() => setActivePreviewPhotoId(photo.id)}
                                className="bg-white/90 backdrop-blur-sm shadow-sm"
                              >
                                <AppIcon name="details" size={14} />
                              </IconButton>
                              <IconButton
                                variant="outline"
                                size="sm"
                                aria-label="Mover para lixeira"
                                onClick={() => handleMovePhotoToTrash(photo.id)}
                                className="bg-white/90 backdrop-blur-sm shadow-sm"
                              >
                                <AppIcon name="trash" size={14} />
                              </IconButton>
                            </div>
                            {/* Badge de status */}
                            <div className="absolute bottom-2 left-2 flex gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${tone(currentStatus)}`}>
                                {getTranslatedStatus(currentStatus)}
                              </span>
                              {dirty ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-medium text-amber-700">Alterado</span>
                              ) : null}
                            </div>
                          </div>

                          {/* Campos de curadoria */}
                          <div className="p-3 flex flex-col gap-3">
                            <Input
                              id={`rw-photo-caption-${photo.id}`}
                              label="Legenda"
                              value={draft.caption}
                              onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                                ...prev,
                                [photo.id]: {
                                  ...(prev[photo.id] || buildWorkspacePhotoDraft(photo)),
                                  caption: event.target.value,
                                },
                              }))}
                              placeholder="Descreva a foto"
                            />
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <Select
                                  id={`rw-photo-tower-${photo.id}`}
                                  label="Torre"
                                  value={draft.towerId}
                                  onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                                    ...prev,
                                    [photo.id]: {
                                      ...(prev[photo.id] || buildWorkspacePhotoDraft(photo)),
                                      towerId: event.target.value,
                                    },
                                  }))}
                                >
                                  <option value="">Pendente</option>
                                  {towerOptions.map((towerId) => (
                                    <option key={towerId} value={towerId}>{towerId}</option>
                                  ))}
                                </Select>
                              </div>
                              <label htmlFor={`rw-photo-include-${photo.id}`} className="flex cursor-pointer items-center gap-1.5 pb-2 text-xs font-medium text-slate-600 shrink-0">
                                <input
                                  id={`rw-photo-include-${photo.id}`}
                                  type="checkbox"
                                  className="h-4 w-4 shrink-0 accent-brand-600"
                                  checked={Boolean(draft.includeInReport)}
                                  onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                                    ...prev,
                                    [photo.id]: {
                                      ...(prev[photo.id] || buildWorkspacePhotoDraft(photo)),
                                      includeInReport: event.target.checked,
                                    },
                                  }))}
                                />
                                No DOCX
                              </label>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Paginacao */}
                  {totalPages > 1 ? (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <AppIcon name="chevron-left" />
                        Anterior
                      </Button>
                      <span className="text-xs text-slate-500">Pagina {currentPage} de {totalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Proxima
                        <AppIcon name="chevron-right" />
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <AppIcon name="file-text" size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="m-0 text-sm text-slate-600">Nenhum workspace selecionado.</p>
            <p className="mt-1 m-0 text-xs text-slate-400">Selecione um workspace abaixo ou crie um novo acima.</p>
          </div>
        )}
      </Card>

      {/* Lista de workspaces */}
      <Card variant="nested" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <SearchableSelect
              id="ws-list-project"
              label="Filtrar por Empreendimento"
              value={selectedProjectId}
              onChange={(val) => setSelectedProjectId(val)}
              options={[{ value: '', label: 'Todos' }, ...projectOptions]}
              placeholder="Buscar empreendimento..."
            />
          </div>
          <div className="flex-1 min-w-48">
            <Input
              id="ws-list-search"
              label="Buscar Workspace"
              placeholder="Nome, descricao ou empreendimento..."
              value={workspaceSearchQuery}
              onChange={(event) => setWorkspaceSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            {(selectedProjectId || workspaceSearchQuery) ? (
              <Button variant="outline" onClick={() => { setSelectedProjectId(''); setWorkspaceSearchQuery(''); }}>
                <AppIcon name="close" />
                Limpar
              </Button>
            ) : null}
            <span className="text-xs text-slate-500">{filteredWorkspaceList.length} de {workspaces.length}</span>
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum workspace criado ainda.
          </div>
        ) : filteredWorkspaceList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum workspace encontrado com o filtro atual.
          </div>
        ) : null}

        {filteredWorkspaceList.map((workspace) => (
          <article key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="text-slate-800">{workspace.nome || workspace.id}</strong>
                <p className="mt-1 mb-0 text-xs text-slate-500 truncate">{workspace.descricao || 'Sem descricao'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${tone(workspace.status)}`}>
                {getTranslatedStatus(workspace.status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Empreendimento: {projectNamesById.get(workspace.projectId) || workspace.projectId || '-'}</span>
              <span>Atualizado: {fmt(workspace.updatedAt)}</span>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleWorkspaceSelect(workspace.id)}
              >
                <AppIcon name="details" />
                Selecionar para curadoria
              </Button>
            </div>
          </article>
        ))}
      </Card>

      {/* Modal de confirmacao de esvaziamento da lixeira */}
      <Modal
        open={confirmEmptyTrash}
        onClose={() => setConfirmEmptyTrash(false)}
        title="Esvaziar lixeira"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmEmptyTrash(false)}>
              <AppIcon name="close" /> Cancelar
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white border-0"
              onClick={() => { setConfirmEmptyTrash(false); handleEmptyTrash(); }}
              disabled={busy === 'empty-trash'}
            >
              <AppIcon name="trash" className="text-white" />
              Apagar definitivamente
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-slate-700">
          Tem certeza que deseja apagar <strong>{deletedPhotoIds.length} foto(s)</strong> permanentemente?
          Essa acao nao pode ser desfeita.
        </p>
      </Modal>

      {/* Modal de preview */}
      <PhotoPreviewModal
        photo={activePreviewPhoto}
        previewUrl={photoPreviewUrls[activePreviewPhoto?.id]}
        draft={workspacePhotoDrafts[activePreviewPhoto?.id] || buildWorkspacePhotoDraft(activePreviewPhoto || {})}
        busy={busy}
        onClose={() => setActivePreviewPhotoId('')}
        onChangeCaption={(value) => {
          if (!activePreviewPhoto) return;
          setWorkspacePhotoDrafts((prev) => ({
            ...prev,
            [activePreviewPhoto.id]: {
              ...(prev[activePreviewPhoto.id] || buildWorkspacePhotoDraft(activePreviewPhoto)),
              caption: value,
            },
          }));
        }}
        onSave={() => activePreviewPhoto && handleSaveWorkspacePhoto(activePreviewPhoto)}
      />
    </>
  );
}

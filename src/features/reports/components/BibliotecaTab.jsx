import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select } from '../../../components/ui';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { fmt, getProjectPhotoDate, getTranslatedStatus } from '../utils/reportUtils';

export default function BibliotecaTab({
  selectedProjectId,
  setSelectedProjectId,
  projectOptions,
  libraryFilters,
  setLibraryFilters,
  libraryQueryFilters,
  workspaceCandidates,
  libraryTowerOptions,
  projectPhotos,
  metrics,
  busy,
  handlePhotoExport,
}) {
  return (
    <>
      {/* Filtros */}
      <Card variant="nested" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <AppIcon name="search" />
          <span>Filtros da Biblioteca</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SearchableSelect
            id="library-project"
            label="Empreendimento"
            hint="A biblioteca cruza todas as fotos do empreendimento, nao apenas as de um workspace."
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val)}
            options={projectOptions}
            placeholder="Buscar empreendimento..."
          />
          <Select
            id="library-workspace"
            label="Workspace"
            hint="Filtra a biblioteca agregada por origem do workspace."
            value={libraryFilters.workspaceId}
            onChange={(event) => setLibraryFilters((prev) => ({ ...prev, workspaceId: event.target.value }))}
          >
            <option value="">Todos</option>
            {workspaceCandidates.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.nome || workspace.id}</option>
            ))}
          </Select>
          <Select
            id="library-tower"
            label="Torre"
            hint="Use a torre para cruzar a curadoria ja aplicada nas fotos."
            value={libraryFilters.towerId}
            onChange={(event) => setLibraryFilters((prev) => ({ ...prev, towerId: event.target.value }))}
          >
            <option value="">Todas</option>
            {libraryTowerOptions.map((towerId) => (
              <option key={towerId} value={towerId}>{towerId}</option>
            ))}
          </Select>
          <Input
            id="library-caption"
            label="Legenda"
            hint="Busca por trecho da legenda da foto."
            value={libraryFilters.captionQuery}
            onChange={(event) => setLibraryFilters((prev) => ({ ...prev, captionQuery: event.target.value }))}
            placeholder="Ex: fundacao, isolador, erosao"
          />
          <Input
            id="library-date-from"
            label="Data Inicial"
            type="date"
            value={libraryFilters.dateFrom}
            onChange={(event) => setLibraryFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
          <Input
            id="library-date-to"
            label="Data Final"
            type="date"
            value={libraryFilters.dateTo}
            onChange={(event) => setLibraryFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-500">
            {Object.keys(libraryQueryFilters).length > 0
              ? `${Object.keys(libraryQueryFilters).length} filtro(s) ativo(s) nesta biblioteca.`
              : 'Nenhum filtro adicional ativo; a biblioteca mostra todas as fotos do empreendimento.'}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setLibraryFilters({ workspaceId: '', towerId: '', captionQuery: '', dateFrom: '', dateTo: '' })}
              disabled={Object.keys(libraryQueryFilters).length === 0}
            >
              <AppIcon name="close" />
              Limpar Filtros
            </Button>
            <Button
              variant="outline"
              onClick={handlePhotoExport}
              disabled={busy === 'export' || !selectedProjectId}
            >
              <AppIcon name="download" />
              {busy === 'export' ? 'Solicitando...' : 'Baixar Tudo Filtrado'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Metricas */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card variant="nested">
          <strong className="text-2xl font-bold text-slate-800">{metrics.total}</strong>
          <p className="mt-1 mb-0 text-xs text-slate-500">Fotos agregadas</p>
        </Card>
        <Card variant="nested">
          <strong className="text-2xl font-bold text-slate-800">{metrics.included}</strong>
          <p className="mt-1 mb-0 text-xs text-slate-500">Incluidas no relatorio</p>
        </Card>
        <Card variant="nested">
          <strong className="text-2xl font-bold text-amber-600">{metrics.missingCaption}</strong>
          <p className="mt-1 mb-0 text-xs text-slate-500">Sem legenda</p>
        </Card>
        <Card variant="nested">
          <strong className="text-2xl font-bold text-amber-600">{metrics.missingTower}</strong>
          <p className="mt-1 mb-0 text-xs text-slate-500">Sem torre</p>
        </Card>
      </div>

      {/* Lista de fotos */}
      <Card variant="nested" className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span>Biblioteca agregada</span>
          <HintText label="Biblioteca agregada">O download total ou parcial sera entregue como ZIP efemero, sem persistencia duravel.</HintText>
        </div>
        <div className="text-xs text-slate-500">
          {selectedProjectId
            ? `${projectPhotos.length} foto(s) encontradas para o recorte atual.`
            : 'Selecione um empreendimento para abrir a biblioteca agregada.'}
        </div>
        {projectPhotos.length === 0 && selectedProjectId ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhuma foto agregada encontrada para este empreendimento.
          </div>
        ) : null}
        {projectPhotos.map((photo) => (
          <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <strong className="text-slate-800">{photo.id}</strong>
            <p className="mt-1 mb-0 text-sm text-slate-600">{photo.caption || 'Sem legenda ainda'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-1">Torre: {photo.towerId || '-'}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">Workspace: {photo.workspaceId || '-'}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">Origem: {photo.importSource || '-'}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">Data: {fmt(getProjectPhotoDate(photo))}</span>
              {photo.includeInReport ? (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">No relatorio</span>
              ) : null}
            </div>
          </article>
        ))}
      </Card>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select } from '../../../components/ui';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { fmt, getProjectPhotoDate, getTranslatedStatus } from '../utils/reportUtils';
import { listArchivedProjectPhotos } from '../../../services/reportWorkspaceService';

const PT_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function buildInspectionBucketLookup(workspaces, inspections) {
  const inspectionById = new Map((inspections || []).map((i) => [i.id, i]));
  const result = new Map();
  for (const workspace of workspaces || []) {
    const inspectionId = workspace?.inspectionId;
    if (!inspectionId) {
      result.set(workspace.id, { key: '__none__', label: 'Sem vistoria', sortKey: '0000-00' });
      continue;
    }
    const inspection = inspectionById.get(inspectionId);
    const data = inspection?.dataInicio ? new Date(inspection.dataInicio) : null;
    if (!data || Number.isNaN(data.getTime())) {
      result.set(workspace.id, { key: `insp-${inspectionId}`, label: `Vistoria ${inspectionId}`, sortKey: '0000-00' });
      continue;
    }
    const year = data.getFullYear();
    const month = data.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    result.set(workspace.id, {
      key,
      label: `${PT_MONTH_NAMES[month]} de ${year}`,
      sortKey: key,
    });
  }
  return result;
}

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
  workspaces = [],
  inspections = [],
  handleUnarchivePhotoToTrash = () => {},
  showToast = () => {},
}) {
  const [mode, setMode] = useState('biblioteca');
  const [archivedPhotos, setArchivedPhotos] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedRefreshToken, setArchivedRefreshToken] = useState(0);

  useEffect(() => {
    if (mode !== 'arquivo' || !selectedProjectId) { setArchivedPhotos([]); return; }
    let cancelled = false;
    setArchivedLoading(true);
    listArchivedProjectPhotos(selectedProjectId)
      .then((items) => { if (!cancelled) setArchivedPhotos(items); })
      .catch((error) => { if (!cancelled) showToast(error?.message || 'Erro ao carregar arquivo.', 'error'); })
      .finally(() => { if (!cancelled) setArchivedLoading(false); });
    return () => { cancelled = true; };
  }, [mode, selectedProjectId, archivedRefreshToken, showToast]);

  const bucketLookup = useMemo(
    () => buildInspectionBucketLookup(workspaces, inspections),
    [workspaces, inspections],
  );

  const archivedGroups = useMemo(() => {
    if (!archivedPhotos.length) return [];
    const groups = new Map();
    for (const photo of archivedPhotos) {
      const bucket = bucketLookup.get(photo.workspaceId)
        || { key: '__none__', label: 'Sem vistoria', sortKey: '0000-00' };
      if (!groups.has(bucket.key)) {
        groups.set(bucket.key, { ...bucket, items: [] });
      }
      groups.get(bucket.key).items.push(photo);
    }
    return [...groups.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [archivedPhotos, bucketLookup]);

  async function onUnarchive(photo) {
    if (!photo?.id || !photo?.workspaceId) return;
    await handleUnarchivePhotoToTrash(photo.workspaceId, photo.id);
    setArchivedRefreshToken((t) => t + 1);
  }

  return (
    <>
      {/* Seletor modo: Biblioteca vs Arquivo */}
      <div className="flex flex-wrap items-center gap-2" data-testid="library-mode-switch">
        <Button
          variant={mode === 'biblioteca' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setMode('biblioteca')}
        >
          <AppIcon name="search" />
          Biblioteca agregada
        </Button>
        <Button
          variant={mode === 'arquivo' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setMode('arquivo')}
          data-testid="library-mode-arquivo"
        >
          <AppIcon name="archive" />
          Arquivo
        </Button>
      </div>

      {mode === 'arquivo' ? (
        <Card variant="nested" className="flex flex-col gap-3" data-testid="library-archive-panel">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span>Fotos arquivadas</span>
            <HintText label="Fotos arquivadas">
              Fotos que sairam da lixeira por tempo excedido. Agrupadas por mes/ano da vistoria.
              So e permitido mover de volta para a lixeira (nao ha retorno direto para a grid ativa).
            </HintText>
          </div>
          <div className="text-xs text-slate-500">
            {!selectedProjectId
              ? 'Selecione um empreendimento para ver o arquivo.'
              : archivedLoading
                ? 'Carregando arquivo...'
                : `${archivedPhotos.length} foto(s) arquivada(s) no total.`}
          </div>
          {selectedProjectId && !archivedLoading && archivedPhotos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Nenhuma foto arquivada para este empreendimento.
            </div>
          ) : null}
          {archivedGroups.map((group) => (
            <section
              key={group.key}
              data-testid={`library-archive-group-${group.key}`}
              className="flex flex-col gap-2"
            >
              <header className="flex items-center gap-2 border-b border-slate-200 pb-1">
                <AppIcon name="clock" size={14} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">{group.label}</span>
                <span className="text-xs text-slate-500">· {group.items.length} foto(s)</span>
              </header>
              {group.items.map((photo) => (
                <article
                  key={photo.id}
                  data-testid={`archive-photo-${photo.id}`}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <strong className="text-slate-800 text-sm">{photo.caption || photo.id}</strong>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Torre: {photo.towerId || '-'}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Workspace: {photo.workspaceId || '-'}</span>
                        {photo.archivedAt ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Arquivada: {fmt(photo.archivedAt)}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnarchive(photo)}
                      data-testid={`archive-unarchive-${photo.id}`}
                    >
                      <AppIcon name="undo" size={12} />
                      Mover para lixeira
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </Card>
      ) : (
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
      )}
    </>
  );
}

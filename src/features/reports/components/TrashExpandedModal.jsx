import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';
import { groupPhotosByTower } from '../utils/reportUtils';

const SORT_OPTIONS = [
  ['deleted_desc', 'Deletadas recentemente'],
  ['deleted_asc', 'Deletadas há mais tempo'],
  ['caption_asc', 'Legenda (A-Z)'],
  ['tower_asc', 'Torre (A-Z)'],
];

const PAGE_SIZE = 24;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

const OLD_THRESHOLD_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function daysSince(deletedAt) {
  if (!deletedAt) return 0;
  const deletedMs = new Date(deletedAt).getTime();
  if (!Number.isFinite(deletedMs)) return 0;
  return Math.floor((Date.now() - deletedMs) / MS_PER_DAY);
}

function towerKey(photo) {
  return photo?.towerId ? String(photo.towerId) : '__none__';
}

function sortTrashedPhotos(photos, sortMode) {
  const list = [...photos];
  switch (sortMode) {
    case 'deleted_asc':
      list.sort((a, b) => new Date(a.deletedAt || 0) - new Date(b.deletedAt || 0));
      break;
    case 'caption_asc':
      list.sort((a, b) => String(a.caption || '').localeCompare(String(b.caption || ''), undefined, { numeric: true }));
      break;
    case 'tower_asc':
      list.sort((a, b) => String(a.towerId || '').localeCompare(String(b.towerId || ''), undefined, { numeric: true }));
      break;
    case 'deleted_desc':
    default:
      list.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
      break;
  }
  return list;
}

function matchesFilter(photo, term) {
  if (!term) return true;
  const normalized = term.toLowerCase();
  const caption = String(photo.caption || '').toLowerCase();
  const tower = String(photo.towerId || '').toLowerCase();
  const relative = String(photo.relativePath || '').toLowerCase();
  return caption.includes(normalized) || tower.includes(normalized) || relative.includes(normalized);
}

export default function TrashExpandedModal({
  open,
  onClose,
  trashedPhotos,
  photoPreviewUrls,
  ensurePhotoPreview,
  busy,
  handleRestorePhoto,
  handleRestoreSelectedTrashedPhotos,
  handleHardDeleteSelectedTrashedPhotos,
  handleArchiveOldTrashedPhotos,
  handleArchiveAllTrashedPhotos,
  handleEmptyPhotoTrash,
  retentionDays = OLD_THRESHOLD_DAYS,
  canWrite = true,
}) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('deleted_desc');
  const [towerFilter, setTowerFilter] = useState('__all__');
  const [groupByTower, setGroupByTower] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [previewPhotoId, setPreviewPhotoId] = useState(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);
  const [confirmArchiveAll, setConfirmArchiveAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setTowerFilter('__all__');
      setGroupByTower(false);
      setSelectedIds(new Set());
      setPreviewPhotoId(null);
      setConfirmDeleteSelected(false);
      setConfirmEmptyAll(false);
      setConfirmArchiveAll(false);
      setPage(1);
      setPageSize(PAGE_SIZE);
    }
  }, [open]);

  // Opcoes do dropdown derivadas das torres presentes na lixeira atual.
  const towerOptions = useMemo(() => {
    const set = new Set();
    let hasNone = false;
    for (const photo of trashedPhotos || []) {
      if (photo?.towerId) set.add(String(photo.towerId));
      else hasNone = true;
    }
    const towers = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [
      { value: '__all__', label: `Todas (${trashedPhotos?.length || 0})` },
      ...towers.map((t) => ({ value: t, label: `Torre ${t}` })),
      ...(hasNone ? [{ value: '__none__', label: 'Sem torre' }] : []),
    ];
  }, [trashedPhotos]);

  const filteredPhotos = useMemo(() => {
    const filtered = (trashedPhotos || []).filter((photo) => {
      if (!matchesFilter(photo, search)) return false;
      if (towerFilter === '__all__') return true;
      if (towerFilter === '__none__') return !photo?.towerId;
      return String(photo?.towerId || '') === towerFilter;
    });
    return sortTrashedPhotos(filtered, sortMode);
  }, [trashedPhotos, search, sortMode, towerFilter]);

  // Reseta para a primeira pagina quando o filtro/ordenacao mudam ou
  // o total filtrado cai abaixo do offset atual.
  useEffect(() => {
    setPage(1);
  }, [search, sortMode, pageSize, towerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedPhotos = useMemo(
    () => filteredPhotos.slice(pageStart, pageEnd),
    [filteredPhotos, pageStart, pageEnd],
  );

  // Agrupamento por torre fica independente da ordenacao: desliga so quando
  // usuario desmarca o toggle. Quando sort mode e 'tower_asc' ou toggle
  // ligado, entrega grupos; caso contrario, lista unica.
  const effectiveGroupByTower = groupByTower || sortMode === 'tower_asc';
  const groups = useMemo(() => {
    if (effectiveGroupByTower) return groupPhotosByTower(pagedPhotos, {});
    return [{ label: null, items: pagedPhotos }];
  }, [pagedPhotos, effectiveGroupByTower]);

  useEffect(() => {
    if (!open || typeof ensurePhotoPreview !== 'function') return;
    for (const photo of pagedPhotos) ensurePhotoPreview(photo);
  }, [open, pagedPhotos, ensurePhotoPreview]);

  const previewPhoto = previewPhotoId
    ? filteredPhotos.find((photo) => photo.id === previewPhotoId)
    : null;

  function toggleSelection(photoId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filteredPhotos.map((photo) => photo.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function onRestoreSelected() {
    await handleRestoreSelectedTrashedPhotos([...selectedIds]);
    clearSelection();
  }

  async function onHardDeleteSelected() {
    await handleHardDeleteSelectedTrashedPhotos([...selectedIds]);
    clearSelection();
    setConfirmDeleteSelected(false);
  }

  async function onEmptyAll() {
    await handleEmptyPhotoTrash();
    clearSelection();
    setConfirmEmptyAll(false);
  }

  const selectedCount = selectedIds.size;
  const totalTrash = trashedPhotos?.length || 0;

  // Fotos elegiveis para arquivamento automatico (idade > retentionDays).
  const oldPhotosCount = useMemo(() => {
    if (!Array.isArray(trashedPhotos) || trashedPhotos.length === 0) return 0;
    return trashedPhotos.filter((photo) => daysSince(photo?.deletedAt) > retentionDays).length;
  }, [trashedPhotos, retentionDays]);

  async function onArchiveOld() {
    if (typeof handleArchiveOldTrashedPhotos !== 'function') return;
    await handleArchiveOldTrashedPhotos(retentionDays);
  }

  async function onArchiveAll() {
    if (typeof handleArchiveAllTrashedPhotos !== 'function') return;
    await handleArchiveAllTrashedPhotos();
    clearSelection();
    setConfirmArchiveAll(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Lixeira expandida (${totalTrash} ${totalTrash === 1 ? 'foto' : 'fotos'})`}
      size="2xl"
    >
      <div className="flex flex-col gap-3 min-h-0" data-testid="trash-expanded-body">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px]">
            <Input
              id="trash-expanded-search"
              placeholder="Buscar legenda, torre ou caminho..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              id="trash-expanded-tower"
              value={towerFilter}
              onChange={(event) => setTowerFilter(event.target.value)}
            >
              {towerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <Select
              id="trash-expanded-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              {SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="trash-group-toggle"
              className="h-4 w-4 cursor-pointer"
              checked={effectiveGroupByTower}
              onChange={(event) => setGroupByTower(event.target.checked)}
              disabled={sortMode === 'tower_asc'}
              title={sortMode === 'tower_asc' ? 'Ordenacao por torre ja agrupa' : ''}
            />
            Agrupar por torre
          </label>
          <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={filteredPhotos.length === 0}>
            Selecionar todas ({filteredPhotos.length})
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedCount === 0}>
            Limpar
          </Button>
        </div>

        {/* Banner de fotos antigas — notifica que ha fotos elegiveis para arquivar */}
        {oldPhotosCount > 0 && (
          <div
            data-testid="trash-old-banner"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <span>
              <AppIcon name="alert-triangle" size={14} className="inline -mt-0.5" />
              {' '}
              <strong>{oldPhotosCount}</strong> foto(s) na lixeira ha mais de {retentionDays} dias.
            </span>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white border-0"
              onClick={onArchiveOld}
              disabled={!canWrite || busy === 'archive-old-trash'}
              data-testid="trash-archive-old-button"
              title={!canWrite ? 'Sem permissao de escrita neste workspace' : ''}
            >
              <AppIcon name="archive" size={14} className="text-white" />
              {busy === 'archive-old-trash' ? 'Arquivando...' : `Arquivar antigas (${oldPhotosCount})`}
            </Button>
          </div>
        )}

        {/* Barra de ações em lote */}
        {selectedCount > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2"
            data-testid="trash-selection-bar"
          >
            <span className="text-sm font-semibold text-brand-700">
              {selectedCount} selecionada(s)
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRestoreSelected}
                disabled={busy === 'restore-selected'}
              >
                <AppIcon name="undo" size={14} />
                Restaurar selecionadas
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white border-0"
                onClick={() => setConfirmDeleteSelected(true)}
                disabled={busy === 'hard-delete-selected'}
              >
                <AppIcon name="trash" size={14} className="text-white" />
                Excluir permanentemente
              </Button>
            </div>
          </div>
        )}

        {/* Grid agrupado */}
        <div className="min-h-0 overflow-y-auto max-h-[60vh] pr-1">
          {filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-slate-500">
              <AppIcon name="trash-2" size={32} className="text-slate-300" />
              <p className="m-0 text-sm">
                {totalTrash === 0 ? 'Lixeira vazia.' : 'Nenhuma foto corresponde ao filtro.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <section
                  key={group.label || '__all__'}
                  data-testid={`trash-expanded-group-${group.items[0]?.towerId || '__none__'}`}
                >
                  {group.label && (
                    <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.label} · {group.items.length}
                    </h3>
                  )}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                    {group.items.map((photo) => {
                      const previewUrl = photoPreviewUrls?.[photo.id];
                      const isSelected = selectedIds.has(photo.id);
                      const deletedDate = photo.deletedAt
                        ? new Date(photo.deletedAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : '';
                      const ageDays = daysSince(photo.deletedAt);
                      const isOld = ageDays > retentionDays;
                      return (
                        <div
                          key={photo.id}
                          data-testid={`trash-card-${photo.id}`}
                          className={`flex flex-col rounded-lg border bg-white overflow-hidden transition ${
                            isSelected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'
                          }`}
                        >
                          <div className="relative">
                            <button
                              type="button"
                              className="block w-full aspect-square bg-slate-100"
                              onClick={() => setPreviewPhotoId(photo.id)}
                              aria-label={`Visualizar ${photo.caption || photo.id}`}
                            >
                              {previewUrl ? (
                                <img
                                  src={previewUrl}
                                  alt=""
                                  className="h-full w-full object-cover opacity-80"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <AppIcon name="image" size={20} className="text-slate-300" />
                                </div>
                              )}
                            </button>
                            <label
                              className="absolute left-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-white/90 shadow"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer"
                                checked={isSelected}
                                onChange={() => toggleSelection(photo.id)}
                                aria-label={`Selecionar ${photo.caption || photo.id}`}
                              />
                            </label>
                            <button
                              type="button"
                              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded bg-white/90 text-slate-600 shadow hover:text-slate-800"
                              onClick={() => handleRestorePhoto(photo)}
                              disabled={busy === `photo-restore:${photo.id}`}
                              aria-label={`Restaurar ${photo.caption || photo.id}`}
                            >
                              <AppIcon name="undo" size={12} />
                            </button>
                          </div>
                          <div className="p-2">
                            <p className="m-0 truncate text-xs font-semibold text-slate-700">
                              {photo.caption || photo.relativePath || photo.id}
                            </p>
                            <p className="m-0 mt-0.5 text-2xs text-slate-500">
                              {photo.towerId ? `Torre ${photo.towerId}` : 'Sem torre'}
                              {deletedDate ? ` · ${deletedDate}` : ''}
                            </p>
                            {isOld && (
                              <span
                                data-testid={`trash-card-old-${photo.id}`}
                                className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-700"
                                title="Foto antiga na lixeira — candidata a arquivamento"
                              >
                                <AppIcon name="alert-triangle" size={10} />
                                {ageDays}d
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Paginacao */}
        {filteredPhotos.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2"
            data-testid="trash-pagination"
          >
            <span className="text-xs text-slate-500">
              {filteredPhotos.length === 0
                ? '0 fotos'
                : `${pageStart + 1}-${Math.min(pageEnd, filteredPhotos.length)} de ${filteredPhotos.length}`}
              {filteredPhotos.length !== totalTrash ? ` · ${totalTrash} no total` : ''}
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="trash-page-size" className="text-xs text-slate-500">
                Por pagina:
              </label>
              <Select
                id="trash-page-size"
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value) || PAGE_SIZE)}
                className="w-auto"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                data-testid="trash-page-prev"
                aria-label="Pagina anterior"
              >
                <AppIcon name="chevron-left" size={14} />
              </Button>
              <span className="text-xs text-slate-600 font-mono" data-testid="trash-page-indicator">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                data-testid="trash-page-next"
                aria-label="Proxima pagina"
              >
                <AppIcon name="chevron-right" size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Rodapé de ações globais */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <span className="text-xs text-slate-500">
            {filteredPhotos.length} visível(eis) de {totalTrash}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white border-0"
              onClick={() => setConfirmArchiveAll(true)}
              disabled={totalTrash === 0 || !canWrite || busy === 'archive-all-trash'}
              data-testid="trash-archive-all-button"
              title={!canWrite ? 'Sem permissao de escrita neste workspace' : ''}
            >
              <AppIcon name="archive" size={14} className="text-white" />
              {busy === 'archive-all-trash' ? 'Arquivando...' : 'Arquivar todas'}
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white border-0"
              onClick={() => setConfirmEmptyAll(true)}
              disabled={totalTrash === 0 || busy === 'empty-trash'}
            >
              <AppIcon name="trash" size={14} className="text-white" />
              Esvaziar lixeira
            </Button>
          </div>
        </div>
      </div>

      {/* Preview ampliado */}
      {previewPhoto && (
        <Modal
          open={Boolean(previewPhoto)}
          onClose={() => setPreviewPhotoId(null)}
          title={previewPhoto.caption || previewPhoto.id}
          size="xl"
        >
          <div className="flex flex-col items-center gap-3">
            {photoPreviewUrls?.[previewPhoto.id] ? (
              <img
                src={photoPreviewUrls[previewPhoto.id]}
                alt={previewPhoto.caption || previewPhoto.id}
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center bg-slate-100 text-slate-400">
                Preview indisponível
              </div>
            )}
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="m-0"><strong className="text-slate-700">ID:</strong> {previewPhoto.id}</p>
              <p className="m-0 mt-1"><strong className="text-slate-700">Torre:</strong> {previewPhoto.towerId || 'Sem torre'}</p>
              {previewPhoto.relativePath ? (
                <p className="m-0 mt-1 break-all"><strong className="text-slate-700">Caminho:</strong> {previewPhoto.relativePath}</p>
              ) : null}
              {previewPhoto.deletedAt ? (
                <p className="m-0 mt-1">
                  <strong className="text-slate-700">Deletada em:</strong>{' '}
                  {new Date(previewPhoto.deletedAt).toLocaleString('pt-BR')}
                </p>
              ) : null}
            </div>
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleRestorePhoto(previewPhoto);
                  setPreviewPhotoId(null);
                }}
                disabled={busy === `photo-restore:${previewPhoto.id}`}
              >
                <AppIcon name="undo" size={14} />
                Restaurar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmação: excluir selecionadas */}
      {confirmDeleteSelected && (
        <Modal
          open={confirmDeleteSelected}
          onClose={() => setConfirmDeleteSelected(false)}
          title="Excluir fotos permanentemente"
          size="sm"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteSelected(false)}>Cancelar</Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white border-0"
                onClick={onHardDeleteSelected}
                disabled={busy === 'hard-delete-selected'}
              >
                Excluir {selectedCount} foto(s)
              </Button>
            </div>
          )}
        >
          <p className="text-sm text-slate-600">
            Esta ação não pode ser desfeita. {selectedCount} foto(s) serão removidas permanentemente.
          </p>
        </Modal>
      )}

      {/* Confirmação: esvaziar lixeira */}
      {confirmEmptyAll && (
        <Modal
          open={confirmEmptyAll}
          onClose={() => setConfirmEmptyAll(false)}
          title="Esvaziar lixeira"
          size="sm"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmEmptyAll(false)}>Cancelar</Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white border-0"
                onClick={onEmptyAll}
                disabled={busy === 'empty-trash'}
              >
                Esvaziar {totalTrash} foto(s)
              </Button>
            </div>
          )}
        >
          <p className="text-sm text-slate-600">
            Todas as {totalTrash} fotos da lixeira serão removidas permanentemente.
          </p>
        </Modal>
      )}

      {/* Confirmação: arquivar todas da lixeira */}
      {confirmArchiveAll && (
        <Modal
          open={confirmArchiveAll}
          onClose={() => setConfirmArchiveAll(false)}
          title="Arquivar todas as fotos da lixeira"
          size="sm"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmArchiveAll(false)}>Cancelar</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                onClick={onArchiveAll}
                disabled={busy === 'archive-all-trash'}
                data-testid="trash-archive-all-confirm"
              >
                Arquivar {totalTrash} foto(s)
              </Button>
            </div>
          )}
        >
          <p className="text-sm text-slate-600">
            {totalTrash} foto(s) serão movidas para a área de arquivadas. Você pode devolvê-las para a lixeira depois, foto a foto, se precisar.
          </p>
        </Modal>
      )}
    </Modal>
  );
}

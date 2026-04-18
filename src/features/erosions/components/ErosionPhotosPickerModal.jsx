import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import MediaImage from '../../../components/MediaImage';
import { Button, IconButton, Select, EmptyState } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import { useOptionalToast } from '../../../context/ToastContext';
import { saveErosion } from '../../../services/erosionService';
import { useErosionPhotoSources } from '../hooks/useErosionPhotoSources';
import {
  EROSION_PHOTOS_PRINCIPAIS_LIMIT,
  buildFotosPrincipaisPatch,
  reorderFotosPrincipais,
} from '../models/erosionPhotosModel';

function makeRef(photoSource, sortOrder) {
  return {
    photoId: photoSource.photoId,
    workspaceId: photoSource.workspaceId,
    mediaAssetId: photoSource.mediaAssetId,
    caption: photoSource.caption || undefined,
    sortOrder,
  };
}

export default function ErosionPhotosPickerModal({
  open,
  erosion,
  project,
  userEmail,
  onClose,
  onSaved,
  onRequestCreateWorkspace,
}) {
  const { show: showToast } = useOptionalToast();
  const {
    workspaces,
    photos: available,
    loading,
    hasAnyWorkspace,
  } = useErosionPhotoSources(erosion?.projetoId);

  const [selected, setSelected] = useState([]);
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = Array.isArray(erosion?.fotosPrincipais) ? erosion.fotosPrincipais : [];
    setSelected(buildFotosPrincipaisPatch(initial));
    setWorkspaceFilter('all');
  }, [open, erosion?.id]);

  const filteredAvailable = useMemo(() => {
    if (workspaceFilter === 'all') return available;
    return available.filter((p) => p.workspaceId === workspaceFilter);
  }, [available, workspaceFilter]);

  const selectedMap = useMemo(() => {
    const map = new Map();
    selected.forEach((item, index) => map.set(item.photoId, { item, index }));
    return map;
  }, [selected]);

  function toggle(photoSource) {
    const existing = selectedMap.get(photoSource.photoId);
    if (existing) {
      const next = selected
        .filter((item) => item.photoId !== photoSource.photoId)
        .map((item, idx) => ({ ...item, sortOrder: idx }));
      setSelected(next);
      return;
    }
    if (selected.length >= EROSION_PHOTOS_PRINCIPAIS_LIMIT) {
      showToast(`Maximo de ${EROSION_PHOTOS_PRINCIPAIS_LIMIT} fotos principais.`, 'error');
      return;
    }
    setSelected([...selected, makeRef(photoSource, selected.length)]);
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    setSelected(reorderFotosPrincipais(selected, index, target));
  }

  async function handleSave() {
    if (!erosion?.id) return;
    try {
      setSaving(true);
      const fotosPrincipais = buildFotosPrincipaisPatch(selected);
      await saveErosion({ id: erosion.id, fotosPrincipais }, {
        merge: true,
        updatedBy: userEmail || 'web',
        skipAutoFollowup: true,
      });
      showToast('Fotos principais salvas.', 'success');
      if (typeof onSaved === 'function') onSaved(fotosPrincipais);
      onClose?.();
    } catch (error) {
      showToast(error?.message || 'Erro ao salvar fotos principais.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!open || !erosion) return null;

  const footer = (
    <>
      <Button variant="primary" onClick={handleSave} disabled={saving}>
        <AppIcon name="save" className="w-4 h-4" />
        {saving ? 'Salvando...' : 'Salvar selecao'}
      </Button>
      <Button variant="outline" onClick={onClose} disabled={saving}>
        <AppIcon name="close" className="w-4 h-4" />
        Cancelar
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={`Escolher fotos principais da erosao ${erosion.id}`}
      size="2xl"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">
            Selecionadas: <strong>{selected.length}</strong> / {EROSION_PHOTOS_PRINCIPAIS_LIMIT}
          </span>
          {hasAnyWorkspace ? (
            <Select
              id="erosion-photos-picker-workspace"
              label="Workspace"
              value={workspaceFilter}
              onChange={(event) => setWorkspaceFilter(event.target.value)}
              className="w-60"
              fullWidth={false}
            >
              <option value="all">Todos ({available.length})</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.titulo || ws.nome || ws.id}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <section className="rounded-xl border border-brand-200 bg-brand-50 p-3">
            <h5 className="text-sm font-semibold text-brand-900 m-0 mb-2">Ordem de impressao</h5>
            <ol className="grid grid-cols-2 md:grid-cols-3 gap-2 list-none p-0 m-0">
              {selected.map((item, index) => (
                <li key={item.photoId} className="flex items-center gap-2 rounded-lg bg-white border border-brand-100 p-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-xs text-slate-700 truncate" title={item.photoId}>
                    {item.caption || item.photoId}
                  </span>
                  <IconButton
                    variant="outline"
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover para cima"
                  >
                    <AppIcon name="arrow-up" className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    variant="outline"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                    aria-label="Mover para baixo"
                  >
                    <AppIcon name="arrow-down" className="w-4 h-4" />
                  </IconButton>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {loading && available.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Carregando fotos...</div>
        ) : null}

        {!loading && !hasAnyWorkspace ? (
          <EmptyState
            icon="camera"
            title="Sem workspaces com fotos neste empreendimento"
            description="Crie um banco de fotos dedicado e faca upload antes de selecionar as fotos principais."
            action={
              <Button variant="primary" onClick={onRequestCreateWorkspace}>
                <AppIcon name="plus" className="w-4 h-4" />
                Criar banco de fotos
              </Button>
            }
          />
        ) : null}

        {!loading && hasAnyWorkspace && filteredAvailable.length === 0 ? (
          <EmptyState
            icon="image"
            title="Nenhuma foto encontrada"
            description="Faca upload de fotos no workspace selecionado para usa-las aqui."
          />
        ) : null}

        {filteredAvailable.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredAvailable.map((photo) => {
              const entry = selectedMap.get(photo.photoId);
              const isSelected = Boolean(entry);
              return (
                <button
                  key={`${photo.workspaceId}:${photo.photoId}`}
                  type="button"
                  onClick={() => toggle(photo)}
                  className={`relative overflow-hidden rounded-xl border text-left transition-shadow focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected
                      ? 'border-brand-600 ring-2 ring-brand-600 shadow-panel'
                      : 'border-slate-200 hover:shadow-card'
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Remover' : 'Selecionar'} foto ${photo.photoId}`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950">
                    <MediaImage
                      mediaAssetId={photo.mediaAssetId}
                      alt={photo.caption || photo.photoId}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full"
                    />
                  </div>
                  <div className="p-2 text-xs text-slate-600">
                    <div className="truncate font-medium text-slate-800" title={photo.caption || photo.photoId}>
                      {photo.caption || photo.photoId}
                    </div>
                    <div className="truncate text-slate-500" title={photo.workspaceTitle}>
                      {photo.workspaceTitle}
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="absolute top-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold shadow">
                      {entry.index + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

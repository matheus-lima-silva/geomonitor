import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  subscribeReportWorkspaces,
  listReportWorkspacePhotos,
} from '../../../services/reportWorkspaceService';

// Agrega fotos ativas de todos os workspaces do projeto informado. Expoe:
// - workspaces: lista filtrada por projectId (nao-trashed)
// - photos: galeria plana enriquecida com metadados do workspace
// - loading, error, refresh, hasAnyWorkspace
// Nao resolve URLs de midia aqui (usar useMediaAccessUrl sob demanda).

function isWorkspaceTrashed(ws) {
  return Boolean(ws?.trashedAt || ws?.deletedAt || ws?.trashed === true);
}

export function useErosionPhotoSources(projectId) {
  const [allWorkspaces, setAllWorkspaces] = useState([]);
  const [photosByWorkspace, setPhotosByWorkspace] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photosError, setPhotosError] = useState(null);
  const reloadRequestRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeReportWorkspaces(
      (rows) => setAllWorkspaces(Array.isArray(rows) ? rows : []),
      (err) => setPhotosError(err),
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const workspaces = useMemo(() => {
    const target = String(projectId || '').trim();
    if (!target) return [];
    return allWorkspaces.filter((ws) => {
      if (isWorkspaceTrashed(ws)) return false;
      return String(ws?.projectId || '').trim() === target;
    });
  }, [allWorkspaces, projectId]);

  const workspaceIds = useMemo(() => workspaces.map((ws) => ws.id).filter(Boolean), [workspaces]);
  const workspaceIdsKey = workspaceIds.join(',');

  useEffect(() => {
    if (!projectId) {
      setPhotosByWorkspace({});
      return undefined;
    }
    let cancelled = false;
    const token = reloadRequestRef.current;
    setLoadingPhotos(true);
    setPhotosError(null);
    Promise.all(
      workspaceIds.map(async (id) => {
        try {
          const photos = await listReportWorkspacePhotos(id);
          return [id, Array.isArray(photos) ? photos : []];
        } catch (err) {
          return [id, { error: err }];
        }
      }),
    ).then((pairs) => {
      if (cancelled || reloadRequestRef.current !== token) return;
      const next = {};
      let firstError = null;
      pairs.forEach(([id, value]) => {
        if (value && typeof value === 'object' && value.error) {
          firstError = firstError || value.error;
          next[id] = [];
        } else {
          next[id] = value;
        }
      });
      setPhotosByWorkspace(next);
      setPhotosError(firstError);
      setLoadingPhotos(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const photos = useMemo(() => {
    const result = [];
    workspaces.forEach((ws) => {
      const bucket = photosByWorkspace[ws.id] || [];
      bucket.forEach((photo) => {
        if (!photo || !photo.id || !photo.mediaAssetId) return;
        if (photo.deletedAt || photo.archivedAt) return;
        result.push({
          photoId: String(photo.id),
          workspaceId: ws.id,
          workspaceTitle: ws.titulo || ws.nome || ws.id,
          mediaAssetId: String(photo.mediaAssetId),
          caption: String(photo.caption || '').trim(),
          towerId: photo.towerId || null,
          importSource: photo.importSource || null,
          capturedAt: photo.capturedAt || photo.captureAt || null,
        });
      });
    });
    return result;
  }, [workspaces, photosByWorkspace]);

  const refresh = useCallback(() => {
    reloadRequestRef.current += 1;
    setPhotosByWorkspace({});
  }, []);

  return {
    workspaces,
    photos,
    loading: loadingPhotos,
    error: photosError,
    hasAnyWorkspace: workspaces.length > 0,
    refresh,
  };
}

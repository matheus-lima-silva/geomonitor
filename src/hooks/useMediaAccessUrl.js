import { useEffect, useRef, useState } from 'react';
import { downloadMediaAsset } from '../services/mediaService';

// Cache global de object URLs por mediaAssetId. Compartilhado entre instancias
// para evitar re-download quando o mesmo asset aparece em varios lugares (ex.:
// thumbnail + lightbox). Cada valor e { promise, url, refCount }.
const cache = new Map();

function acquire(mediaId) {
  if (!mediaId) return null;
  const existing = cache.get(mediaId);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }
  const entry = { promise: null, url: null, refCount: 1, error: null };
  entry.promise = downloadMediaAsset(mediaId)
    .then(({ blob }) => {
      const objectUrl = URL.createObjectURL(blob);
      entry.url = objectUrl;
      return objectUrl;
    })
    .catch((err) => {
      entry.error = err;
      throw err;
    });
  cache.set(mediaId, entry);
  return entry;
}

function release(mediaId) {
  if (!mediaId) return;
  const entry = cache.get(mediaId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    if (entry.url) URL.revokeObjectURL(entry.url);
    cache.delete(mediaId);
  }
}

export function useMediaAccessUrl(mediaAssetId) {
  const [state, setState] = useState({ url: null, loading: Boolean(mediaAssetId), error: null });
  const entryRef = useRef(null);

  useEffect(() => {
    if (!mediaAssetId) {
      setState({ url: null, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    const entry = acquire(mediaAssetId);
    entryRef.current = entry;

    if (entry.url) {
      setState({ url: entry.url, loading: false, error: null });
    } else {
      setState({ url: null, loading: true, error: null });
      entry.promise
        .then((url) => {
          if (cancelled) return;
          setState({ url, loading: false, error: null });
        })
        .catch((err) => {
          if (cancelled) return;
          setState({ url: null, loading: false, error: err });
        });
    }

    return () => {
      cancelled = true;
      release(mediaAssetId);
      entryRef.current = null;
    };
  }, [mediaAssetId]);

  return state;
}

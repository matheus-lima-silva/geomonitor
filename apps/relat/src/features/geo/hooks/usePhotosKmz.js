import { useCallback, useState } from 'react';

import { buildKmz, safeFileName } from '../utils/kmzBuilder';

const IMAGE_MIME = /^image\//i;
const IMAGE_EXT = /\.(jpe?g|png|tiff?|webp|heic|heif|bmp|gif)$/i;

function isImageFile(file) {
  if (!file) return false;
  if (file.type && IMAGE_MIME.test(file.type)) return true;
  // Alguns navegadores nao setam `type` (ex.: arquivos vindos de pasta); cai no nome.
  return IMAGE_EXT.test(file.name || '');
}

// Identidade estavel de um arquivo selecionado, para deduplicar re-seleções.
function fileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildKmzFileName(title) {
  const base = safeFileName(String(title || '').trim() || 'fotos', 'fotos').replace(/\.kmz$/i, '');
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}-${stamp}.kmz`;
}

/**
 * Estado da ferramenta "Fotos -> KMZ": acumula o lote selecionado (deduplicado),
 * expoe progresso e dispara a montagem do KMZ no navegador via `buildKmz`.
 */
export function usePhotosKmz() {
  const [files, setFiles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null); // { processed, total } | null

  const addFiles = useCallback((incoming) => {
    const accepted = Array.from(incoming || []).filter(isImageFile);
    if (!accepted.length) return 0;
    setFiles((prev) => {
      const seen = new Set(prev.map(fileKey));
      const next = [...prev];
      for (const file of accepted) {
        const key = fileKey(file);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(file);
      }
      return next;
    });
    return accepted.length;
  }, []);

  const removeFile = useCallback((target) => {
    setFiles((prev) => prev.filter((file) => file !== target));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    setProgress(null);
  }, []);

  const generate = useCallback(async (title) => {
    if (!files.length || generating) return null;
    setGenerating(true);
    setProgress({ processed: 0, total: files.length });
    try {
      const result = await buildKmz({
        files,
        title,
        onProgress: (processed, total) => setProgress({ processed, total }),
      });
      return { ...result, fileName: buildKmzFileName(title) };
    } finally {
      setGenerating(false);
    }
  }, [files, generating]);

  return { files, addFiles, removeFile, clear, generating, progress, generate };
}

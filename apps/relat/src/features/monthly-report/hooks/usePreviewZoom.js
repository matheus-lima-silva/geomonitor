// Zoom da preview: passos de 10%, limites 40-160%, padrao "ajustar a largura"
// ((largura disponivel - 40px) / 794, max 100%). Escala via transform: scale.

import { useCallback, useEffect, useRef, useState } from 'react';

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.1;
const SHEET_WIDTH = 794;

function clamp(value) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function usePreviewZoom(scrollRef) {
  const [zoom, setZoom] = useState(1);
  const fitOnMountRef = useRef(false);

  const fitWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const available = el.clientWidth - 40;
    if (available <= 0) return;
    setZoom(clamp(Math.min(1, available / SHEET_WIDTH)));
  }, [scrollRef]);

  // Padrao = ajustar a largura no primeiro layout.
  useEffect(() => {
    if (fitOnMountRef.current) return;
    fitOnMountRef.current = true;
    fitWidth();
  }, [fitWidth]);

  const zoomIn = useCallback(() => setZoom((z) => clamp(Math.round((z + ZOOM_STEP) * 10) / 10)), []);
  const zoomOut = useCallback(() => setZoom((z) => clamp(Math.round((z - ZOOM_STEP) * 10) / 10)), []);

  return { zoom, zoomIn, zoomOut, fitWidth };
}

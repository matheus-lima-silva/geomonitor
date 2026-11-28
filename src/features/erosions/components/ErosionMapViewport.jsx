import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

const PAN_DEBOUNCE_MS = 600;

function isValidPoint(point) {
  return Array.isArray(point)
    && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
    && Math.abs(Number(point[0])) <= 90 && Math.abs(Number(point[1])) <= 180;
}

/**
 * Controla o viewport do mapa do formulario de erosao sem recriar o MapContainer.
 *
 * - Recentraliza (center/zoom) so quando `recenterKey` muda (troca de projeto/torre).
 * - Quando o ponto selecionado muda e saiu da area visivel, faz pan mantendo o zoom
 *   (com debounce, para nao pular a cada digito da coordenada). Clique no mapa nao
 *   move nem tira o zoom, porque o ponto clicado ja esta visivel.
 * - Enquadra o tracado importado quando `focusKey` muda.
 * - Recalcula o tamanho quando o container muda de dimensao (ex.: etapa do wizard
 *   que estava oculta passa a ser exibida), evitando tiles cinzas.
 */
export default function ErosionMapViewport({ center, zoom, recenterKey, point, focusKey = 0, focusBounds = [] }) {
  const map = useMap();
  const lastRecenterKey = useRef(null);
  // Ultimo centro "desejado": usado para recentralizar quando o mapa, montado
  // numa etapa oculta (0x0), passa a ter tamanho.
  const targetRef = useRef({ center, zoom });
  targetRef.current = { center: isValidPoint(point) ? point : center, zoom };

  useEffect(() => {
    if (!map) return;
    if (lastRecenterKey.current === recenterKey) return;
    lastRecenterKey.current = recenterKey;
    if (isValidPoint(center)) map.setView(center, zoom, { animate: false });
  }, [map, recenterKey, center, zoom]);

  // Enquadra o tracado recem-importado (focusKey muda a cada importacao; comeca
  // em 0, entao um mapa aberto depois da importacao tambem enquadra).
  const lastFocusKey = useRef(0);
  useEffect(() => {
    if (!map || focusKey === lastFocusKey.current) return;
    lastFocusKey.current = focusKey;
    const valid = (focusBounds || []).filter(isValidPoint);
    if (valid.length === 1) map.setView(valid[0], 18, { animate: false });
    else if (valid.length > 1) map.fitBounds(valid, { padding: [24, 24], maxZoom: 18, animate: false });
  }, [map, focusKey, focusBounds]);

  useEffect(() => {
    if (!map || !isValidPoint(point)) return undefined;
    const timer = setTimeout(() => {
      const bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
      if (bounds && typeof bounds.contains === 'function' && bounds.contains(point)) return;
      map.panTo(point, { animate: true });
    }, PAN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [map, point?.[0], point?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || typeof map.getContainer !== 'function') return undefined;
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    let wasHidden = !(container.clientWidth > 0 && container.clientHeight > 0);
    const observer = new ResizeObserver(() => {
      const visible = container.clientWidth > 0 && container.clientHeight > 0;
      map.invalidateSize(false);
      if (visible && wasHidden) {
        // Leaflet calculou o centro (e a posicao dos rotulos das torres) com o
        // container 0x0; `reset` refaz a vista e reposiciona os tooltips.
        const { center: target, zoom: targetZoom } = targetRef.current;
        if (isValidPoint(target)) map.setView(target, targetZoom, { animate: false, reset: true });
      }
      wasHidden = !visible;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

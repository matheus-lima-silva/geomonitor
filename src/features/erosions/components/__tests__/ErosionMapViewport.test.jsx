import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mapMock = {
  setView: vi.fn(),
  panTo: vi.fn(),
  invalidateSize: vi.fn(),
  getContainer: vi.fn(() => document.createElement('div')),
  getBounds: vi.fn(() => ({ contains: (p) => Math.abs(p[0] - -21.83) < 0.01 && Math.abs(p[1] - -47.88) < 0.01 })),
};

vi.mock('react-leaflet', () => ({
  useMap: () => mapMock,
}));

import ErosionMapViewport from '../ErosionMapViewport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ErosionMapViewport', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mapMock).forEach((fn) => fn.mockClear?.());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (props) => act(() => {
    root.render(<ErosionMapViewport zoom={17} recenterKey="P1|104" center={[-21.83, -47.88]} point={null} {...props} />);
  });

  it('centraliza uma vez e nao recentraliza quando so o ponto muda (clique no mapa)', () => {
    render({});
    expect(mapMock.setView).toHaveBeenCalledTimes(1);

    // Ponto clicado dentro da area visivel: nem setView nem pan (mantem o zoom do usuario).
    render({ center: [-21.8301, -47.8801], point: [-21.8301, -47.8801] });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(mapMock.setView).toHaveBeenCalledTimes(1);
    expect(mapMock.panTo).not.toHaveBeenCalled();
  });

  it('recentraliza quando muda a torre', () => {
    render({});
    render({ recenterKey: 'P1|105', center: [-21.84, -47.89] });
    expect(mapMock.setView).toHaveBeenCalledTimes(2);
    expect(mapMock.setView).toHaveBeenLastCalledWith([-21.84, -47.89], 17, { animate: false });
  });

  it('refaz a vista (com reset) quando o mapa montado numa etapa oculta fica visivel', () => {
    const el = document.createElement('div');
    let size = { w: 0, h: 0 };
    Object.defineProperty(el, 'clientWidth', { get: () => size.w });
    Object.defineProperty(el, 'clientHeight', { get: () => size.h });
    mapMock.getContainer.mockReturnValue(el);
    let resizeCb = null;
    const originalRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class { constructor(cb) { resizeCb = cb; } observe() {} disconnect() {} };
    try {
      render({ point: [-21.828227, -47.880947] });
      mapMock.setView.mockClear();
      size = { w: 600, h: 320 };
      act(() => { resizeCb(); });
      expect(mapMock.invalidateSize).toHaveBeenCalled();
      expect(mapMock.setView).toHaveBeenCalledWith([-21.828227, -47.880947], 17, { animate: false, reset: true });
    } finally {
      globalThis.ResizeObserver = originalRO;
      mapMock.getContainer.mockImplementation(() => document.createElement('div'));
    }
  });

  it('faz pan com debounce quando o ponto sai da area visivel (coordenada digitada)', () => {
    render({});
    render({ point: [-21.5, -47.5] });
    render({ point: [-21.9, -47.9] });
    expect(mapMock.panTo).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(700); });
    expect(mapMock.panTo).toHaveBeenCalledTimes(1);
    expect(mapMock.panTo).toHaveBeenCalledWith([-21.9, -47.9], { animate: true });
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => ({ default: { divIcon: (opts) => opts } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Polyline: () => null,
  useMap: () => null,
}));

import PhotoLocationMiniMap from '../PhotoLocationMiniMap';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

function mount(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(ui); });
}

afterEach(() => {
  act(() => { root?.unmount(); });
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

describe('PhotoLocationMiniMap', () => {
  it('renderiza mapa, legenda e distancia com torre + foto', () => {
    mount(
      <PhotoLocationMiniMap
        towerPoint={[-23.879, -46.531]}
        photoPoint={[-23.879, -46.5313]}
        towerLabel="606"
        distanceMeters={35}
      />,
    );
    expect(container.querySelector('[data-testid="map"]')).toBeTruthy();
    expect(container.textContent).toContain('Torre 606');
    expect(container.textContent).toContain('Foto avaliada');
    expect(container.textContent).toContain('35 m');
  });

  it('nao renderiza nada sem nenhum ponto', () => {
    mount(<PhotoLocationMiniMap towerPoint={null} photoPoint={null} />);
    expect(container.querySelector('[data-testid="map"]')).toBeFalsy();
    expect(container.textContent).toBe('');
  });
});

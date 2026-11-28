import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Polyline: ({ eventHandlers }) => <span data-testid="segment" onClick={() => eventHandlers?.click?.()} />,
  Popup: ({ children }) => <div>{children}</div>,
  LayersControl: Object.assign(({ children }) => <div>{children}</div>, { BaseLayer: ({ children }) => <div>{children}</div> }),
  useMap: () => null,
}));

const service = vi.hoisted(() => ({
  listTowerAccesses: vi.fn(),
  previewTowerAccesses: vi.fn(),
  createTowerAccesses: vi.fn(),
  updateTowerAccess: vi.fn(),
  deleteTowerAccess: vi.fn(),
}));
vi.mock('../../services/towerAccessService', () => service);

import ProjectAccessesModal from '../ProjectAccessesModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LINE = [[-47, -21], [-47, -21.001], [-47, -21.002]];
const project = { id: 'ARAPCA', nome: 'Araraquara - Pocos', torresCoordenadas: [{ numero: '104', latitude: '-21.002', longitude: '-47' }] };
const links = { preview: { href: 'http://api/p/accesses/preview', method: 'POST' }, create: { href: 'http://api/p/accesses', method: 'POST' } };

const KML = `<kml xmlns="http://earth.google.com/kml/2.2"><Document>
<Placemark><name>Acessos DOPD.O</name><LineString><coordinates>-47,-21 -47,-21.001 -47,-21.002</coordinates></LineString></Placemark>
<Placemark><name>Longe</name><LineString><coordinates>-45,-20 -45,-20.001</coordinates></LineString></Placemark>
</Document></kml>`;

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('ProjectAccessesModal', () => {
  let container;
  let root;

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('lista os acessos gravados com o resumo dos trechos', async () => {
    service.listTowerAccesses.mockResolvedValue({
      items: [{
        id: 'ACC-1', kind: 'acesso', towerNumber: '104', name: 'Acesso T104', lengthM: 1290,
        segments: [{ tipo: 'terra', comprimentoM: 1000, coordinates: LINE }, { tipo: 'acesso', comprimentoM: 290, coordinates: LINE }],
        _links: { update: { href: 'u', method: 'PUT' }, delete: { href: 'd', method: 'DELETE' } },
      }],
      links,
    });
    act(() => { root.render(<ProjectAccessesModal project={project} onClose={vi.fn()} />); });
    await flush();
    const list = container.querySelector('[data-testid="access-list"]');
    expect(list.textContent).toContain('Torre 104');
    expect(list.textContent).toContain('1 km de estrada de terra + 290 m de acesso');
  });

  it('importa, mostra a previa e grava so os selecionados', async () => {
    service.listTowerAccesses.mockResolvedValue({ items: [], links });
    service.previewTowerAccesses.mockResolvedValue({
      items: [
        { featureId: 'f0', name: 'Acessos DOPD.O', action: 'acesso', towerNumber: '104', relation: 'ponta', lengthM: 222, geometry: { type: 'LineString', coordinates: LINE }, segments: [{ tipo: 'terra', comprimentoM: 150, coordinates: LINE, inferido: true }, { tipo: 'acesso', comprimentoM: 72, coordinates: LINE }], flags: ['tipo_inferido'] },
        { featureId: 'f1', name: 'Longe', action: 'ignorar', towerNumber: null, relation: 'longe', lengthM: 111, geometry: { type: 'LineString', coordinates: [[-45, -20], [-45, -20.001]] }, segments: [{ tipo: 'acesso', comprimentoM: 111, coordinates: [[-45, -20], [-45, -20.001]] }], flags: [] },
      ],
      meta: { osmLoaded: true, totals: { acesso: 1, ignorar: 1 } },
    });
    service.createTowerAccesses.mockResolvedValue([]);

    act(() => { root.render(<ProjectAccessesModal project={project} onClose={vi.fn()} />); });
    await flush();

    const input = container.querySelector('[data-testid="project-accesses-file"]');
    const file = new File([KML], 'acessos.kml');
    file.arrayBuffer = async () => new TextEncoder().encode(KML).buffer;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush();

    expect(service.previewTowerAccesses).toHaveBeenCalledTimes(1);
    const sentFeatures = service.previewTowerAccesses.mock.calls[0][1];
    expect(sentFeatures).toHaveLength(2);
    expect(container.textContent).toContain('Tipo de via inferido');

    // Repinta o primeiro trecho: seleciona a linha e clica no trecho.
    const row = [...container.querySelectorAll('[role="button"]')].find((el) => el.textContent.includes('Acessos DOPD.O'));
    act(() => { row.click(); });
    expect(container.querySelector('[data-testid="access-review-detail"]')).toBeTruthy();
    const [firstSegment] = container.querySelectorAll('[data-testid="segment"]');
    act(() => { firstSegment.click(); });

    const save = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Gravar 1 selecionado'));
    await act(async () => { save.click(); });
    await flush();

    expect(service.createTowerAccesses).toHaveBeenCalledTimes(1);
    const [, items, replaceIds] = service.createTowerAccesses.mock.calls[0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ towerNumber: '104', kind: 'acesso', name: 'Acessos DOPD.O' });
    expect(items[0].segments[0]).toMatchObject({ tipo: 'acesso', manual: true });
    expect(items[0].source).toMatchObject({ arquivo: 'acessos.kml', formato: 'kml' });
    expect(replaceIds).toEqual([]);
  });
});

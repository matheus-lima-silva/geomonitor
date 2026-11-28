import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErosionGeometryImport from '../ErosionGeometryImport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LINE_KML = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><name>Trecho erodido</name><LineString><coordinates>-47.0,-21.0 -47.0,-21.001 -47.001,-21.001</coordinates></LineString></Placemark>
</Document></kml>`;

const TWO_FEATURES_KML = `<kml xmlns="http://earth.google.com/kml/2.2"><Document>
<Placemark><name>Acesso</name><LineString><coordinates>-47.0,-21.0 -47.0,-21.002</coordinates></LineString></Placemark>
<Placemark><name>Area erodida</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-47,-21 -46.9995,-21 -46.9995,-20.9995 -47,-21</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;

function fileOf(text, name) {
  const file = new File([text], name, { type: 'application/xml' });
  // jsdom nem sempre implementa Blob.arrayBuffer.
  file.arrayBuffer = async () => new TextEncoder().encode(text).buffer;
  return file;
}

async function chooseFile(container, file) {
  const input = container.querySelector('[data-testid="erosion-geometry-file"]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // parse assincrono
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('ErosionGeometryImport', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props = {}) {
    const all = {
      geometria: null,
      geometriaOrigem: null,
      geometriaMetricas: null,
      towerPoint: [-21.0005, -46.9995],
      towerLabel: 'Torre 104',
      showExtensionAction: true,
      onChange: vi.fn(),
      onUsePoint: vi.fn(),
      onUseExtension: vi.fn(),
      onImported: vi.fn(),
      ...props,
    };
    act(() => { root.render(<ErosionGeometryImport {...all} />); });
    return all;
  }

  it('importa direto quando o arquivo tem um unico elemento', async () => {
    const props = render();
    await chooseFile(container, fileOf(LINE_KML, 'trecho.kml'));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    const patch = props.onChange.mock.calls[0][0];
    expect(patch.geometria.type).toBe('LineString');
    expect(patch.geometriaOrigem).toMatchObject({ arquivo: 'trecho.kml', formato: 'kml', feicao: 'Trecho erodido' });
    expect(patch.geometriaMetricas.comprimentoMetros).toBeGreaterThan(200);
    expect(props.onImported).toHaveBeenCalled();
  });

  it('pede para escolher quando o arquivo tem varios elementos', async () => {
    const props = render();
    await chooseFile(container, fileOf(TWO_FEATURES_KML, 'acessos.kml'));
    expect(props.onChange).not.toHaveBeenCalled();
    const select = container.querySelector('#erosion-geometry-feature');
    expect(select.options).toHaveLength(2);
    act(() => {
      select.value = select.options[1].value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const useButton = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Usar este'));
    act(() => { useButton.click(); });
    expect(props.onChange.mock.calls[0][0].geometria.type).toBe('Polygon');
    expect(props.onChange.mock.calls[0][0].geometriaOrigem.feicao).toBe('Area erodida');
  });

  it('oferece ponto do tracado perto da torre, centro e extensao (so como sugestao)', () => {
    const geometria = { type: 'LineString', coordinates: [[-47.0, -21.0], [-47.0, -21.001]] };
    const props = render({ geometria, geometriaMetricas: { comprimentoMetros: 111.2 } });
    expect(container.querySelector('[data-testid="erosion-geometry-summary"]').textContent).toContain('111 m');

    const near = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('mais perto da torre'));
    act(() => { near.click(); });
    const [lat, lon] = props.onUsePoint.mock.calls[0];
    expect(lat).toBeCloseTo(-21.0005, 6);
    expect(lon).toBeCloseTo(-47.0, 6);

    const ext = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('como extensão afetada'));
    act(() => { ext.click(); });
    expect(props.onUseExtension).toHaveBeenCalledWith(111);

    const remove = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Remover traçado'));
    act(() => { remove.click(); });
    expect(props.onChange).toHaveBeenCalledWith({ geometria: null, geometriaOrigem: null, geometriaMetricas: null });
  });

  it('nao oferece extensao fora de acesso', () => {
    render({ geometria: { type: 'LineString', coordinates: [[-47, -21], [-47, -21.001]] }, geometriaMetricas: { comprimentoMetros: 111 }, showExtensionAction: false });
    expect(container.textContent).not.toContain('como extensão afetada');
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InspectionsView from '../InspectionsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const showMock = vi.fn();
const saveInspectionMock = vi.fn();

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { nome: 'Tester', email: 'tester@example.com', displayName: 'Tester', uid: 'uid-1' } }),
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../../../../services/inspectionService', () => ({
  saveInspection: (...args) => saveInspectionMock(...args),
  deleteInspection: vi.fn(),
}));

// EXIF mockado por nome de arquivo: a leitura real e coberta em utils/__tests__/exifMeta.test.js.
const DEG_PER_M_LAT = 1 / 111320;
const towerLat = (n) => -20 + n * 0.003;
const META = {
  'sex.jpg': { gpsLat: towerLat(2) + 10 * DEG_PER_M_LAT, gpsLon: -44, capturedAt: '2026-09-25T09:00:00', capturedDate: '2026-09-25', capturedTime: '09:00', description: 'BMDOPR\n2' },
  'sab.jpg': { gpsLat: towerLat(3) + 10 * DEG_PER_M_LAT, gpsLon: -44, capturedAt: '2026-09-26T09:00:00', capturedDate: '2026-09-26', capturedTime: '09:00', description: 'BMDOPR\n3' },
};
vi.mock('../../../../utils/photoCampaign/exifMeta', () => ({
  readExifMetaFromFile: async (file) => META[file.name] || null,
}));

const PROJECT = {
  id: 'BMDOPR',
  nome: 'Bom Despacho - Ouro Preto',
  torres: '4',
  torresCoordenadas: [
    { numero: '1', latitude: towerLat(1), longitude: -44 },
    { numero: '2', latitude: towerLat(2), longitude: -44 },
    { numero: '2A', latitude: towerLat(2) + 0.001, longitude: -44 },
    { numero: '3', latitude: towerLat(3), longitude: -44 },
  ],
};

function fakeFile(name) {
  return { name, type: 'image/jpeg', size: 10, lastModified: 1, webkitRelativePath: '', slice: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }), arrayBuffer: async () => new ArrayBuffer(0) };
}

async function flush(times = 6) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function changeInput(el, value) {
  const prototype = Object.getPrototypeOf(el);
  const { set } = Object.getOwnPropertyDescriptor(prototype, 'value') || {};
  if (set) set.call(el, value);
  else el.value = value;
  act(() => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function findButton(text, scope = document.body) {
  return [...scope.querySelectorAll('button')].find((item) => item.textContent.includes(text));
}

async function clickByText(text, scope = document.body) {
  const button = findButton(text, scope);
  expect(button, `botao "${text}"`).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
  return button;
}

describe('InspectionFormWizardModal — preencher pelas fotos', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    showMock.mockClear();
    saveInspectionMock.mockReset();
    saveInspectionMock.mockImplementation(async (payload) => ({ ...payload }));
    act(() => {
      root.render(
        <InspectionsView
          inspections={[]}
          projects={[PROJECT]}
          erosions={[]}
          feriados={[]}
          forcedProjectFilterId={null}
          onClearForcedProjectFilter={vi.fn()}
          searchTerm=""
          planningDraft={null}
          onPlanningDraftConsumed={vi.fn()}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it('CTA fica desabilitado sem empreendimento e abre o modal apos escolher um', async () => {
    await clickByText('Nova Vistoria');
    const cta = findButton('Preencher pelas fotos', document.querySelector('[data-testid="photo-autofill-cta-step1"]'));
    expect(cta.disabled).toBe(true);

    changeInput(document.querySelector('#inspection-project'), 'BMDOPR');
    expect(cta.disabled).toBe(false);
    await clickByText('Preencher pelas fotos', document.querySelector('[data-testid="photo-autofill-cta-step1"]'));
    expect(document.querySelector('[data-testid="photo-autofill-pick"]')).toBeTruthy();
  });

  it('aplica o diario pelas fotos, mantem o sabado com torres ao reeditar as datas e salva o payload', async () => {
    await clickByText('Nova Vistoria');
    changeInput(document.querySelector('#inspection-project'), 'BMDOPR');
    await clickByText('Preencher pelas fotos', document.querySelector('[data-testid="photo-autofill-cta-step1"]'));

    const input = document.querySelector('#inspection-photo-autofill-folder');
    Object.defineProperty(input, 'files', { value: [fakeFile('sex.jpg'), fakeFile('sab.jpg')], configurable: true });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clickByText('Analisar fotos');
    await flush();
    expect(document.querySelector('[data-testid="photo-autofill-review"]')).toBeTruthy();
    await clickByText('Aplicar ao diário');

    // Modal fechou, wizard foi para o passo 2 com os dois dias (sexta e sabado).
    expect(document.querySelector('[data-testid="photo-autofill-review"]')).toBeNull();
    expect(document.querySelector('[data-testid="photo-autofill-cta-step2"]')).toBeTruthy();
    const dayCards = [...document.querySelectorAll('article')].filter((a) => /\d{2}\/\d{2}\/\d{4}/.test(a.textContent));
    expect(dayCards.some((a) => a.textContent.includes('25/09/2026'))).toBe(true);
    expect(dayCards.some((a) => a.textContent.includes('26/09/2026'))).toBe(true);
    expect(showMock).toHaveBeenCalledWith(expect.stringContaining('Diario preenchido pelas fotos'), 'success');

    // Picker de torres usa torresCoordenadas (inclui "2A").
    expect([...document.querySelectorAll('button')].some((b) => /\b2A\b/.test(b.textContent))).toBe(true);

    // Reeditar a data fim no passo 1 nao apaga o sabado com torres.
    await clickByText('1. Dados gerais');
    changeInput(document.querySelector('#inspection-date-end'), '2026-09-28');
    await clickByText('2. Diario');
    const afterEdit = [...document.querySelectorAll('article')].filter((a) => /\d{2}\/\d{2}\/\d{4}/.test(a.textContent));
    expect(afterEdit.some((a) => a.textContent.includes('26/09/2026'))).toBe(true);
    expect(afterEdit.some((a) => a.textContent.includes('28/09/2026'))).toBe(true);

    // Salva: payload traz os dias com as torres resolvidas.
    await clickByText('3. Revisao');
    await clickByText('Salvar vistoria');
    await flush(3);
    expect(saveInspectionMock).toHaveBeenCalledTimes(1);
    const payload = saveInspectionMock.mock.calls[0][0];
    expect(payload.dataInicio).toBe('2026-09-25');
    expect(payload.dataFim).toBe('2026-09-28');
    const byDate = Object.fromEntries(payload.detalhesDias.map((d) => [d.data, d.torres]));
    expect(byDate['2026-09-25']).toEqual(['2']);
    expect(byDate['2026-09-26']).toEqual(['3']);
    expect(byDate['2026-09-28']).toEqual([]);
  });
});

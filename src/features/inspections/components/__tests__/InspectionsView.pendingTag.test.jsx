import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InspectionsView from '../InspectionsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const showMock = vi.fn();
const saveInspectionMock = vi.fn();
const deleteInspectionMock = vi.fn();

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { nome: 'Tester', email: 'tester@example.com', displayName: 'Tester', uid: 'uid-1' },
  }),
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../../../../services/inspectionService', () => ({
  saveInspection: (...args) => saveInspectionMock(...args),
  deleteInspection: (...args) => deleteInspectionMock(...args),
}));

const PROJECTS = [{ id: 'P1', nome: 'Projeto 1', torres: '50' }];
// A: vistoria de origem (mais antiga). B: vistoria posterior.
const INSPECTION_A = { id: 'VS-P1-07052026-0001', projetoId: 'P1', dataInicio: '2026-05-07', dataFim: '2026-05-08', detalhesDias: [] };
const INSPECTION_B = { id: 'VS-P1-12082026-0001', projetoId: 'P1', dataInicio: '2026-08-12', dataFim: '2026-08-13', detalhesDias: [] };

function renderView(root, props = {}) {
  const baseProps = {
    inspections: [INSPECTION_A, INSPECTION_B],
    projects: PROJECTS,
    erosions: [],
    forcedProjectFilterId: null,
    onClearForcedProjectFilter: vi.fn(),
    searchTerm: '',
    planningDraft: null,
    onPlanningDraftConsumed: vi.fn(),
    ...props,
  };
  act(() => {
    root.render(<InspectionsView {...baseProps} />);
  });
  return baseProps;
}

function findCard(container, id) {
  return [...container.querySelectorAll('article')].find((el) => el.textContent.includes(id));
}

describe('InspectionsView pending erosion tag', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    showMock.mockReset();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('hides the tag on the inspection of origin and shows it on later inspections', () => {
    renderView(root, {
      erosions: [
        {
          id: 'ER-1',
          projetoId: 'P1',
          torreRef: '610',
          vistoriaId: INSPECTION_A.id,
          vistoriaIds: [INSPECTION_A.id],
          pendenciasVistoria: [{ vistoriaId: INSPECTION_A.id, status: 'pendente', dia: '' }],
        },
      ],
    });

    const originCard = findCard(container, INSPECTION_A.id);
    const laterCard = findCard(container, INSPECTION_B.id);
    expect(originCard).toBeTruthy();
    expect(laterCard).toBeTruthy();

    expect(originCard.textContent).not.toContain('Erosoes sem data de visita');
    expect(laterCard.textContent).toContain('Erosoes sem data de visita');
    expect(laterCard.textContent).toContain('Torre 610');
  });

  it('clears the tag on a later inspection once the visit has a date', () => {
    renderView(root, {
      erosions: [
        {
          id: 'ER-1',
          projetoId: 'P1',
          torreRef: '610',
          vistoriaId: INSPECTION_A.id,
          vistoriaIds: [INSPECTION_A.id, INSPECTION_B.id],
          pendenciasVistoria: [
            { vistoriaId: INSPECTION_A.id, status: 'pendente', dia: '' },
            { vistoriaId: INSPECTION_B.id, status: 'visitada', dia: '12/08/2026' },
          ],
        },
      ],
    });

    const originCard = findCard(container, INSPECTION_A.id);
    const laterCard = findCard(container, INSPECTION_B.id);
    expect(originCard.textContent).not.toContain('Erosoes sem data de visita');
    expect(laterCard.textContent).not.toContain('Erosoes sem data de visita');
  });
});

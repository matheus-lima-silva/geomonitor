import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do erosionService — evita chamadas de rede e controla o snapshot.
vi.mock('../../../../../services/erosionService', () => ({
  subscribeErosions: vi.fn((onData) => {
    onData([
      { id: 'E-01', projectId: 'PRJ-01', torreRef: 'T-02', criticalityCode: 'C2', status: 'Ativa' },
      { id: 'E-02', projectId: 'PRJ-01', torreRef: 'T-05', criticalityCode: 'C3' },
      { id: 'E-03', projectId: 'PRJ-02', torreRef: 'T-01', criticalityCode: 'C1' },
    ]);
    return () => {};
  }),
}));

import StepFichasErosao from '../StepFichasErosao';

describe('StepFichasErosao', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function render(props = {}) {
    const draft = {
      anexoFichasMode: 'none',
      anexoFichasErosionIds: [],
      ...(props.draft || {}),
    };
    const onChange = props.onChange || vi.fn();
    const workspaces = props.workspaces || [
      { id: 'RW-1', projectId: 'PRJ-01' },
    ];
    const compound = props.compound ?? { id: 'RC-1', workspaceIds: ['RW-1'] };
    const pendingWorkspaceIds = props.pendingWorkspaceIds || [];
    act(() => {
      root.render(
        <StepFichasErosao
          draft={draft}
          onChange={onChange}
          compound={compound}
          workspaces={workspaces}
          pendingWorkspaceIds={pendingWorkspaceIds}
        />,
      );
    });
    return { draft, onChange };
  }

  it('default mode none, contador em zero', () => {
    render();
    expect(container.textContent).toContain('0 ficha(s) serão anexadas');
  });

  it('mode all mostra total das erosoes do projeto vinculado', () => {
    render({ draft: { anexoFichasMode: 'all', anexoFichasErosionIds: [] } });
    // Apenas erosoes de PRJ-01 (2) sao candidatas
    expect(container.textContent).toContain('2 ficha(s) serão anexadas');
  });

  it('mode selected renderiza checkboxes das erosoes candidatas', () => {
    render({ draft: { anexoFichasMode: 'selected', anexoFichasErosionIds: [] } });
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  it('clicar em checkbox chama onChange marcando o id', () => {
    const onChange = vi.fn();
    render({
      draft: { anexoFichasMode: 'selected', anexoFichasErosionIds: [] },
      onChange,
    });
    const firstCheckbox = container.querySelector('input[type="checkbox"]');
    act(() => {
      firstCheckbox.click();
    });
    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const nextDraft = updater({ anexoFichasErosionIds: [] });
    expect(nextDraft.anexoFichasErosionIds.length).toBe(1);
  });

  it('sem workspaces vinculados nao lista candidatos', () => {
    render({
      draft: { anexoFichasMode: 'selected', anexoFichasErosionIds: [] },
      workspaces: [],
      compound: { id: 'RC-X', workspaceIds: [] },
      pendingWorkspaceIds: [],
    });
    expect(container.textContent).toContain('Nenhuma erosão disponível');
  });
});

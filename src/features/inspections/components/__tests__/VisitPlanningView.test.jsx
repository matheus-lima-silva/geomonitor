import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VisitPlanningView from '../VisitPlanningView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const currentYear = new Date().getFullYear();

function sampleFeriados() {
  return [
    { data: `${currentYear}-04-21`, nome: 'Tiradentes', tipo: 'nacional' },
    { data: `${currentYear}-05-01`, nome: 'Dia do Trabalho', tipo: 'nacional' },
    { data: '2099-12-25', nome: 'Natal longe', tipo: 'nacional' },
  ];
}

describe('VisitPlanningView — feriados', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renderiza alerta listando feriados do ano atual', () => {
    act(() => {
      root.render(
        <VisitPlanningView
          projects={[{ id: 'P1', nome: 'Projeto 1', torres: 10 }]}
          inspections={[]}
          erosions={[]}
          feriados={sampleFeriados()}
          onApplySelection={() => {}}
        />,
      );
    });

    const alert = container.querySelector('[data-testid="visit-planning-feriados-alert"]');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Tiradentes');
    expect(alert.textContent).toContain('Dia do Trabalho');
    expect(alert.textContent).not.toContain('Natal longe');
  });

  it('nao exibe alerta quando nao ha feriados para o ano', () => {
    act(() => {
      root.render(
        <VisitPlanningView
          projects={[{ id: 'P1', nome: 'Projeto 1', torres: 10 }]}
          inspections={[]}
          erosions={[]}
          feriados={[{ data: '2099-12-25', nome: 'Natal longe', tipo: 'nacional' }]}
          onApplySelection={() => {}}
        />,
      );
    });

    expect(container.querySelector('[data-testid="visit-planning-feriados-alert"]')).toBeFalsy();
  });

  it('alerta pode ser dispensado', () => {
    act(() => {
      root.render(
        <VisitPlanningView
          projects={[{ id: 'P1', nome: 'Projeto 1', torres: 10 }]}
          inspections={[]}
          erosions={[]}
          feriados={sampleFeriados()}
          onApplySelection={() => {}}
        />,
      );
    });

    const alert = container.querySelector('[data-testid="visit-planning-feriados-alert"]');
    const closeButton = alert.querySelector('button[aria-label="Dispensar alerta de feriados"]');
    expect(closeButton).toBeTruthy();

    act(() => { closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(container.querySelector('[data-testid="visit-planning-feriados-alert"]')).toBeFalsy();
  });
});

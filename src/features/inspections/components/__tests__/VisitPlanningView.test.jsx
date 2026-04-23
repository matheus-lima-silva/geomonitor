import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VisitPlanningView from '../VisitPlanningView';

function setSelectValue(select, value) {
  const nativeDescriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
  if (nativeDescriptor?.set) nativeDescriptor.set.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function makeTowerDays(prefix, count) {
  return [{ torresDetalhadas: Array.from({ length: count }, (_, k) => ({ numero: `${prefix}-${k + 1}` })) }];
}

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

  it('renderiza linha Ritmo historico no stats box quando projeto tem >= 2 vistorias com dados', async () => {
    const inspections = [
      {
        id: 'i1', projetoId: 'P1',
        dataInicio: '2026-04-06', dataFim: '2026-04-10', // seg-sex = 5 dias uteis
        detalhesDias: makeTowerDays('A', 10),
      },
      {
        id: 'i2', projetoId: 'P1',
        dataInicio: '2026-04-13', dataFim: '2026-04-15', // seg-qua = 3 dias uteis
        detalhesDias: makeTowerDays('B', 6),
      },
    ];

    await act(async () => {
      root.render(
        <VisitPlanningView
          projects={[{ id: 'P1', nome: 'Projeto 1', torres: 10 }]}
          inspections={inspections}
          erosions={[]}
          feriados={[]}
          onApplySelection={() => {}}
        />,
      );
    });

    const select = container.querySelector('#visit-project');
    await act(async () => { setSelectValue(select, 'P1'); });

    // 10+6 torres / (5+3) dias = 16/8 = 2.0 torres/dia util
    expect(container.textContent).toContain('Ritmo historico');
    expect(container.textContent).toContain('2.0 torres/dia util');
    expect(container.textContent).toContain('deste projeto');
  });

  it('exibe S/D no stats box quando projeto nao tem historico suficiente e global tambem insuficiente', async () => {
    await act(async () => {
      root.render(
        <VisitPlanningView
          projects={[{ id: 'P1', nome: 'Projeto 1', torres: 10 }]}
          inspections={[]}
          erosions={[]}
          feriados={[]}
          onApplySelection={() => {}}
        />,
      );
    });

    const select = container.querySelector('#visit-project');
    await act(async () => { setSelectValue(select, 'P1'); });

    expect(container.textContent).toContain('Ritmo historico');
    expect(container.textContent).toContain('S/D');
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

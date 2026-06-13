import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ActivitiesSection from '../editor/ActivitiesSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function baseReport(overrides = {}) {
  return {
    id: 'MR-1',
    refYear: 2026,
    refMonth: 4,
    holidays: [{ date: '2026-04-21', name: 'Tiradentes' }],
    engineers: [
      {
        id: 'MRE-1',
        name: 'Matheus Lima',
        sortOrder: 0,
        activities: [
          { id: 'MRA-1', category: 'vistoria', description: 'Vistoria LT 500', startDate: '2026-04-16', endDate: '2026-04-17' },
        ],
        projects: [
          { id: 'MRP-1', name: 'LT 500 kV', description: 'Resumo do projeto', sortOrder: 0 },
        ],
      },
      { id: 'MRE-2', name: 'Victor Britto', sortOrder: 1, activities: [], projects: [] },
    ],
    ...overrides,
  };
}

// Harness com estado real: updateReport aplica o mutator no report e re-renderiza.
function Harness({ initial }) {
  const [report, setReport] = useState(initial);
  return (
    <ActivitiesSection
      report={report}
      updateReport={(mutator) => setReport((r) => mutator(r))}
    />
  );
}

describe('ActivitiesSection', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'prompt').mockReturnValue('Feriado teste');
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
  });

  async function render(report = baseReport()) {
    await act(async () => {
      root.render(<Harness initial={report} />);
    });
  }

  function setInputValue(input, value) {
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }

  it('renderiza calendario com a barra da atividade, feriado e legenda', async () => {
    await render();
    const bar = container.querySelector('[data-activity-bar]');
    expect(bar).toBeTruthy();
    expect(bar.textContent).toContain('Vistoria LT 500');
    expect(container.textContent).toContain('★ Tiradentes');
    expect(container.textContent).toContain('Vistoria de campo'); // legenda
    expect(container.textContent).toContain('Resumo do projeto');
  });

  it('clicar num dia abre o modal e salvar adiciona a atividade', async () => {
    await render();
    const day = container.querySelector('[data-date="2026-04-22"]');
    await act(async () => {
      day.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Quarta, 22/04/2026');

    const row = dialog.querySelector('[data-testid="activity-row"]');
    await act(async () => {
      setInputValue(row.querySelector('input[aria-label="Descrição"]'), 'Atividade nova');
    });
    const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Salvar');
    await act(async () => {
      saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeFalsy();
    const bars = Array.from(container.querySelectorAll('[data-activity-bar]'));
    expect(bars.some((b) => b.title.includes('Atividade nova'))).toBe(true);
  });

  it('marcar feriado pelo modal atualiza o calendario', async () => {
    await render();
    const day = container.querySelector('[data-date="2026-04-24"]');
    await act(async () => {
      day.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const dialog = document.querySelector('[role="dialog"]');
    const holidayBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Marcar feriado');
    await act(async () => {
      holidayBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(dialog.textContent).toContain('★ Feriado: Feriado teste');
    expect(container.textContent).toContain('Feriado teste');
  });

  it('troca de engenheiro pelo seletor mostra o calendario dele', async () => {
    await render();
    await act(async () => {
      container.querySelector('[data-testid="eng-selector"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const popover = container.querySelector('[data-testid="eng-popover"]');
    const victorBtn = Array.from(popover.querySelectorAll('button')).find((b) => b.textContent === 'Victor Britto');
    await act(async () => {
      victorBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="eng-selector"]').textContent).toContain('Victor Britto');
    expect(container.querySelector('[data-activity-bar]')).toBeFalsy(); // Victor nao tem atividades
  });

  it('adicionar projeto cria item editavel com contagem de caracteres', async () => {
    await render();
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Adicionar projeto'));
    await act(async () => {
      addBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const items = container.querySelectorAll('[data-testid="project-item"]');
    expect(items).toHaveLength(2);

    const textarea = items[1].querySelector('textarea');
    await act(async () => {
      setInputValue(textarea, 'a'.repeat(200));
    });
    expect(items[1].textContent).toContain('200 caracteres · ~3 linhas no Word');
  });

  it('drag & drop: arrastar barra para outro dia copia a atividade', async () => {
    await render();
    const bar = container.querySelector('[data-activity-bar]');
    const target = container.querySelector('[data-date="2026-04-27"]');

    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    await act(async () => {
      const dragStart = new Event('dragstart', { bubbles: true });
      dragStart.dataTransfer = dataTransfer;
      bar.dispatchEvent(dragStart);
      const drop = new Event('drop', { bubbles: true });
      drop.dataTransfer = dataTransfer;
      target.dispatchEvent(drop);
    });

    const bars = Array.from(container.querySelectorAll('[data-activity-bar]'));
    // Copia: a original (16-17) continua e surge a nova em 27-28.
    expect(bars.some((b) => b.title.includes('2026-04-16'))).toBe(true);
    expect(bars.some((b) => b.title.includes('2026-04-27'))).toBe(true);
  });
});

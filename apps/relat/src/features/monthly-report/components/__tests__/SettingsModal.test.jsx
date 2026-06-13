import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';
import SettingsModal, { mergeHolidayEdits, syncEngineersWithTeam } from '../modals/SettingsModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('mergeHolidayEdits', () => {
  it('substitui os feriados do periodo e preserva os de fora', () => {
    const all = [
      { date: '2026-03-01', name: 'Fora do período' },
      { date: '2026-04-21', name: 'Tiradentes' },
    ];
    const rows = [{ date: '2026-05-01', name: 'Dia do Trabalho' }];
    const merged = mergeHolidayEdits(all, rows, '2026-04-16', '2026-05-15');
    expect(merged).toEqual([
      { date: '2026-03-01', name: 'Fora do período' },
      { date: '2026-05-01', name: 'Dia do Trabalho' },
    ]);
  });

  it('deduplica por data e ignora linhas fora do periodo', () => {
    const rows = [
      { date: '2026-04-21', name: 'A' },
      { date: '2026-04-21', name: 'B' },
      { date: '2026-07-01', name: 'Fora' },
    ];
    const merged = mergeHolidayEdits([], rows, '2026-04-16', '2026-05-15');
    expect(merged).toEqual([{ date: '2026-04-21', name: 'A' }]);
  });
});

describe('syncEngineersWithTeam', () => {
  const engineers = [
    { id: 'MRE-1', name: 'Ana', sortOrder: 0, activities: [{ id: 'a' }], projects: [] },
  ];

  it('adiciona engenheiro marcado e remove desmarcado', () => {
    const next = syncEngineersWithTeam(engineers, [
      { id: 'm1', name: 'Ana', inReport: false },
      { id: 'm2', name: 'Bia', inReport: true },
    ]);
    expect(next.map((e) => e.name)).toEqual(['Bia']);
    expect(next[0].id).toMatch(/^MRE-/);
  });

  it('preserva atividades do engenheiro que continua marcado', () => {
    const next = syncEngineersWithTeam(engineers, [{ id: 'm1', name: 'Ana', inReport: true }]);
    expect(next).toHaveLength(1);
    expect(next[0].activities).toHaveLength(1);
  });
});

describe('SettingsModal', () => {
  let container;
  let root;

  const report = {
    id: 'MR-1',
    refYear: 2026,
    refMonth: 4,
    quadroStyle: 'marcador',
    holidays: [],
    engineers: [{ id: 'MRE-1', name: 'Matheus Lima', sortOrder: 0, activities: [], projects: [] }],
  };
  const settings = {
    team: [{ id: 'm1', name: 'Matheus Lima' }],
    contrato: { numero: '30001490', objeto: 'APOIO', contratante: 'AXIA', contratada: 'CONCREMAT' },
  };

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

  async function render(props = {}) {
    const onSaveSettings = vi.fn(async (d) => d);
    const updateReport = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <ToastProvider>
          <SettingsModal
            open
            onClose={onClose}
            settings={settings}
            onSaveSettings={onSaveSettings}
            report={report}
            updateReport={updateReport}
            {...props}
          />
        </ToastProvider>,
      );
    });
    return { onSaveSettings, updateReport, onClose };
  }

  function click(el) {
    return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  }

  it('abre na aba Equipe com o cadastro e o vinculo do mes', async () => {
    await render();
    const dialog = document.querySelector('[role="dialog"]');
    const row = dialog.querySelector('[data-testid="team-row"]');
    expect(row.querySelector('input[type="text"]').value).toBe('Matheus Lima');
    expect(row.querySelector('input[type="checkbox"]').checked).toBe(true);
  });

  it('aba Feriados: preencher feriados RJ adiciona os oficiais do periodo', async () => {
    await render();
    const dialog = document.querySelector('[role="dialog"]');
    await click(dialog.querySelector('[data-testid="settings-tab-feriados"]'));
    const autofillBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent.includes('Preencher feriados RJ'));
    await click(autofillBtn);

    const rows = dialog.querySelectorAll('[data-testid="holiday-row"]');
    expect(rows).toHaveLength(3); // Tiradentes, Sao Jorge, Dia do Trabalho
    expect(dialog.textContent).toContain('3 feriado(s) oficial(is) no período');
  });

  it('aba Quadro: comparar lado a lado renderiza as 3 variantes', async () => {
    await render();
    const dialog = document.querySelector('[role="dialog"]');
    await click(dialog.querySelector('[data-testid="settings-tab-quadro"]'));
    const compareBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent.includes('Comparar lado a lado'));
    await click(compareBtn);
    expect(dialog.querySelectorAll('[data-testid="quadro-table"]')).toHaveLength(3);
  });

  it('salvar grava settings globais e aplica feriados/estilo/equipe no relatorio', async () => {
    const { onSaveSettings, updateReport, onClose } = await render();
    const dialog = document.querySelector('[role="dialog"]');

    // Marca o estilo "barra" e preenche feriados.
    await click(dialog.querySelector('[data-testid="settings-tab-feriados"]'));
    await click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent.includes('Preencher feriados RJ')));
    await click(dialog.querySelector('[data-testid="settings-tab-quadro"]'));
    const barraRadio = dialog.querySelector('[data-testid="quadro-style-barra"] input');
    await act(async () => {
      barraRadio.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Salvar');
    await click(saveBtn);

    expect(onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({
      team: [expect.objectContaining({ name: 'Matheus Lima' })],
      contrato: expect.objectContaining({ numero: '30001490' }),
    }));

    expect(updateReport).toHaveBeenCalledTimes(1);
    const mutated = updateReport.mock.calls[0][0](report);
    expect(mutated.quadroStyle).toBe('barra');
    expect(mutated.holidays.map((h) => h.date)).toEqual(['2026-04-21', '2026-04-23', '2026-05-01']);
    expect(mutated.engineers.map((e) => e.name)).toEqual(['Matheus Lima']);
    expect(onClose).toHaveBeenCalled();
  });
});

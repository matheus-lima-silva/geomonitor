import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/adminSqlService', () => ({
  executeSql: vi.fn(),
  listAudit: vi.fn(async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, links: {} })),
}));

const { executeSql, listAudit } = await import('../../services/adminSqlService');

let SqlExecutorPanel;

function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
    return;
  }
  if (valueSetter) {
    valueSetter.call(element, value);
    return;
  }
  element.value = value;
}

describe('SqlExecutorPanel', () => {
  let container;
  let root;

  beforeEach(async () => {
    ({ default: SqlExecutorPanel } = await import('../SqlExecutorPanel'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    container = null;
    root = null;
    executeSql.mockReset();
    listAudit.mockReset();
    listAudit.mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, links: {} });
  });

  it('renderiza textarea e botao executar', () => {
    act(() => { root.render(<SqlExecutorPanel />); });
    expect(container.querySelector('textarea#admin-sql-input')).toBeTruthy();
    expect(container.textContent).toContain('Executar');
    expect(container.textContent).toContain('Console SQL somente leitura');
  });

  it('chama executeSql e exibe tabela com resultado', async () => {
    executeSql.mockResolvedValueOnce({
      columns: ['id', 'nome'],
      rows: [{ id: 1, nome: 'Alice' }, { id: 2, nome: 'Bob' }],
      rowCount: 2,
      durationMs: 42,
      truncated: false,
    });

    act(() => { root.render(<SqlExecutorPanel />); });

    const textarea = container.querySelector('textarea#admin-sql-input');
    act(() => {
      setNativeValue(textarea, 'SELECT id, nome FROM users');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const executeBtn = buttons.find((btn) => btn.textContent.includes('Executar'));
    expect(executeBtn).toBeTruthy();

    await act(async () => { executeBtn.click(); });
    // espera microtask de executeSql
    await act(async () => { await Promise.resolve(); });

    expect(executeSql).toHaveBeenCalledWith('SELECT id, nome FROM users');
    const table = container.querySelector('[data-testid="admin-sql-result-table"]');
    expect(table).toBeTruthy();
    expect(table.textContent).toContain('Alice');
    expect(table.textContent).toContain('Bob');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('42 ms');
  });

  it('exibe mensagem de erro quando executeSql rejeita', async () => {
    executeSql.mockRejectedValueOnce(new Error('Palavra-chave proibida: INSERT.'));

    act(() => { root.render(<SqlExecutorPanel />); });

    const textarea = container.querySelector('textarea#admin-sql-input');
    act(() => {
      setNativeValue(textarea, 'INSERT INTO x VALUES (1)');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const executeBtn = buttons.find((btn) => btn.textContent.includes('Executar'));

    await act(async () => { executeBtn.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('Palavra-chave proibida: INSERT.');
  });

  it('abre painel de historico e chama listAudit', async () => {
    listAudit.mockResolvedValueOnce({
      items: [{
        id: '1',
        executedBy: 'admin@test.local',
        sqlText: 'SELECT 1',
        rowCount: 1,
        durationMs: 5,
        status: 'success',
        executedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      links: {},
    });

    act(() => { root.render(<SqlExecutorPanel />); });

    const buttons = Array.from(container.querySelectorAll('button'));
    const historyBtn = buttons.find((btn) => btn.textContent.includes('Ver historico'));
    expect(historyBtn).toBeTruthy();

    await act(async () => { historyBtn.click(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(listAudit).toHaveBeenCalled();
    expect(container.textContent).toContain('admin@test.local');
    expect(container.textContent).toContain('SELECT 1');
  });
});

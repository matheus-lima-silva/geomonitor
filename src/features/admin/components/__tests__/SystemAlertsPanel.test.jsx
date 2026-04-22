import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/adminAlertsService', () => ({
  listAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
}));

const { listAlerts, acknowledgeAlert } = await import('../../services/adminAlertsService');

async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

function sampleAlert(overrides = {}) {
  return {
    id: '1',
    type: 'query_count_exceeded',
    payload: {
      method: 'GET',
      url: '/api/report-workspaces/abc',
      status: 200,
      count: 22,
      threshold: 15,
      durationMs: 340,
      userId: 'user@test.local',
    },
    createdAt: '2026-04-22T10:00:00Z',
    acknowledgedAt: null,
    acknowledgedBy: null,
    _links: {
      self: { href: 'http://api.test/api/admin/alerts/1', method: 'GET' },
    },
    ...overrides,
  };
}

describe('SystemAlertsPanel', () => {
  let container;
  let root;
  let SystemAlertsPanel;

  beforeEach(async () => {
    ({ default: SystemAlertsPanel } = await import('../SystemAlertsPanel'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    listAlerts.mockReset();
    acknowledgeAlert.mockReset();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    container = null;
    root = null;
  });

  it('renderiza estado vazio para pendentes quando lista e vazia', async () => {
    listAlerts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      links: {},
    });

    await act(async () => { root.render(<SystemAlertsPanel />); });
    await flush();

    expect(listAlerts).toHaveBeenCalledWith({ status: 'pending', page: 1, limit: 20 });
    expect(container.textContent).toContain('Nenhum alerta pendente');
  });

  it('renderiza linha com payload do alerta', async () => {
    listAlerts.mockResolvedValueOnce({
      items: [sampleAlert()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      links: {},
    });

    await act(async () => { root.render(<SystemAlertsPanel />); });
    await flush();

    expect(container.textContent).toContain('GET');
    expect(container.textContent).toContain('/api/report-workspaces/abc');
    expect(container.textContent).toContain('22 / 15');
    expect(container.textContent).toContain('340 ms');
    expect(container.textContent).toContain('user@test.local');
    expect(container.textContent).toContain('Marcar revisado');
  });

  it('alterna filtro para "Todos" e re-carrega', async () => {
    listAlerts
      .mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        links: {},
      })
      .mockResolvedValueOnce({
        items: [sampleAlert({ id: '2', acknowledgedAt: '2026-04-22T11:00:00Z', acknowledgedBy: 'admin@x' })],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        links: {},
      });

    await act(async () => { root.render(<SystemAlertsPanel />); });
    await flush();

    const allButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.trim() === 'Todos',
    );
    expect(allButton).toBeTruthy();

    await act(async () => { allButton.click(); });
    await flush();

    expect(listAlerts).toHaveBeenLastCalledWith({ status: 'all', page: 1, limit: 20 });
    expect(container.textContent).toContain('Revisado');
    expect(container.textContent).toContain('admin@x');
  });

  it('chama acknowledgeAlert ao clicar "Marcar revisado" e recarrega lista', async () => {
    listAlerts
      .mockResolvedValueOnce({
        items: [sampleAlert()],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        links: {},
      })
      .mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        links: {},
      });
    acknowledgeAlert.mockResolvedValueOnce({ status: 'success' });

    await act(async () => { root.render(<SystemAlertsPanel />); });
    await flush();

    const ackButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.includes('Marcar revisado'),
    );
    expect(ackButton).toBeTruthy();

    await act(async () => { ackButton.click(); });
    await flush();

    expect(acknowledgeAlert).toHaveBeenCalledTimes(1);
    expect(acknowledgeAlert.mock.calls[0][0].id).toBe('1');
    expect(listAlerts).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Nenhum alerta pendente');
  });
});

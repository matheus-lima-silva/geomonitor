import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../services/monthlyReportService', () => {
  class VersionConflictError extends Error {}
  return {
    VersionConflictError,
    fetchByPeriod: vi.fn(),
    saveReport: vi.fn(async (id, data) => ({ ...data, id, version: (data.version || 1) + 1 })),
    generateDocx: vi.fn(),
    getJobStatus: vi.fn(),
    fetchSettings: vi.fn(),
    saveSettings: vi.fn(),
  };
});

import { fetchByPeriod, fetchSettings } from '../services/monthlyReportService';
import { ToastProvider } from '@app/context/ToastContext';
import MonthlyReportPage from '../MonthlyReportPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function page() {
  return (
    <ToastProvider>
      <MonthlyReportPage />
    </ToastProvider>
  );
}

function loadedReport() {
  return {
    id: 'MR-1',
    refYear: 2026,
    refMonth: 4,
    authorName: '',
    status: 'draft',
    version: 1,
    intro: 'Introducao salva',
    conclusao: 'Conclusao salva',
    quadroStyle: 'marcador',
    holidays: [{ date: '2026-04-21', name: 'Tiradentes' }],
    engineers: [{ id: 'MRE-1', name: 'Matheus Lima', sortOrder: 0, activities: [], projects: [] }],
  };
}

describe('MonthlyReportPage', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchSettings.mockResolvedValue({ team: [], contrato: { numero: '', objeto: '', contratante: '', contratada: '' } });
    fetchByPeriod.mockResolvedValue(loadedReport());
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
  });

  it('carrega settings + relatorio e renderiza topbar, cards e periodo', async () => {
    await act(async () => {
      root.render(page());
    });
    // Aguarda settings -> relatorio.
    await act(async () => {});

    expect(container.textContent).toContain('Relatório mensal de serviços');
    expect(container.querySelector('#sec-intro')).toBeTruthy();
    expect(container.querySelector('#sec-ativ')).toBeTruthy();
    expect(container.querySelector('#sec-conc')).toBeTruthy();
    expect(container.querySelector('#intro-text').value).toBe('Introducao salva');
    expect(container.querySelector('#conclusao-text').value).toBe('Conclusao salva');
    // Periodo do mes carregado (maio/2026 -> 16/04 a 15/05), com Tiradentes marcado.
    expect(container.textContent).toContain('Período: 16/04/2026 – 15/05/2026');
    expect(container.textContent).toContain('21 dias úteis');
    expect(container.querySelector('[data-testid="save-status"]')).toBeTruthy();
  });

  it('editar a introducao atualiza o estado do textarea', async () => {
    await act(async () => {
      root.render(page());
    });
    await act(async () => {});

    const textarea = container.querySelector('#intro-text');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(textarea, 'Novo texto');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('#intro-text').value).toBe('Novo texto');
  });

  it('mostra a tela de carregamento de settings antes do editor', async () => {
    let resolveSettings;
    fetchSettings.mockImplementationOnce(() => new Promise((resolve) => { resolveSettings = resolve; }));
    await act(async () => {
      root.render(page());
    });
    expect(container.textContent).toContain('Carregando configurações');
    await act(async () => {
      resolveSettings({ team: [], contrato: {} });
    });
    await act(async () => {});
    expect(container.querySelector('#sec-intro')).toBeTruthy();
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErosionReportPanel from '../ErosionReportPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function clickByText(text, scope = document.body) {
  const button = [...scope.querySelectorAll('button')].find((item) => item.textContent.includes(text));
  expect(button).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('ErosionReportPanel', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('starts collapsed and calls toggle callback', async () => {
    const onToggleCollapsed = vi.fn();

    act(() => {
      root.render(
        <ErosionReportPanel
          reportFilters={{
            projetoId: 'P1',
            ano: '',
            mostrarMultiAno: false,
            anosExtras: [],
          }}
          reportYears={[2026]}
          selectedReportYears={[]}
          onSetFilters={vi.fn()}
          onExportCsv={vi.fn()}
          onExportPdf={vi.fn()}
          onPrintBatchFichasPdf={vi.fn()}
          collapsed
          onToggleCollapsed={onToggleCollapsed}
        />,
      );
    });

    expect(container.textContent).not.toContain('Exportar CSV');
    await clickByText('Expandir', container);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('renders export actions only when expanded', async () => {
    const onPrintBatchFichasPdf = vi.fn();

    act(() => {
      root.render(
        <ErosionReportPanel
          reportFilters={{
            projetoId: 'P1',
            ano: '',
            mostrarMultiAno: false,
            anosExtras: [],
          }}
          reportYears={[2026]}
          selectedReportYears={[]}
          onSetFilters={vi.fn()}
          onExportCsv={vi.fn()}
          onExportPdf={vi.fn()}
          onPrintBatchFichasPdf={onPrintBatchFichasPdf}
          collapsed={false}
          onToggleCollapsed={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Exportar CSV');
    await clickByText('Imprimir fichas (lote)', container);
    expect(onPrintBatchFichasPdf).toHaveBeenCalledTimes(1);
  });
});

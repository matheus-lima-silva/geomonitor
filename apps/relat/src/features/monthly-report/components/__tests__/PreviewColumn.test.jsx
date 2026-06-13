import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PreviewColumn from '../preview/PreviewColumn';
import fixture from '../../../../../../../worker/tests/fixtures/monthly_report_render_model.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('PreviewColumn', () => {
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
  });

  async function render(report = fixture.monthlyReport) {
    await act(async () => {
      root.render(<PreviewColumn report={report} />);
    });
  }

  it('renderiza a folha com a estrutura do documento', async () => {
    await render();
    const sheet = container.querySelector('[data-testid="doc-sheet"]');
    expect(sheet).toBeTruthy();
    expect(sheet.style.fontFamily).toContain('Verdana');
    expect(sheet.textContent).toContain('RELATÓRIO MENSAL DE ACOMPANHAMENTO DOS SERVIÇOS');
    expect(sheet.textContent).toContain('1 INTRODUÇÃO');
    expect(sheet.textContent).toContain('2.1 Atividades que o eng. Matheus Lima realizou');
    expect(sheet.textContent).toContain('3 CONCLUSÃO');
    expect(sheet.textContent).toContain('Classificação: Interna');
    expect(container.querySelectorAll('[data-testid="quadro-table"]')).toHaveLength(2);
  });

  it('quadro variante marcador usa ● no primeiro dia e ↳ na continuacao', async () => {
    await render();
    const tables = container.querySelectorAll('[data-testid="quadro-table"]');
    expect(tables[0].textContent).toContain('●');
    expect(tables[0].textContent).toContain('↳');
    expect(tables[0].textContent).toContain('★ Tiradentes');
  });

  it('controles de zoom respeitam os limites 40-160%', async () => {
    await render();
    const value = () => container.querySelector('[data-testid="zoom-value"]').textContent;
    const zoomIn = container.querySelector('button[aria-label="Ampliar"]');
    const zoomOut = container.querySelector('button[aria-label="Reduzir"]');

    expect(value()).toBe('100%');
    for (let i = 0; i < 10; i += 1) {
      await act(async () => { zoomIn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    }
    expect(value()).toBe('160%');
    for (let i = 0; i < 20; i += 1) {
      await act(async () => { zoomOut.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    }
    expect(value()).toBe('40%');
  });

  it('mostra placeholder italico quando a introducao esta vazia', async () => {
    await render({ ...fixture.monthlyReport, intro: '' });
    expect(container.textContent).toContain('Introdução ainda não escrita');
  });
});

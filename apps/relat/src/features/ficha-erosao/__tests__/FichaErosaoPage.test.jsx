import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

// Aqui testamos so a fiacao da pagina (preencher -> gerar -> baixar). O layout
// do .xlsx tem cobertura propria em utils/__tests__/fichaXlsxBuilder.test.js.
vi.mock('@app/features/reports/utils/reportUtils', () => ({
  triggerBlobDownload: vi.fn(() => true),
}));

import FichaErosaoPage from '../FichaErosaoPage';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';
import { CRITICIDADE_SOLUCOES } from '../utils/fichaXlsxBuilder';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('FichaErosaoPage', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props = {}) {
    act(() => {
      root.render(
        <ToastProvider>
          <FichaErosaoPage onExit={props.onExit || (() => {})} />
        </ToastProvider>,
      );
    });
  }

  function botaoPorTexto(texto) {
    return [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
  }

  function clicar(el) {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('renderiza as secoes da ficha', () => {
    render();
    const titulos = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(titulos).toEqual([
      'Identificação',
      'Localização',
      'Criticidade e situação atual',
      'Tipo / características da feição',
      'Declividade e dimensões',
      'Caracterização',
      'Medida preventiva',
    ]);
  });

  it('gera a ficha e dispara o download', () => {
    render();
    clicar(botaoPorTexto('Gerar ficha .xlsx'));

    expect(triggerBlobDownload).toHaveBeenCalledTimes(1);
    const [nome, blob] = triggerBlobDownload.mock.calls[0];
    expect(nome).toMatch(/^ficha-erosao.*\.xlsx$/);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('usa o numero da ficha no nome do arquivo', () => {
    render();
    const input = container.querySelector('#ficha-num');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '042');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    clicar(botaoPorTexto('Gerar ficha .xlsx'));

    expect(triggerBlobDownload.mock.calls[0][0]).toBe('ficha-erosao-042.xlsx');
  });

  it('usa a torre no nome do arquivo quando nao ha numero de ficha', () => {
    render();
    const torre = container.querySelector('#ficha-torre');
    expect(torre).toBeTruthy();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(torre, '30/31');
      torre.dispatchEvent(new Event('input', { bubbles: true }));
    });
    clicar(botaoPorTexto('Gerar ficha .xlsx'));

    expect(triggerBlobDownload.mock.calls[0][0]).toBe('ficha-erosao-torre-30-31.xlsx');
  });

  it('preenche a medida preventiva com o texto padrao da criticidade', () => {
    render();
    const select = container.querySelector('#ficha-criticidade');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'C3');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    clicar(botaoPorTexto('Usar texto padrão da criticidade'));

    expect(container.querySelector('#ficha-medida').value).toBe(CRITICIDADE_SOLUCOES.C3);
  });

  it('nao preenche a medida preventiva sem criticidade escolhida', () => {
    render();
    clicar(botaoPorTexto('Usar texto padrão da criticidade'));

    expect(container.querySelector('#ficha-medida').value).toBe('');
  });

  it('limpa o formulario', () => {
    render();
    const input = container.querySelector('#ficha-empreendimento');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'LT Teste');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('#ficha-empreendimento').value).toBe('LT Teste');

    clicar(botaoPorTexto('Limpar'));
    expect(container.querySelector('#ficha-empreendimento').value).toBe('');
  });

  it('marca e desmarca opcoes multiplas', () => {
    render();
    const sulco = [...container.querySelectorAll('input[type="checkbox"]')]
      .find((el) => el.value === 'sulco');

    clicar(sulco);
    expect(sulco.checked).toBe(true);
    clicar(sulco);
    expect(sulco.checked).toBe(false);
  });

  it('volta pelo botao Voltar', () => {
    const onExit = vi.fn();
    render({ onExit });
    clicar(botaoPorTexto('Voltar'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

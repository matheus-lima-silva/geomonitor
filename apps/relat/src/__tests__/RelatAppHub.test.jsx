import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

// Sessao autenticada: o hub so aparece com `user` preenchido. O outro arquivo
// (RelatApp.test.jsx) cobre o caminho sem sessao, com o AuthProvider real.
const logout = vi.fn();
vi.mock('@app/context/AuthContext', () => ({
  useAuth: () => ({ user: { nome: 'Matheus Lima', email: 'matheus@exemplo.com' }, loading: false, logout }),
  AuthProvider: ({ children }) => children,
}));

// Os modulos sao arvores pesadas; aqui interessa so qual deles o hub abre.
vi.mock('../features/monthly-report/MonthlyReportPage', () => ({
  default: () => <div data-testid="modulo">monthly-report</div>,
}));
vi.mock('../features/geo/GeoPhotosKmzPage', () => ({
  default: () => <div data-testid="modulo">geo</div>,
}));
vi.mock('../features/paec/PaecPage', () => ({
  default: () => <div data-testid="modulo">paec</div>,
}));
vi.mock('../features/ficha-erosao/FichaErosaoPage', () => ({
  default: () => <div data-testid="modulo">ficha-erosao</div>,
}));

import RelatApp from '../RelatApp';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RelatApp — hub de modulos', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    act(() => {
      root.render(<ToastProvider><RelatApp /></ToastProvider>);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function cartaoDe(nome) {
    return [...container.querySelectorAll('button[aria-label^="Abrir"]')]
      .find((b) => b.getAttribute('aria-label') === `Abrir ${nome}`);
  }

  function clicar(el) {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('lista os quatro modulos como cartoes', () => {
    const cartoes = container.querySelectorAll('button[aria-label^="Abrir"]');
    expect(cartoes).toHaveLength(4);
    expect([...cartoes].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Abrir Relatorio Mensal de Servicos',
      'Abrir Geo - Fotos para KMZ',
      'Abrir PAEC - Planos de Emergencia',
      'Abrir Ficha de Erosao Avulsa',
    ]);
  });

  it('mostra o formato de saida e a dica de cada modulo', () => {
    const texto = container.textContent;
    expect(texto).toContain('.docx');
    expect(texto).toContain('.kmz');
    expect(texto).toContain('.xlsx');
    expect(texto).toContain('Roda sem upload');
    expect(texto).toContain('Uma pagina A4');
  });

  it('identifica o usuario conectado com nome e iniciais', () => {
    expect(container.textContent).toContain('Matheus Lima');
    expect(container.textContent).toContain('ML');
  });

  it.each([
    ['Relatorio Mensal de Servicos', 'monthly-report'],
    ['Geo - Fotos para KMZ', 'geo'],
    ['PAEC - Planos de Emergencia', 'paec'],
    ['Ficha de Erosao Avulsa', 'ficha-erosao'],
  ])('abre o modulo %s', (nome, esperado) => {
    clicar(cartaoDe(nome));
    expect(container.querySelector('[data-testid="modulo"]').textContent).toBe(esperado);
  });

  it('encerra a sessao pelo botao Sair', () => {
    const sair = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Sair');
    clicar(sair);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

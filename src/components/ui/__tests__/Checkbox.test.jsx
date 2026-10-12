import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Checkbox from '../Checkbox';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Checkbox', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('liga o rotulo ao input pelo id e reflete checked', () => {
    act(() => {
      root.render(<Checkbox id="cb-1" label="Manter o dia no diario" checked onChange={() => {}} />);
    });
    const input = container.querySelector('input[type="checkbox"]');
    const label = container.querySelector('label');
    expect(input.id).toBe('cb-1');
    expect(label.getAttribute('for')).toBe('cb-1');
    expect(label.textContent).toBe('Manter o dia no diario');
    expect(input.checked).toBe(true);
    expect(input.className).toContain('accent-brand-600');
    expect(input.className).toContain('focus-visible:ring-brand-500');
  });

  it('dispara onChange ao clicar', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<Checkbox id="cb-2" label="Incluir" checked={false} onChange={onChange} />);
    });
    const input = container.querySelector('input');
    act(() => {
      input.click();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('desabilitado esmaece e bloqueia o input', () => {
    act(() => {
      root.render(<Checkbox id="cb-3" label="Bloqueado" disabled onChange={() => {}} />);
    });
    expect(container.querySelector('input').disabled).toBe(true);
    expect(container.querySelector('span').className).toContain('opacity-50');
  });

  it('sem label renderiza so a caixa (uso em linhas de tabela) e aceita aria-label', () => {
    act(() => {
      root.render(<Checkbox id="cb-4" aria-label="Incluir torre 46" onChange={() => {}} />);
    });
    expect(container.querySelector('label')).toBeNull();
    expect(container.querySelector('input').getAttribute('aria-label')).toBe('Incluir torre 46');
  });

  it('mostra o botao de ajuda quando ha hint', () => {
    act(() => {
      root.render(<Checkbox id="cb-5" label="Ampliar periodo" hint="Inclui os dias das fotos" onChange={() => {}} />);
    });
    const help = container.querySelector('button[aria-label^="Ajuda"]');
    expect(help).toBeTruthy();
  });
});

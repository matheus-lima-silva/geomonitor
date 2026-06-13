import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Modal from '../Modal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Modal', () => {
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

  function render(props) {
    act(() => { root.render(<Modal open onClose={() => {}} {...props} />); });
    return document.querySelector('[role="dialog"]');
  }

  it('renderiza titulo + fechar e, sem icon, header sem surface-muted', () => {
    const dialog = render({ title: 'Título X' });
    expect(dialog.textContent).toContain('Título X');
    expect(dialog.querySelector('[aria-label="Fechar"]')).toBeTruthy();
    expect(dialog.querySelector('.bg-app-surfaceMuted')).toBeNull();
    expect(dialog.querySelector('.bg-brand-50')).toBeNull();
  });

  it('com icon e subtitle renderiza o tile e o subtitulo no header surface-muted', () => {
    const dialog = render({ title: 'Configurações', subtitle: 'Vale para todos os meses', icon: 'settings' });
    expect(dialog.textContent).toContain('Configurações');
    expect(dialog.textContent).toContain('Vale para todos os meses');
    const header = dialog.querySelector('.bg-app-surfaceMuted');
    expect(header).toBeTruthy();
    // tile do icone (fundo brand-50) com um svg dentro
    const tile = header.querySelector('.bg-brand-50');
    expect(tile).toBeTruthy();
    expect(tile.querySelector('svg')).toBeTruthy();
  });

  it('Escape dispara onClose', () => {
    const onClose = vi.fn();
    act(() => { root.render(<Modal open onClose={onClose} title="x" />); });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalled();
  });

  it('open=false nao renderiza o dialog', () => {
    act(() => { root.render(<Modal open={false} onClose={() => {}} title="x" />); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoredCompoundDraft, storageKeyFor } from '../useCompoundDraftAutoSave';

function Harness({ userEmail }) {
  const { draft, savedAt, reload, clear } = useStoredCompoundDraft(userEmail);
  return (
    <div>
      <span data-testid="nome">{draft?.nome || ''}</span>
      <span data-testid="savedAt">{savedAt || ''}</span>
      <button data-testid="reload" onClick={reload}>reload</button>
      <button data-testid="clear" onClick={clear}>clear</button>
    </div>
  );
}

describe('useStoredCompoundDraft', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('le o rascunho ja salvo no mount', () => {
    const key = storageKeyFor('a@b.com');
    window.localStorage.setItem(key, JSON.stringify({
      draft: { nome: 'Stored' },
      savedAt: '2026-04-22T10:00:00.000Z',
    }));
    act(() => root.render(<Harness userEmail="a@b.com" />));
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('Stored');
    expect(container.querySelector('[data-testid="savedAt"]').textContent).toBe('2026-04-22T10:00:00.000Z');
  });

  it('retorna null quando nao ha rascunho', () => {
    act(() => root.render(<Harness userEmail="sem@draft.com" />));
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('');
  });

  it('clear remove do localStorage e limpa o estado', () => {
    const key = storageKeyFor('c@d.com');
    window.localStorage.setItem(key, JSON.stringify({ draft: { nome: 'X' } }));
    act(() => root.render(<Harness userEmail="c@d.com" />));
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('X');
    act(() => container.querySelector('[data-testid="clear"]').click());
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('');
  });

  it('reload pega mudanca feita diretamente no localStorage', () => {
    const key = storageKeyFor('e@f.com');
    act(() => root.render(<Harness userEmail="e@f.com" />));
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('');
    window.localStorage.setItem(key, JSON.stringify({ draft: { nome: 'Novo' } }));
    act(() => container.querySelector('[data-testid="reload"]').click());
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('Novo');
  });

  it('reage a evento storage disparado por outra aba', () => {
    const key = storageKeyFor('g@h.com');
    act(() => root.render(<Harness userEmail="g@h.com" />));
    window.localStorage.setItem(key, JSON.stringify({ draft: { nome: 'FromTab' } }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: window.localStorage.getItem(key),
      }));
    });
    expect(container.querySelector('[data-testid="nome"]').textContent).toBe('FromTab');
  });
});

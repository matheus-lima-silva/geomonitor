import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCompoundDraftAutoSave, { storageKeyFor } from '../useCompoundDraftAutoSave';

function Harness({ initial, userEmail, onStatusChange }) {
  const [draft, setDraft] = useState(initial);
  const { status, savedAt, loadSaved, clearSaved } = useCompoundDraftAutoSave(draft, { userEmail });
  // Exponho refs por atributos no DOM para os testes observarem.
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="saved-at">{savedAt ? 'has' : 'none'}</span>
      <button
        data-testid="set"
        onClick={() => {
          setDraft({ ...draft, nome: 'changed' });
          if (onStatusChange) onStatusChange('changed');
        }}
      >set</button>
      <button data-testid="load" onClick={() => { window.__loaded = loadSaved(); }}>load</button>
      <button data-testid="clear" onClick={() => clearSaved()}>clear</button>
    </div>
  );
}

describe('useCompoundDraftAutoSave', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('salva no localStorage apos debounce de 1.5s', () => {
    act(() => {
      root.render(<Harness initial={{ nome: '' }} userEmail="x@y" />);
    });
    const key = storageKeyFor('x@y');

    act(() => { container.querySelector('[data-testid="set"]').click(); });
    expect(container.querySelector('[data-testid="status"]').textContent).toBe('saving');
    expect(window.localStorage.getItem(key)).toBeNull();

    act(() => { vi.advanceTimersByTime(1500); });
    expect(container.querySelector('[data-testid="status"]').textContent).toBe('saved');
    const saved = JSON.parse(window.localStorage.getItem(key));
    expect(saved?.draft?.nome).toBe('changed');
    expect(typeof saved?.savedAt).toBe('string');
  });

  it('loadSaved devolve o conteudo salvo', () => {
    const key = storageKeyFor('u@u');
    window.localStorage.setItem(key, JSON.stringify({ draft: { nome: 'stored' }, savedAt: new Date().toISOString() }));
    act(() => {
      root.render(<Harness initial={{ nome: '' }} userEmail="u@u" />);
    });
    act(() => { container.querySelector('[data-testid="load"]').click(); });
    expect(window.__loaded?.draft?.nome).toBe('stored');
    delete window.__loaded;
  });

  it('clearSaved remove do localStorage', () => {
    const key = storageKeyFor('u@u');
    window.localStorage.setItem(key, JSON.stringify({ draft: { nome: 'stored' } }));
    act(() => {
      root.render(<Harness initial={{ nome: '' }} userEmail="u@u" />);
    });
    act(() => { container.querySelector('[data-testid="clear"]').click(); });
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('primeiro render nao salva (idle), apenas mutacoes subsequentes', () => {
    act(() => {
      root.render(<Harness initial={{ nome: 'hello' }} userEmail="x@y" />);
    });
    const key = storageKeyFor('x@y');
    expect(container.querySelector('[data-testid="status"]').textContent).toBe('idle');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(window.localStorage.getItem(key)).toBeNull();
  });
});

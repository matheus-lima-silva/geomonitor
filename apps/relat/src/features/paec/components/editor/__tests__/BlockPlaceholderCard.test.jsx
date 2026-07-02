import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import BlockPlaceholderCard from '../BlockPlaceholderCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockPlaceholderCard', () => {
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
    vi.restoreAllMocks();
  });

  it('mostra o label do bloco e o aviso de edicao futura', async () => {
    await act(async () => {
      root.render(<BlockPlaceholderCard block={{ key: 'brigadistas', kind: 'list', label: 'Relação de brigadistas' }} />);
    });
    expect(container.textContent).toContain('Relação de brigadistas');
    expect(container.textContent).toContain('Edição chega em breve');
  });
});

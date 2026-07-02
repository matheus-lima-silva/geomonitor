import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import SectionCard from '../SectionCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SectionCard', () => {
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

  it('renderiza o numero, titulo e o id de ancora para scroll-spy', async () => {
    await act(async () => {
      root.render(
        <SectionCard id="paec-section-0-id" number={1} title="Identificação da instalação">
          <p>conteudo</p>
        </SectionCard>,
      );
    });
    const section = container.querySelector('#paec-section-0-id');
    expect(section).not.toBeNull();
    expect(section.textContent).toContain('1');
    expect(section.textContent).toContain('Identificação da instalação');
    expect(section.textContent).toContain('conteudo');
  });
});

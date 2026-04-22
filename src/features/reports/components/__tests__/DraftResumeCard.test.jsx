import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DraftResumeCard from '../DraftResumeCard';

describe('DraftResumeCard', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('nao renderiza quando draft e null', () => {
    act(() => root.render(<DraftResumeCard draft={null} onResume={vi.fn()} onDiscard={vi.fn()} />));
    expect(container.querySelector('[data-testid="compound-draft-resume"]')).toBeNull();
  });

  it('nao renderiza quando draft nao tem nome', () => {
    act(() => root.render(<DraftResumeCard draft={{ nome: '   ' }} onResume={vi.fn()} onDiscard={vi.fn()} />));
    expect(container.querySelector('[data-testid="compound-draft-resume"]')).toBeNull();
  });

  it('renderiza o nome do rascunho e dispara callbacks', () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    act(() => root.render(
      <DraftResumeCard
        draft={{ nome: 'Rascunho X' }}
        savedAt="2026-04-22T10:00:00.000Z"
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    ));
    const card = container.querySelector('[data-testid="compound-draft-resume"]');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Rascunho X');
    expect(card.textContent).toContain('Rascunho em andamento');

    act(() => container.querySelector('[data-testid="compound-draft-resume-btn"]').click());
    expect(onResume).toHaveBeenCalledTimes(1);

    act(() => container.querySelector('[data-testid="compound-draft-discard"]').click());
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

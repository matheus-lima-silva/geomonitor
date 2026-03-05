import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Button from '../Button';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Button', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
  });

  it('includes visible keyboard focus classes by default', () => {
    act(() => {
      root.render(<Button>Salvar</Button>);
    });

    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.className).toContain('focus-visible:ring-2');
    expect(button.className).toContain('focus-visible:ring-brand-500');
    expect(button.className).toContain('focus-visible:ring-offset-2');
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Tabs from '../Tabs';

describe('Tabs', () => {
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
  });

  const ITEMS = [
    { key: 'a', label: 'Aba A' },
    { key: 'b', label: 'Aba B', badge: 3 },
    { key: 'c', label: 'Aba C' },
  ];

  it('renderiza tabs com aria-selected coerente', async () => {
    await act(async () => {
      root.render(<Tabs items={ITEMS} activeKey="b" onChange={() => {}} />);
    });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
    // Badge aparece apenas em B
    expect(tabs[1].textContent).toContain('3');
  });

  it('chama onChange ao clicar', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<Tabs items={ITEMS} activeKey="a" onChange={onChange} />);
    });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    await act(async () => {
      tabs[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('ArrowRight/ArrowLeft/Home/End movem selecao', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<Tabs items={ITEMS} activeKey="a" onChange={onChange} />);
    });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    function fireKey(el, key) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    }
    await act(async () => { fireKey(tabs[0], 'ArrowRight'); });
    expect(onChange).toHaveBeenLastCalledWith('b');
    await act(async () => { fireKey(tabs[0], 'End'); });
    expect(onChange).toHaveBeenLastCalledWith('c');
    await act(async () => { fireKey(tabs[0], 'Home'); });
    expect(onChange).toHaveBeenLastCalledWith('a');
    await act(async () => { fireKey(tabs[0], 'ArrowLeft'); });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('seleciona a primeira aba quando activeKey nao existe', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<Tabs items={ITEMS} activeKey="zzz" onChange={onChange} />);
    });
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FollowupKpiBar from '../FollowupKpiBar';

let container = null;
let root = null;

const KPIS = [
  { key: 'ativas', icon: 'clipboard-check', tone: 'blue', label: 'Ativas', value: 3 },
  { key: 'atrasadas', icon: 'calendar-clock', tone: 'rose', label: 'Atrasadas', value: 1 },
  { key: 'proximas', icon: 'calendar-clock', tone: 'amber', label: 'Proximas', value: 2 },
];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

function kpiButton(label) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(label));
}

describe('FollowupKpiBar', () => {
  it('renderiza um tile por KPI com valor e rotulo', () => {
    act(() => root.render(<FollowupKpiBar kpis={KPIS} activeKey={null} onToggle={vi.fn()} />));
    expect(container.querySelectorAll('button')).toHaveLength(3);
    expect(kpiButton('Ativas').textContent).toContain('3');
    expect(kpiButton('Atrasadas').textContent).toContain('1');
  });

  it('marca aria-pressed apenas no KPI ativo', () => {
    act(() => root.render(<FollowupKpiBar kpis={KPIS} activeKey="atrasadas" onToggle={vi.fn()} />));
    expect(kpiButton('Atrasadas').getAttribute('aria-pressed')).toBe('true');
    expect(kpiButton('Ativas').getAttribute('aria-pressed')).toBe('false');
  });

  it('dispara onToggle com a key do KPI clicado', () => {
    const onToggle = vi.fn();
    act(() => root.render(<FollowupKpiBar kpis={KPIS} activeKey={null} onToggle={onToggle} />));
    act(() => kpiButton('Proximas').click());
    expect(onToggle).toHaveBeenCalledWith('proximas');
  });
});

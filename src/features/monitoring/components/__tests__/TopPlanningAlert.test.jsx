import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import TopPlanningAlert from '../TopPlanningAlert';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function buildAlerts() {
  return [
    {
      scopeType: 'lo',
      scopeId: 'LO-1',
      loNumero: '001',
      orgaoAmbiental: 'IBAMA',
      month: 1,
      year: 2026,
      monthKey: '2026-01',
      days: 5,
    },
    {
      scopeType: 'project_fallback',
      scopeId: 'P-10',
      projectNames: ['Projeto 10'],
      projectIds: ['P-10'],
      month: 2,
      year: 2026,
      monthKey: '2026-02',
      days: 28,
    },
  ];
}

describe('TopPlanningAlert', () => {
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

  it('starts collapsed and displays total alerts badge', () => {
    act(() => {
      root.render(<TopPlanningAlert alerts={buildAlerts()} />);
    });

    const trigger = container.querySelector('.monitor-topbar-alert-trigger');
    const badge = container.querySelector('.monitor-topbar-alert-badge');
    const panel = container.querySelector('.monitor-topbar-alert-panel');

    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(badge.textContent).toBe('2');
    expect(panel).toBeNull();
  });

  it('opens and closes by clicking the trigger and closes with Escape', () => {
    act(() => {
      root.render(<TopPlanningAlert alerts={buildAlerts()} />);
    });

    const trigger = container.querySelector('.monitor-topbar-alert-trigger');
    act(() => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('.monitor-topbar-alert-panel')).toBeTruthy();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('.monitor-topbar-alert-panel')).toBeNull();
  });

  it('closes when clicking outside the component', () => {
    act(() => {
      root.render(<TopPlanningAlert alerts={buildAlerts()} />);
    });

    const trigger = container.querySelector('.monitor-topbar-alert-trigger');
    act(() => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('.monitor-topbar-alert-panel')).toBeTruthy();

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('.monitor-topbar-alert-panel')).toBeNull();
  });
});

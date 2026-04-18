import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompoundWizard from '../CompoundWizard';

describe('CompoundWizard', () => {
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

  function renderDefault(props = {}) {
    act(() => {
      root.render(
        <CompoundWizard
          mode="create"
          compounds={[]}
          signatariosCandidatos={[]}
          profissoes={[]}
          workspaces={[]}
          workspaceLabelsById={new Map()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onClose={vi.fn()}
          {...props}
        />,
      );
    });
  }

  it('permite navegar para qualquer step sem bloqueio', () => {
    renderDefault();
    const step3 = container.querySelector('[data-testid="wizard-step-bubble-workspaces"]');
    act(() => step3.click());
    // Bubble step 3 passa a estar 'current'
    expect(step3.getAttribute('data-state')).toBe('current');
    // Step 1 (cabecalho) foi visitado na montagem — estado deve ser 'warning' agora (obrigatorio vazio)
    const step1 = container.querySelector('[data-testid="wizard-step-bubble-cabecalho"]');
    expect(step1.getAttribute('data-state')).toBe('warning');
  });

  it('mostra aviso inline ao ficar em step com obrigatorio vazio (nao bloqueia avancar)', () => {
    renderDefault();
    const advanceBtn = container.querySelector('[data-testid="wizard-advance"]');
    expect(advanceBtn.disabled).toBe(false);
    const warning = container.querySelector('[data-testid="wizard-advance-warning"]');
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain('Nome do relatório');
  });

  it('bloqueia o botao final quando missingRequired > 0', () => {
    renderDefault();
    // ir direto para Revisao
    act(() => container.querySelector('[data-testid="wizard-step-bubble-revisao"]').click());
    const submitBtn = container.querySelector('[data-testid="wizard-submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('habilita submit quando obrigatorios preenchidos', () => {
    renderDefault();
    const input = container.querySelector('#wizard-nome');
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, 'Relatório X');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => container.querySelector('[data-testid="wizard-step-bubble-revisao"]').click());
    const submitBtn = container.querySelector('[data-testid="wizard-submit"]');
    expect(submitBtn.disabled).toBe(false);
    const step1 = container.querySelector('[data-testid="wizard-step-bubble-cabecalho"]');
    expect(step1.getAttribute('data-state')).toBe('complete');
  });

  it('em modo edit, submit vira "Salvar alterações"', () => {
    renderDefault({
      mode: 'edit',
      initialCompound: {
        id: 'RC-1',
        nome: 'Existente',
        sharedTextsJson: { revisao: '01', nome_lt: 'LT A', introducao: 'x' },
      },
    });
    act(() => container.querySelector('[data-testid="wizard-step-bubble-revisao"]').click());
    const submitBtn = container.querySelector('[data-testid="wizard-submit"]');
    expect(submitBtn.textContent).toContain('Salvar alterações');
  });
});

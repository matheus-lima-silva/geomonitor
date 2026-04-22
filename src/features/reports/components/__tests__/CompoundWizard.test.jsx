import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompoundWizard from '../CompoundWizard';
import { storageKeyFor } from '../../hooks/useCompoundDraftAutoSave';

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

  it('em modo create, permite selecionar workspaces antes de criar (staging) e anexa pos-create', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'RC-NEW', nome: 'Relatório X' });
    const onAddWorkspace = vi.fn().mockResolvedValue({ id: 'RC-NEW' });
    const workspaces = [
      { id: 'WS-A', nome: 'Workspace A' },
      { id: 'WS-B', nome: 'Workspace B' },
    ];
    const workspaceLabelsById = new Map([['WS-A', 'Workspace A'], ['WS-B', 'Workspace B']]);
    renderDefault({
      workspaces,
      workspaceLabelsById,
      onCreate,
      onAddWorkspace,
    });

    // Preenche nome (obrigatorio) no Step 1
    const nameInput = container.querySelector('#wizard-nome');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(nameInput, 'Relatório X');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Navega para Step Workspaces
    act(() => container.querySelector('[data-testid="wizard-step-bubble-workspaces"]').click());

    // Confirma que o picker de staging apareceu (nao o aviso "vinculados depois")
    const picker = container.querySelector('#wizard-workspace-pending');
    expect(picker).not.toBeNull();

    // SearchableSelect abre o dropdown ao receber foco e seleciona na mousedown
    // da <li>. Simular esse fluxo exato.
    act(() => {
      picker.focus();
    });
    const optionA = Array.from(container.querySelectorAll('li'))
      .find((el) => el.textContent?.trim() === 'Workspace A');
    expect(optionA).toBeDefined();
    act(() => {
      optionA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    // Confirma que o workspace staged apareceu na lista
    expect(container.textContent).toContain('Workspaces selecionados (1)');

    // Navega para Revisao e submete
    act(() => container.querySelector('[data-testid="wizard-step-bubble-revisao"]').click());
    const submitBtn = container.querySelector('[data-testid="wizard-submit"]');
    await act(async () => {
      submitBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onAddWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'RC-NEW' }),
      'WS-A',
    );
  });

  it('autoRestoreDraft=true aplica rascunho sem mostrar modal', () => {
    const key = storageKeyFor('user@exemplo.com');
    window.localStorage.setItem(key, JSON.stringify({
      draft: { nome: 'Rascunho AR', nome_lt: 'LT Beta' },
      savedAt: new Date().toISOString(),
    }));
    renderDefault({ userEmail: 'user@exemplo.com', autoRestoreDraft: true });
    // Nao deve aparecer o modal legado "Recuperar rascunho anterior?"
    expect(container.textContent).not.toContain('Recuperar rascunho anterior');
    // O draft foi aplicado: input de nome ja vem preenchido
    const nameInput = container.querySelector('#wizard-nome');
    expect(nameInput.value).toBe('Rascunho AR');
  });

  it('sem autoRestoreDraft, continua abrindo o modal legado de recuperacao', () => {
    const key = storageKeyFor('user2@exemplo.com');
    window.localStorage.setItem(key, JSON.stringify({
      draft: { nome: 'Rascunho Legado' },
      savedAt: new Date().toISOString(),
    }));
    renderDefault({ userEmail: 'user2@exemplo.com' });
    expect(container.textContent).toContain('Recuperar rascunho anterior');
    const nameInput = container.querySelector('#wizard-nome');
    expect(nameInput.value).toBe('');
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

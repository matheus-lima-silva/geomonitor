import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/licenseConditionService', async () => {
  const actual = await vi.importActual('../../services/licenseConditionService');
  return {
    ...actual,
    listConditions: vi.fn(),
    createCondition: vi.fn(),
    updateCondition: vi.fn(),
    deleteCondition: vi.fn(),
    bulkReplaceConditions: vi.fn(),
  };
});

import LicenseConditionsSection, { persistConditions } from '../LicenseConditionsSection';
import {
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
  bulkReplaceConditions,
} from '../../services/licenseConditionService';

function flush() { return new Promise((r) => setTimeout(r, 0)); }

const INPUT_SETTER = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const TEXTAREA_SETTER = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

function setInputValue(element, value) {
  const setter = element.tagName === 'TEXTAREA' ? TEXTAREA_SETTER : INPUT_SETTER;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButtonByText(container, text) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text || b.textContent.includes(text));
}

function findButtonByAriaLabel(container, pattern) {
  return [...container.querySelectorAll('button')].find((b) => pattern.test(b.getAttribute('aria-label') || ''));
}

describe('LicenseConditionsSection', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    listConditions.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('sem licenseId → modo draft; nao chama listConditions', async () => {
    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="" showToast={vi.fn()} />);
    });
    expect(listConditions).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Sera salva junto com a LO');
  });

  it('com licenseId → carrega lista via listConditions', async () => {
    listConditions.mockResolvedValue([{ id: 'C1', numero: '2.1', texto: 'Programa Erosivo' + ' a'.repeat(20), tipo: 'processos_erosivos' }]);
    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={vi.fn()} />);
    });
    await act(async () => { await flush(); });
    expect(listConditions).toHaveBeenCalledWith('LO-X');
    expect(container.textContent).toContain('2.1');
    expect(container.textContent).toContain('Programa Erosivo');
  });

  it('adicionar em modo autonomo → createCondition + atualiza lista', async () => {
    listConditions.mockResolvedValue([]);
    createCondition.mockResolvedValue({ id: 'C-NEW', numero: '3.1', texto: 'Texto suficientemente longo para validar' + ' x'.repeat(20), tipo: 'geral' });
    const showToast = vi.fn();

    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });

    await act(async () => { findButtonByText(container, 'Adicionar').dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    // preenche draft
    const numeroInput = container.querySelector('input[placeholder="Ex.: 2.1"]');
    const textarea = container.querySelector('textarea');
    await act(async () => {
      setInputValue(numeroInput, '3.1');
      setInputValue(textarea, 'Texto suficientemente longo para validar o minimo');
    });

    await act(async () => {
      findButtonByText(container, 'Salvar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(createCondition).toHaveBeenCalled();
    const [licenseId, payload] = createCondition.mock.calls[0];
    expect(licenseId).toBe('LO-X');
    expect(payload.numero).toBe('3.1');
    expect(showToast).toHaveBeenCalledWith('Condicionante adicionada.', 'success');
    expect(container.textContent).toContain('3.1');
  });

  it('validacao: texto curto dispara toast e nao chama createCondition', async () => {
    const showToast = vi.fn();
    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });
    await act(async () => { findButtonByText(container, 'Adicionar').dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const numeroInput = container.querySelector('input[placeholder="Ex.: 2.1"]');
    const textarea = container.querySelector('textarea');
    await act(async () => {
      setInputValue(numeroInput, '3.1');
      setInputValue(textarea, 'curto');
    });
    await act(async () => {
      findButtonByText(container, 'Salvar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });
    expect(createCondition).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/min.*20/i), 'error');
  });

  it('duplicata de numero no modo autonomo → toast sem chamar createCondition', async () => {
    listConditions.mockResolvedValue([{ id: 'C1', numero: '2.1', texto: 'Existente' + ' a'.repeat(30), tipo: 'geral' }]);
    const showToast = vi.fn();
    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });
    await act(async () => { findButtonByText(container, 'Adicionar').dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const numeroInput = container.querySelector('input[placeholder="Ex.: 2.1"]');
    const textarea = container.querySelector('textarea');
    await act(async () => {
      setInputValue(numeroInput, '2.1');
      setInputValue(textarea, 'Outro texto suficientemente longo');
    });
    await act(async () => {
      findButtonByText(container, 'Salvar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });
    expect(createCondition).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/Ja existe condicionante/i), 'error');
  });

  it('editar item → updateCondition com patch; atualiza lista', async () => {
    const original = { id: 'C1', numero: '2.1', texto: 'Texto antigo suficientemente longo para validar' + ' x'.repeat(5), tipo: 'geral' };
    const patched = { ...original, texto: 'Texto novo bem mais longo agora sim' + ' y'.repeat(20) };
    listConditions.mockResolvedValue([original]);
    updateCondition.mockResolvedValue(patched);
    const showToast = vi.fn();

    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });

    await act(async () => {
      findButtonByAriaLabel(container, /Editar condicionante 2\.1/).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const textarea = container.querySelector('textarea');
    await act(async () => {
      setInputValue(textarea, patched.texto);
    });
    await act(async () => {
      findButtonByText(container, 'Salvar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(updateCondition).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Condicionante atualizada.', 'success');
    expect(container.textContent).toContain('Texto novo bem mais longo');
  });

  it('remover → abre ConfirmDeleteModal; confirmar chama deleteCondition', async () => {
    listConditions.mockResolvedValue([{ id: 'C1', numero: '2.1', texto: 'Texto longo o suficiente para passar' + ' z'.repeat(5), tipo: 'geral' }]);
    deleteCondition.mockResolvedValue(null);
    const showToast = vi.fn();

    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });

    await act(async () => {
      findButtonByAriaLabel(container, /Remover condicionante 2\.1/).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // modal aberto: espera o botao "Excluir" do ConfirmDeleteModal
    const excluir = [...document.querySelectorAll('button')].find((b) => /Excluir|Confirmar/i.test(b.textContent));
    expect(excluir).toBeTruthy();
    await act(async () => {
      excluir.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });
    expect(deleteCondition).toHaveBeenCalledWith({ id: 'C1' });
    expect(showToast).toHaveBeenCalledWith('Condicionante removida.', 'success');
  });

  it('cancelar ConfirmDelete nao chama deleteCondition', async () => {
    listConditions.mockResolvedValue([{ id: 'C1', numero: '2.1', texto: 'Texto longo o suficiente' + ' w'.repeat(20), tipo: 'geral' }]);
    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="LO-X" showToast={vi.fn()} />);
    });
    await act(async () => { await flush(); });

    await act(async () => {
      findButtonByAriaLabel(container, /Remover condicionante 2\.1/).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const cancelar = [...document.querySelectorAll('button')].find((b) => /Cancelar/i.test(b.textContent));
    await act(async () => {
      cancelar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });
    expect(deleteCondition).not.toHaveBeenCalled();
  });

  it('modo draft: Adicionar empilha local, nao chama API; persistConditions usa bulkReplace', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<LicenseConditionsSection licenseId="" onChange={onChange} showToast={vi.fn()} />);
    });

    await act(async () => { findButtonByText(container, 'Adicionar').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const numeroInput = container.querySelector('input[placeholder="Ex.: 2.1"]');
    const textarea = container.querySelector('textarea');
    await act(async () => {
      setInputValue(numeroInput, '1');
      setInputValue(textarea, 'Texto local suficientemente longo para passar');
    });
    await act(async () => {
      findButtonByText(container, 'Salvar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(createCondition).not.toHaveBeenCalled();
    // onChange recebeu o array final
    const lastEmit = onChange.mock.calls.at(-1)?.[0];
    expect(Array.isArray(lastEmit)).toBe(true);
    expect(lastEmit.length).toBe(1);
    expect(lastEmit[0].numero).toBe('1');

    // Helper persistConditions chama bulkReplace
    bulkReplaceConditions.mockResolvedValue([{ id: 'C-P' }]);
    await persistConditions('LO-NEW', lastEmit);
    expect(bulkReplaceConditions).toHaveBeenCalledWith('LO-NEW', lastEmit);
  });
});

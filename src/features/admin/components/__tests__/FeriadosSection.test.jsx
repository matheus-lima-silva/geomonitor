import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../services/rulesService', () => ({
  importarFeriadosNacionais: vi.fn(),
  saveRulesConfig: vi.fn(),
  subscribeRulesConfig: vi.fn(),
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'admin@test.local' } }),
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const { importarFeriadosNacionais, saveRulesConfig } = await import('../../../../services/rulesService');

async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

function setReactInputValue(input, value) {
  const proto = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('FeriadosSection', () => {
  let container;
  let root;
  let FeriadosSection;

  beforeEach(async () => {
    ({ default: FeriadosSection } = await import('../FeriadosSection'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    importarFeriadosNacionais.mockReset();
    saveRulesConfig.mockReset();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('renderiza lista vazia inicialmente', async () => {
    await act(async () => {
      root.render(<FeriadosSection rulesConfig={{ feriados: [] }} />);
    });
    expect(container.textContent).toContain('Nenhum feriado cadastrado.');
  });

  it('renderiza feriados existentes ordenados', async () => {
    await act(async () => {
      root.render(
        <FeriadosSection rulesConfig={{
          feriados: [
            { data: '2026-12-25', nome: 'Natal', tipo: 'nacional' },
            { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
          ],
        }} />,
      );
    });

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('21/04/2026');
    expect(rows[0].textContent).toContain('Tiradentes');
    expect(rows[1].textContent).toContain('25/12/2026');
  });

  it('adiciona feriado manual a lista draft', async () => {
    await act(async () => {
      root.render(<FeriadosSection rulesConfig={{ feriados: [] }} />);
    });

    const dataInput = container.querySelector('#feriados-new-data');
    const nomeInput = container.querySelector('#feriados-new-nome');
    const addBtn = container.querySelector('[data-testid="feriados-add-btn"]');

    await act(async () => {
      setReactInputValue(dataInput, '2026-04-21');
      setReactInputValue(nomeInput, 'Tiradentes');
    });
    await act(async () => {
      addBtn.click();
    });

    expect(container.textContent).toContain('Tiradentes');
    expect(container.textContent).toContain('21/04/2026');
  });

  it('importa feriados nacionais chamando o service com mesclagem sem duplicatas', async () => {
    importarFeriadosNacionais.mockResolvedValueOnce({
      ano: 2026,
      feriados: [
        { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
        { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'nacional' },
      ],
    });

    await act(async () => {
      root.render(<FeriadosSection rulesConfig={{
        _links: { importarFeriados: { href: 'http://api/test/rules/feriados/importar', method: 'GET' } },
        feriados: [{ data: '2026-04-21', nome: 'Tiradentes Ja Existe', tipo: 'nacional' }],
      }} />);
    });

    const importBtn = container.querySelector('[data-testid="feriados-import-btn"]');
    await act(async () => { importBtn.click(); });
    await flush();

    expect(importarFeriadosNacionais).toHaveBeenCalled();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Tiradentes');
    expect(rows[1].textContent).toContain('Dia do Trabalho');
  });

  it('salva regras ao clicar em Salvar', async () => {
    saveRulesConfig.mockResolvedValueOnce({});

    await act(async () => {
      root.render(<FeriadosSection rulesConfig={{
        feriados: [{ data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' }],
      }} />);
    });

    const saveBtn = container.querySelector('[data-testid="feriados-save-btn"]');
    await act(async () => { saveBtn.click(); });
    await flush();

    expect(saveRulesConfig).toHaveBeenCalledWith(
      { feriados: [{ data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' }] },
      expect.objectContaining({ updatedBy: 'admin@test.local', merge: true }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import EditableListTable from '../EditableListTable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setNativeValue(element, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  (setter || ((v) => { element.value = v; })).call(element, value);
}

const BLOCK = {
  key: 'brigadistas',
  kind: 'list',
  label: 'Relação de brigadistas',
  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'telefone', label: 'Telefone' },
  ],
};

describe('EditableListTable', () => {
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

  it('mostra o label do bloco e as colunas do manifest', async () => {
    await act(async () => {
      root.render(<EditableListTable block={BLOCK} rows={[]} onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('Relação de brigadistas');
    expect(container.textContent).toContain('Nome');
    expect(container.textContent).toContain('Telefone');
  });

  it('sem linhas mostra o aviso de lista vazia', async () => {
    await act(async () => {
      root.render(<EditableListTable block={BLOCK} rows={[]} onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('Nenhuma linha ainda');
  });

  it('renderiza um Input por coluna e por linha, com o valor da ficha', async () => {
    const rows = [{ nome: 'Fulano', telefone: '(11) 1111-1111' }];
    await act(async () => {
      root.render(<EditableListTable block={BLOCK} rows={rows} onChange={vi.fn()} />);
    });
    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('Fulano');
    expect(inputs[1].value).toBe('(11) 1111-1111');
  });

  it('editar uma celula chama onChange com a linha atualizada, preservando as demais', async () => {
    const onChange = vi.fn();
    const rows = [
      { nome: 'Fulano', telefone: '(11) 1111-1111' },
      { nome: 'Ciclana', telefone: '(11) 2222-2222' },
    ];
    await act(async () => {
      root.render(<EditableListTable block={BLOCK} rows={rows} onChange={onChange} />);
    });
    const nomeInputLinha1 = container.querySelectorAll('input')[0];
    setNativeValue(nomeInputLinha1, 'Fulano de Tal');
    await act(async () => { nomeInputLinha1.dispatchEvent(new Event('input', { bubbles: true })); });

    expect(onChange).toHaveBeenCalledWith('brigadistas', [
      { nome: 'Fulano de Tal', telefone: '(11) 1111-1111' },
      { nome: 'Ciclana', telefone: '(11) 2222-2222' },
    ]);
  });

  it('adicionar linha chama onChange com uma linha vazia a mais', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<EditableListTable block={BLOCK} rows={[{ nome: 'Fulano', telefone: 'x' }]} onChange={onChange} />);
    });
    const addButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Adicionar linha'));
    await act(async () => { addButton.click(); });

    expect(onChange).toHaveBeenCalledWith('brigadistas', [
      { nome: 'Fulano', telefone: 'x' },
      { nome: '', telefone: '' },
    ]);
  });

  it('remover linha chama onChange sem essa linha', async () => {
    const onChange = vi.fn();
    const rows = [
      { nome: 'Fulano', telefone: '(11) 1111-1111' },
      { nome: 'Ciclana', telefone: '(11) 2222-2222' },
    ];
    await act(async () => {
      root.render(<EditableListTable block={BLOCK} rows={rows} onChange={onChange} />);
    });
    const removeButtons = container.querySelectorAll('[aria-label^="Remover linha"]');
    expect(removeButtons).toHaveLength(2);
    await act(async () => { removeButtons[0].click(); });

    expect(onChange).toHaveBeenCalledWith('brigadistas', [
      { nome: 'Ciclana', telefone: '(11) 2222-2222' },
    ]);
  });
});

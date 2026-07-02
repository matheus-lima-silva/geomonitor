import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PendenciesPanel from '../PendenciesPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('PendenciesPanel', () => {
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

  it('mostra estado "Ficha completa!" quando nao ha pendencias', async () => {
    await act(async () => {
      root.render(<PendenciesPanel pendencies={[]} onFieldClick={vi.fn()} />);
    });
    expect(container.textContent).toContain('Ficha completa!');
    expect(container.textContent).toContain('Completo');
  });

  it('agrupa pendencias de campo por secao e separa blocos de tabela/anexo', async () => {
    const pendencies = [
      { kind: 'field', key: 'cnpj_1', label: 'CNPJ', section: 'Identificação' },
      { kind: 'field', key: 'endereco', label: 'Endereço', section: 'Identificação' },
      { kind: 'list', key: 'brigadistas', label: 'Relação de brigadistas', section: null },
      { kind: 'manual_block', key: 'rota_fuga', label: 'Rota de fuga', section: null },
    ];
    await act(async () => {
      root.render(<PendenciesPanel pendencies={pendencies} onFieldClick={vi.fn()} />);
    });
    expect(container.textContent).toContain('4 pendências');
    expect(container.textContent).toContain('Identificação');
    expect(container.textContent).toContain('CNPJ');
    expect(container.textContent).toContain('Tabelas em branco');
    expect(container.textContent).toContain('Relação de brigadistas');
    expect(container.textContent).toContain('Anexos e blocos manuais');
    expect(container.textContent).toContain('Rota de fuga');
  });

  it('clicar num item de campo chama onFieldClick com a chave', async () => {
    const onFieldClick = vi.fn();
    await act(async () => {
      root.render(
        <PendenciesPanel
          pendencies={[{ kind: 'field', key: 'cnpj_1', label: 'CNPJ', section: 'Identificação' }]}
          onFieldClick={onFieldClick}
        />,
      );
    });
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('CNPJ'));
    await click(button);
    expect(onFieldClick).toHaveBeenCalledWith('cnpj_1');
  });

  it('mostra banner de campos completos quando so restam blocos', async () => {
    await act(async () => {
      root.render(
        <PendenciesPanel
          pendencies={[{ kind: 'list', key: 'brigadistas', label: 'Relação de brigadistas', section: null }]}
          onFieldClick={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('Todos os campos de texto estão preenchidos.');
  });
});

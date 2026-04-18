import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/reportArchiveService', () => ({
  listArchives: vi.fn().mockResolvedValue([]),
}));

import CompoundCard from '../CompoundCard';

describe('CompoundCard', () => {
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
    vi.clearAllMocks();
  });

  const baseCompound = {
    id: 'RC-1',
    nome: 'Relatório X',
    status: 'draft',
    workspaceIds: ['WS-A', 'WS-B'],
    updatedAt: new Date().toISOString(),
    sharedTextsJson: {
      elaboradores: [{ nome: 'Fulano', profissao: 'Eng', registro: 'CREA-RJ 1' }],
      revisores: [],
    },
  };

  const labels = new Map([['WS-A', 'Workspace A'], ['WS-B', 'Workspace B']]);

  it('sem DOCX mostra barra com 1 botao primary "Gerar Relatório"', () => {
    act(() => {
      root.render(
        <CompoundCard
          compound={baseCompound}
          workspaceLabelsById={labels}
          onTrash={vi.fn()}
          onGenerate={vi.fn()}
          onOpenEdit={vi.fn()}
          onDownloadDocx={vi.fn()}
          onUploadDelivery={vi.fn()}
          compoundDownloadFileName="rel.docx"
        />,
      );
    });
    const generate = container.querySelector('[data-testid="compound-generate-RC-1"]');
    expect(generate).not.toBeNull();
    expect(generate.textContent).toContain('Gerar Relatório');
  });

  it('com DOCX mostra DeliveryCallout no lugar da barra de acoes', () => {
    act(() => {
      root.render(
        <CompoundCard
          compound={{ ...baseCompound, outputDocxMediaId: 'MED-1' }}
          workspaceLabelsById={labels}
          onTrash={vi.fn()}
          onGenerate={vi.fn()}
          onOpenEdit={vi.fn()}
          onDownloadDocx={vi.fn()}
          onUploadDelivery={vi.fn()}
          compoundDownloadFileName="rel.docx"
        />,
      );
    });
    expect(container.querySelector('[data-testid="delivery-callout"]')).not.toBeNull();
    // Sem barra com botao "Gerar Relatório"
    expect(container.querySelector('[data-testid="compound-generate-RC-1"]')).toBeNull();
  });

  it('aciona onOpenEdit ao clicar em Abrir / Editar', () => {
    const onOpenEdit = vi.fn();
    act(() => {
      root.render(
        <CompoundCard
          compound={baseCompound}
          workspaceLabelsById={labels}
          onTrash={vi.fn()}
          onGenerate={vi.fn()}
          onOpenEdit={onOpenEdit}
          onDownloadDocx={vi.fn()}
          onUploadDelivery={vi.fn()}
          compoundDownloadFileName="rel.docx"
        />,
      );
    });
    act(() => container.querySelector('[data-testid="compound-edit-RC-1"]').click());
    expect(onOpenEdit).toHaveBeenCalledTimes(1);
    expect(onOpenEdit.mock.calls[0][0].id).toBe('RC-1');
  });

  it('modal de geracao expõe toggle de coordenadas', () => {
    const onGenerate = vi.fn();
    act(() => {
      root.render(
        <CompoundCard
          compound={baseCompound}
          workspaceLabelsById={labels}
          onTrash={vi.fn()}
          onGenerate={onGenerate}
          onOpenEdit={vi.fn()}
          onDownloadDocx={vi.fn()}
          onUploadDelivery={vi.fn()}
          compoundDownloadFileName="rel.docx"
        />,
      );
    });
    act(() => container.querySelector('[data-testid="compound-generate-RC-1"]').click());
    // Modal aberto — achar checkbox dentro do modal
    const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .find((el) => el.parentElement?.textContent?.includes('Incluir coordenadas'));
    expect(checkbox).toBeDefined();
  });
});

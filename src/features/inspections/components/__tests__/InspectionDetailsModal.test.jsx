import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InspectionDetailsModal from '../InspectionDetailsModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function buildData() {
  const inspection = {
    id: 'VS-P1-10012026-0001',
    projetoId: 'P1',
    dataInicio: '2026-01-10',
    dataFim: '2026-01-12',
    responsavel: 'Maria',
    obs: 'Observacao de teste',
    detalhesDias: [
      {
        data: '2026-01-10',
        clima: 'Sol',
        torresInput: '1, 2',
        torresDetalhadas: [{ numero: '1', obs: 'OK', temErosao: false }],
        hotelNome: 'Hotel X',
        hotelMunicipio: 'Cidade',
      },
    ],
  };
  const inspections = [
    { ...inspection, id: 'VS-P1-09012026-0001' },
    inspection,
    { ...inspection, id: 'VS-P1-13012026-0001' },
  ];
  const erosions = [
    { id: 'ER-1', vistoriaId: inspection.id, torreRef: '1', tipo: 'ravina', estagio: 'inicial', impacto: 'Alto' },
  ];
  const project = { id: 'P1', nome: 'Projeto 1', tipo: 'Linha de Transmissao' };
  return { inspection, inspections, erosions, project };
}

describe('InspectionDetailsModal', () => {
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
    vi.restoreAllMocks();
  });

  it('renderiza resumo, diario e erosoes vinculadas', () => {
    const { inspection, inspections, erosions, project } = buildData();
    act(() => {
      root.render(
        <InspectionDetailsModal
          inspection={inspection}
          project={project}
          erosions={erosions}
          inspections={inspections}
          onClose={() => {}}
          onNavigate={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain('Detalhes da Vistoria');
    expect(container.textContent).toContain('Projeto 1');
    expect(container.textContent).toContain('ER-1');
    expect(container.textContent).toContain('Dados de hospedagem');
  });

  it('navega para vistoria anterior e seguinte', () => {
    const { inspection, inspections, erosions, project } = buildData();
    const onNavigate = vi.fn();

    act(() => {
      root.render(
        <InspectionDetailsModal
          inspection={inspection}
          project={project}
          erosions={erosions}
          inspections={inspections}
          onClose={() => {}}
          onNavigate={onNavigate}
        />,
      );
    });

    const footerButtons = [...container.querySelectorAll('[role="dialog"] div.border-t button')];
    expect(footerButtons.length).toBeGreaterThanOrEqual(4);

    const prevBtn = footerButtons[0];
    const nextBtn = footerButtons[1];

    act(() => {
      prevBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenNthCalledWith(1, inspections[0]);
    expect(onNavigate).toHaveBeenNthCalledWith(2, inspections[2]);
  });

  it('exporta PDF abrindo nova janela e chamando print', () => {
    const { inspection, inspections, erosions, project } = buildData();
    const documentWrite = vi.fn();
    const documentClose = vi.fn();
    const print = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: {
        write: documentWrite,
        close: documentClose,
      },
      print,
    });

    act(() => {
      root.render(
        <InspectionDetailsModal
          inspection={inspection}
          project={project}
          erosions={erosions}
          inspections={inspections}
          onClose={() => {}}
          onNavigate={() => {}}
        />,
      );
    });

    const footerButtons = [...container.querySelectorAll('[role="dialog"] div.border-t button')];
    const pdfButton = footerButtons.find((button) => /Gerar PDF/i.test(button.textContent || ''));
    expect(pdfButton).toBeTruthy();

    act(() => {
      pdfButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openSpy).toHaveBeenCalled();
    expect(documentWrite).toHaveBeenCalled();
    expect(documentClose).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});

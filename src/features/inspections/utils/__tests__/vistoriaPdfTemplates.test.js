import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildVistoriaPdfDocument, openVistoriaPrintWindow } from '../vistoriaPdfTemplates';

const GENERATED_AT = new Date('2025-04-12T09:30:00');

function baseInspection(overrides = {}) {
  return {
    id: 'VS-EMP-0042-12042025-0001',
    projetoId: 'EMP-0042',
    dataInicio: '2025-04-07',
    dataFim: '2025-04-09',
    status: 'concluida',
    responsavel: 'Marcos Tavares',
    obs: 'Campanha trimestral do trecho norte.',
    detalhesDias: [
      {
        data: '2025-04-07',
        clima: 'Sol',
        torres: ['10', '11', '12'],
        torresDetalhadas: [
          { numero: '10', obs: 'Sem observacoes.', temErosao: false },
          { numero: '12', obs: 'Vocoroca ativa.', temErosao: true },
        ],
        hotelNome: 'Hotel Rio Tocantins',
        hotelMunicipio: 'Imperatriz/MA',
        hotelTorreBase: '11',
        hotelLogisticaNota: '4',
        hotelReservaNota: '5',
        hotelEstadiaNota: '4',
      },
      {
        data: '2025-04-08',
        clima: 'Parcialmente Nublado',
        torresDetalhadas: [
          { numero: '14', obs: 'Ravina no pe da torre.', temErosao: true },
        ],
      },
      {
        data: '2025-04-09',
        clima: 'Chuva Fraca',
        torresDetalhadas: [
          { numero: '17', obs: 'Sulco incipiente.', temErosao: true },
        ],
      },
    ],
    ...overrides,
  };
}

function erosion(id, torreRef, codigo, score, classe, tipo, fotos = []) {
  return {
    id,
    torreRef,
    tipo,
    estagio: 'Ativa',
    impacto: classe,
    criticalidade: { codigo, criticidade_score: score, criticidade_classe: classe },
    fotosPrincipais: fotos,
  };
}

function baseErosions() {
  return [
    erosion('ERS-2025-0312', '12', 'C4', 30, 'Muito Alto', 'Vocoroca', [
      { caption: 'T-12 · Vocoroca ativa, vista de montante', mediaAssetId: 'IMG_0312.jpg', signedUrl: 'https://media.example/0312.jpg' },
    ]),
    erosion('ERS-2025-0298', '14', 'C3', 22, 'Alto', 'Ravina'),
    erosion('ERS-2025-0316', '17', 'C2', 14, 'Medio', 'Sulco'),
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('buildVistoriaPdfDocument', () => {
  it('renderiza as quatro secoes e os metadados da vistoria', () => {
    const html = buildVistoriaPdfDocument({
      inspection: baseInspection(),
      project: { id: 'EMP-0042', nome: 'LT 500 kV Norte' },
      erosions: baseErosions(),
      variant: 'sobria',
      generatedAt: GENERATED_AT,
      user: 'vistoria@lima.rio.br',
    });

    expect(html).toContain('Identificacao');
    expect(html).toContain('Diario de campo');
    expect(html).toContain('Erosoes identificadas');
    expect(html).toContain('Anexo fotografico');
    expect(html).toContain('VS-EMP-0042-12042025-0001');
    expect(html).toContain('LT 500 kV Norte');
    expect(html).toContain('Concluida');
    expect(html).toContain('Pagina 1 de 2');
    expect(html).toContain('Pagina 2 de 2');
  });

  it('usa a fonte mono auto-hospedada', () => {
    const html = buildVistoriaPdfDocument({ inspection: baseInspection(), erosions: baseErosions(), generatedAt: GENERATED_AT });
    expect(html).toContain('JetBrains Mono');
    expect(html).toContain('/fonts/JetBrainsMono-VariableFont_wght.ttf');
  });

  it('mostra cada banda com badge, label e retorno canonicos', () => {
    const html = buildVistoriaPdfDocument({ inspection: baseInspection(), erosions: baseErosions(), generatedAt: GENERATED_AT });
    // Badges de criticidade
    expect(html).toContain('C4 · Muito Alto');
    expect(html).toContain('C3 · Alto');
    expect(html).toContain('C2 · Medio');
    // Retorno por banda (FREQUENCY_BY_CODE)
    expect(html).toContain('3 meses');
    expect(html).toContain('6 meses');
    expect(html).toContain('12 meses');
    // Score V3
    expect(html).toContain('30 pts');
  });

  it('pinta o ponto do diario com a cor da banda da erosao da torre', () => {
    const html = buildVistoriaPdfDocument({ inspection: baseInspection(), erosions: baseErosions(), generatedAt: GENERATED_AT });
    // Torre 12 -> ERS C4 -> ponto #7f1d1d; linha marcada como pv-row-eros; codigo mono da erosao
    expect(html).toContain('background:#7f1d1d');
    expect(html).toContain('pv-row-eros');
    expect(html).toContain('ERS-2025-0312');
    expect(html).toContain('T-12');
  });

  it('deriva o anexo fotografico das fotos principais das erosoes', () => {
    const html = buildVistoriaPdfDocument({ inspection: baseInspection(), erosions: baseErosions(), generatedAt: GENERATED_AT });
    expect(html).toContain('T-12 · Vocoroca ativa, vista de montante');
    expect(html).toContain('https://media.example/0312.jpg');
  });

  it('alterna a classe de variacao no root de cada pagina', () => {
    const sobria = buildVistoriaPdfDocument({ inspection: baseInspection(), erosions: baseErosions(), variant: 'sobria', generatedAt: GENERATED_AT });
    const marca = buildVistoriaPdfDocument({ inspection: baseInspection(), erosions: baseErosions(), variant: 'marca', generatedAt: GENERATED_AT });
    // O CSS embute as duas variacoes; so a classe do root <div> muda. Conferir as 2 paginas.
    expect(sobria.match(/pv-page pv--sobria/g)).toHaveLength(2);
    expect(sobria).not.toContain('pv-page pv--marca');
    expect(marca.match(/pv-page pv--marca/g)).toHaveLength(2);
    expect(marca).not.toContain('pv-page pv--sobria');
  });

  it('e resiliente a vistoria sem dias, sem erosoes e sem fotos', () => {
    const html = buildVistoriaPdfDocument({
      inspection: { id: 'VS-X', projetoId: 'EMP-1', dataInicio: '2025-01-01' },
      generatedAt: GENERATED_AT,
    });
    expect(html).toContain('Sem dias registados nesta vistoria.');
    expect(html).toContain('Nenhuma erosao vinculada a esta vistoria.');
    expect(html).toContain('Sem fotos curadas vinculadas a esta vistoria.');
  });
});

describe('openVistoriaPrintWindow', () => {
  it('escreve o HTML na nova janela e dispara a impressao', () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const focus = vi.fn();
    const write = vi.fn();
    const fakeWin = { document: { open: vi.fn(), write, close: vi.fn() }, focus, print };
    vi.spyOn(window, 'open').mockReturnValue(fakeWin);

    openVistoriaPrintWindow('<html><body>x</body></html>');
    vi.runAllTimers();

    expect(write).toHaveBeenCalledWith('<html><body>x</body></html>');
    expect(print).toHaveBeenCalled();
  });

  it('lanca erro quando o pop-up e bloqueado', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => openVistoriaPrintWindow('<html></html>')).toThrow('Permita pop-up');
  });
});

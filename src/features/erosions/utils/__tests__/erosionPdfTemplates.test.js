import { describe, it, expect } from 'vitest';
import {
  buildSingleErosionFichaPdfDocument,
  buildSingleErosionFichaSimplificadaDocument,
} from '../erosionPdfTemplates';

function baseErosion(overrides = {}) {
  return {
    id: 'ERS-42',
    projetoId: 'P1',
    torreRef: '12',
    status: 'Ativo',
    impacto: 'Medio',
    vistoriaId: 'VS-1',
    vistoriaIds: ['VS-1'],
    tiposFeicao: ['ravina'],
    usosSolo: ['pastagem'],
    profundidadeMetros: 2.5,
    declividadeGraus: 15,
    distanciaEstruturaMetros: 8,
    presencaAguaFundo: 'sim',
    saturacaoPorAgua: 'nao',
    medidaPreventiva: 'Instalar drenagem',
    locationCoordinates: { latitude: '-21.1', longitude: '-42.1' },
    historicoCriticidade: [
      {
        timestamp: '2026-04-10T12:00:00.000Z',
        situacao: 'Estavel',
        score_atual: 8,
        score_anterior: 6,
        tendencia: 'crescente',
      },
    ],
    ...overrides,
  };
}

describe('buildSingleErosionFichaPdfDocument', () => {
  it('renderiza secoes na ordem esperada (Resumo -> Classificacao -> Localizacao -> Historico tecnico -> Vistorias -> Acompanhamento)', () => {
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion(),
      project: { id: 'P1', nome: 'Projeto 1' },
      history: [],
      relatedInspections: [],
    });
    const headings = Array.from(html.matchAll(/<h2>([^<]+)<\/h2>/g)).map((m) => m[1]);
    expect(headings.slice(0, 6)).toEqual([
      'Resumo',
      'Classificacao e caracterizacao consolidada',
      'Localizacao geografica',
      'Historico tecnico de criticidade',
      'Vistorias relacionadas',
      'Historico de acompanhamento',
    ]);
  });

  it('aplica formatClassWithRange nas faixas de profundidade/declividade/exposicao', () => {
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion(),
      project: { id: 'P1', nome: 'Projeto 1' },
      history: [],
      relatedInspections: [],
    });
    expect(html).toContain('P2 (&gt; 1 a 10 m)');
    expect(html).toContain('D2 (10 a 25 graus)');
    expect(html).toContain('E3 (5 a &lt; 20 m)');
  });

  it('inclui Nome do projeto, Registro e Intervencao no Resumo', () => {
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion({ registroHistorico: true, intervencaoRealizada: 'Gabiao instalado' }),
      project: { id: 'P1', nome: 'Projeto Alfa' },
      history: [],
      relatedInspections: [],
    });
    expect(html).toContain('Projeto Alfa');
    expect(html).toContain('Registro:');
    expect(html).toContain('Historico de acompanhamento');
    expect(html).toContain('Intervencao ja realizada');
    expect(html).toContain('Gabiao instalado');
  });

  it('renderiza historico tecnico de criticidade com timestamp e score', () => {
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion(),
      project: {},
      history: [],
      relatedInspections: [],
    });
    expect(html).toContain('Historico tecnico de criticidade');
    expect(html).toContain('Estavel');
    expect(html).toContain('Score atual: 8');
  });

  it('embute imagens quando fotosPrincipaisResolved e passado', () => {
    const fotosPrincipaisResolved = [
      { photoId: 'RWP-1', workspaceId: 'RW', mediaAssetId: 'MA-1', sortOrder: 0, caption: 'Vista montante', signedUrl: 'https://example.com/foto1.jpg' },
      { photoId: 'RWP-2', workspaceId: 'RW', mediaAssetId: 'MA-2', sortOrder: 1, signedUrl: 'https://example.com/foto2.jpg' },
    ];
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion(),
      project: {},
      history: [],
      relatedInspections: [],
      fotosPrincipaisResolved,
    });
    expect(html).toContain('<h2>Fotos principais</h2>');
    expect(html).toContain('<img src="https://example.com/foto1.jpg"');
    expect(html).toContain('<img src="https://example.com/foto2.jpg"');
    expect(html).toContain('Vista montante');
    expect(html).toContain('<figure class="ficha-photo-cell">');
  });

  it('omite secao Fotos principais quando nao recebe fotosPrincipaisResolved', () => {
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion(),
      project: {},
      history: [],
      relatedInspections: [],
    });
    expect(html).not.toContain('<h2>Fotos principais</h2>');
    expect(html).not.toContain('<figure class="ficha-photo-cell">');
  });

  it('renderiza placeholder quando signedUrl e vazia (foto orfa)', () => {
    const html = buildSingleErosionFichaPdfDocument({
      erosion: baseErosion(),
      project: {},
      history: [],
      relatedInspections: [],
      fotosPrincipaisResolved: [
        { photoId: 'RWP-X', workspaceId: 'RW', mediaAssetId: 'MA-X', sortOrder: 0, signedUrl: '' },
      ],
    });
    expect(html).toContain('Foto indisponivel no momento da impressao');
  });
});

describe('buildSingleErosionFichaSimplificadaDocument', () => {
  it('nao embute <img> mesmo se erosao tiver fotosPrincipais (simplificada nao muda)', () => {
    const html = buildSingleErosionFichaSimplificadaDocument({
      erosion: baseErosion({
        fotosPrincipais: [
          { photoId: 'RWP-1', workspaceId: 'RW', mediaAssetId: 'MA-1', sortOrder: 0 },
        ],
      }),
      project: {},
    });
    expect(html).not.toContain('<figure class="ficha-photo-cell">');
    const imgs = (html.match(/<img\b/g) || []).length;
    expect(imgs).toBe(0);
  });
});

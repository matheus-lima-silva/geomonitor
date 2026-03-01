import {
  buildErosionReportRows,
  buildErosionsCsv,
  buildManualFollowupEvent,
  deriveErosionTypeFromTechnicalFields,
  filterErosionsForReport,
  normalizeErosionTechnicalFields,
  normalizeFollowupEventType,
  validateErosionLocation,
  validateErosionTechnicalFields,
} from '../erosionUtils';

describe('validateErosionLocation', () => {
  it('fails without localTipo', () => {
    expect(validateErosionLocation({ localTipo: '' }).ok).toBe(false);
  });

  it('requires localDescricao/exposicao/estrutura when outros', () => {
    expect(validateErosionLocation({ localTipo: 'Outros', localDescricao: '' }).ok).toBe(false);
    expect(validateErosionLocation({
      localContexto: {
        localTipo: 'outros',
        localDescricao: 'Talude lateral',
        exposicao: 'area_terceiros',
        estruturaProxima: 'nenhuma',
      },
    }).ok).toBe(true);
  });
});

describe('validateErosionTechnicalFields', () => {
  it('normalizes null payload with defaults', () => {
    const normalized = normalizeErosionTechnicalFields(null);
    expect(normalized).toEqual({
      localContexto: {
        localTipo: '',
        exposicao: '',
        estruturaProxima: '',
        localDescricao: '',
      },
      presencaAguaFundo: '',
      tiposFeicao: [],
      caracteristicasFeicao: [],
      usosSolo: [],
      usoSoloOutro: '',
      saturacaoPorAgua: '',
      tipoSolo: '',
      localizacaoExposicao: '',
      estruturaProxima: '',
      profundidadeMetros: null,
      declividadeGraus: null,
      distanciaEstruturaMetros: null,
      sinaisAvanco: false,
      vegetacaoInterior: false,
    });
  });

  it('fails when localContexto is missing', () => {
    const out = validateErosionTechnicalFields(null);
    expect(out.ok).toBe(false);
    expect(out.message).toContain('Selecione o local da erosao');
  });

  it('requires usoSoloOutro when usosSolo includes outro', () => {
    const out = validateErosionTechnicalFields({ usosSolo: ['outro'], usoSoloOutro: '' });
    expect(out.ok).toBe(false);
  });

  it('fails on invalid enum value', () => {
    const out = validateErosionTechnicalFields({ presencaAguaFundo: 'talvez' });
    expect(out.ok).toBe(false);
  });

  it('accepts valid technical payload', () => {
    const out = validateErosionTechnicalFields({
      presencaAguaFundo: 'sim',
      tiposFeicao: ['ravina', 'sulco'],
      caracteristicasFeicao: ['contato_materiais'],
      usosSolo: ['pastagem', 'outro'],
      usoSoloOutro: 'area urbana',
      saturacaoPorAgua: 'nao',
      tipoSolo: 'argiloso',
      localContexto: {
        localTipo: 'faixa_servidao',
        exposicao: 'faixa_servidao',
        estruturaProxima: 'torre',
        localDescricao: '',
      },
      profundidadeMetros: 1.1,
      declividadeGraus: 20,
      distanciaEstruturaMetros: 12,
      sinaisAvanco: true,
      vegetacaoInterior: false,
    });
    expect(out.ok).toBe(true);
    expect(out.value.usosSolo).toEqual(['pastagem', 'outro']);
    expect(out.value.tipoSolo).toBe('argiloso');
    expect(out.value.profundidadeMetros).toBe(1.1);
  });

  it('rejects legacy removed fields', () => {
    const out = validateErosionTechnicalFields({
      declividadeClasse: '>45',
    });
    expect(out.ok).toBe(false);
    expect(out.message).toContain('Campos legados removidos');
  });
});

describe('buildErosionReportRows/buildErosionsCsv', () => {
  it('includes technical fields in rows and csv headers', () => {
    const rows = buildErosionReportRows([
      {
        id: 'E1',
        projetoId: 'P1',
        presencaAguaFundo: 'sim',
        tiposFeicao: ['ravina', 'sulco'],
        caracteristicasFeicao: ['contato_materiais'],
        usosSolo: ['pastagem', 'outro'],
        usoSoloOutro: 'estrada',
        saturacaoPorAgua: 'nao',
      },
    ]);

    expect(rows[0].presencaAguaFundo).toBe('sim');
    expect(rows[0].tiposFeicao).toBe('ravina|sulco');
    expect(rows[0].usosSolo).toBe('pastagem|outro');

    const csv = buildErosionsCsv(rows);
    expect(csv).toContain('presencaAguaFundo');
    expect(csv).toContain('tiposFeicao');
    expect(csv).toContain('usoSoloOutro');
    expect(csv).toContain('saturacaoPorAgua');
    expect(csv).toContain('tipoSolo');
    expect(csv).toContain('criticidadeCodigo');
    expect(csv).not.toContain('declividadeClasse');
  });
});

describe('filterErosionsForReport', () => {
  it('includes erosion resolved by inspection project and year', () => {
    const erosions = [
      { id: 'E1', vistoriaId: 'VS-1', projetoId: '', ultimaAtualizacao: '' },
    ];
    const inspections = [
      { id: 'VS-1', projetoId: 'Emp-01', dataInicio: '2026-02-10' },
    ];

    const out = filterErosionsForReport(erosions, { projetoId: 'emp-01', anos: [2026] }, inspections);
    expect(out).toHaveLength(1);
  });

  it('returns full project history when years filter is empty', () => {
    const erosions = [
      { id: 'E1', projetoId: 'P1', ultimaAtualizacao: '2025-01-01T10:00:00Z' },
      { id: 'E2', projetoId: 'P1', ultimaAtualizacao: '2026-01-01T10:00:00Z' },
      { id: 'E3', projetoId: 'P2', ultimaAtualizacao: '2026-01-01T10:00:00Z' },
    ];
    const out = filterErosionsForReport(erosions, { projetoId: 'p1', anos: [] }, []);
    expect(out.map((i) => i.id)).toEqual(['E1', 'E2']);
  });
});

describe('deriveErosionTypeFromTechnicalFields', () => {
  it('derives canonical type from tiposFeicao', () => {
    expect(deriveErosionTypeFromTechnicalFields({ tiposFeicao: ['ravina'] })).toBe('ravina');
    expect(deriveErosionTypeFromTechnicalFields({ tiposFeicao: ['movimento_massa'] })).toBe('deslizamento');
    expect(deriveErosionTypeFromTechnicalFields({ tiposFeicao: ['laminar'] })).toBe('sulco');
  });
});

describe('buildManualFollowupEvent', () => {
  it('builds valid obra event', () => {
    const event = buildManualFollowupEvent({
      tipoEvento: 'obra',
      obraEtapa: 'Projeto',
      descricao: 'Projeto executivo aprovado',
    }, { updatedBy: 'alice@empresa.com' });
    expect(event?.tipoEvento).toBe('obra');
    expect(event?.resumo).toContain('Obra - Projeto');
  });

  it('marks stabilized when obra is concluded', () => {
    const event = buildManualFollowupEvent({
      tipoEvento: 'obra',
      obraEtapa: 'Concluida',
      descricao: 'Canaleta finalizada',
    }, { updatedBy: 'alice@empresa.com' });
    expect(event?.statusNovo).toBe('Estabilizado');
  });

  it('builds valid autuacao event', () => {
    const event = buildManualFollowupEvent({
      tipoEvento: 'autuacao',
      orgao: 'IBAMA',
      numeroOuDescricao: 'Auto 1234',
      autuacaoStatus: 'Aberta',
    }, { updatedBy: 'alice@empresa.com' });
    expect(event?.tipoEvento).toBe('autuacao');
    expect(event?.resumo).toContain('Autuacao (IBAMA)');
  });

  it('returns null for invalid event', () => {
    expect(buildManualFollowupEvent({ tipoEvento: 'obra', obraEtapa: '', descricao: '' }, {})).toBeNull();
  });
});

describe('normalizeFollowupEventType', () => {
  it('treats legacy event without type as sistema', () => {
    expect(normalizeFollowupEventType({ resumo: 'evento legado' })).toBe('sistema');
  });
});

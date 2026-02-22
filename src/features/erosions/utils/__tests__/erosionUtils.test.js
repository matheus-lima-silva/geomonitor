import {
  buildErosionsCsv,
  buildManualFollowupEvent,
  filterErosionsForReport,
  normalizeFollowupEventType,
  validateErosionLocation,
} from '../erosionUtils';

describe('validateErosionLocation', () => {
  it('falha sem localTipo', () => {
    expect(validateErosionLocation({ localTipo: '' }).ok).toBe(false);
  });

  it('exige descrição quando Outros', () => {
    expect(validateErosionLocation({ localTipo: 'Outros', localDescricao: '' }).ok).toBe(false);
    expect(validateErosionLocation({ localTipo: 'Outros', localDescricao: 'Talude lateral' }).ok).toBe(true);
  });
});

describe('buildErosionsCsv', () => {
  it('gera cabeçalho e linha', () => {
    const csv = buildErosionsCsv([{ id: 'E1', projetoId: 'P1' }]);
    expect(csv).toContain('id;projetoId');
    expect(csv).toContain('E1;P1');
  });
});

describe('filterErosionsForReport', () => {
  it('inclui erosão com projeto resolvido por vistoria e ignora case de projeto', () => {
    const erosions = [
      { id: 'E1', vistoriaId: 'VS-1', projetoId: '', ultimaAtualizacao: '' },
    ];
    const inspections = [
      { id: 'VS-1', projetoId: 'Emp-01', dataInicio: '2026-02-10' },
    ];

    const out = filterErosionsForReport(erosions, { projetoId: 'emp-01', anos: [2026] }, inspections);
    expect(out).toHaveLength(1);
  });

  it('quando anos vazio retorna todo histórico do empreendimento', () => {
    const erosions = [
      { id: 'E1', projetoId: 'P1', ultimaAtualizacao: '2025-01-01T10:00:00Z' },
      { id: 'E2', projetoId: 'P1', ultimaAtualizacao: '2026-01-01T10:00:00Z' },
      { id: 'E3', projetoId: 'P2', ultimaAtualizacao: '2026-01-01T10:00:00Z' },
    ];
    const out = filterErosionsForReport(erosions, { projetoId: 'p1', anos: [] }, []);
    expect(out.map((i) => i.id)).toEqual(['E1', 'E2']);
  });

  it('filtra por múltiplos anos selecionados', () => {
    const erosions = [
      { id: 'E1', projetoId: 'P1', ultimaAtualizacao: '2024-01-01T10:00:00Z' },
      { id: 'E2', projetoId: 'P1', ultimaAtualizacao: '2025-01-01T10:00:00Z' },
      { id: 'E3', projetoId: 'P1', ultimaAtualizacao: '2026-01-01T10:00:00Z' },
    ];
    const out = filterErosionsForReport(erosions, { projetoId: 'P1', anos: [2024, 2026] }, []);
    expect(out.map((i) => i.id)).toEqual(['E1', 'E3']);
  });

  it('resolve projeto e data com base em vistoriaIds quando vistoriaId principal não existe', () => {
    const erosions = [
      { id: 'E4', projetoId: '', vistoriaId: '', vistoriaIds: ['VS-10'] },
    ];
    const inspections = [
      { id: 'VS-10', projetoId: 'P-10', dataInicio: '2024-11-10' },
    ];
    const out = filterErosionsForReport(erosions, { projetoId: 'p-10', anos: [2024] }, inspections);
    expect(out.map((item) => item.id)).toEqual(['E4']);
  });
});

describe('buildManualFollowupEvent', () => {
  it('gera evento de obra válido', () => {
    const event = buildManualFollowupEvent({
      tipoEvento: 'obra',
      obraEtapa: 'Projeto',
      descricao: 'Projeto executivo aprovado',
    }, { updatedBy: 'alice@empresa.com' });
    expect(event?.tipoEvento).toBe('obra');
    expect(event?.resumo).toContain('Obra - Projeto');
  });

  it('marca statusNovo estabilizado quando obra está concluída', () => {
    const event = buildManualFollowupEvent({
      tipoEvento: 'obra',
      obraEtapa: 'Concluída',
      descricao: 'Canaleta e contenção finalizadas',
    }, { updatedBy: 'alice@empresa.com' });
    expect(event?.statusNovo).toBe('Estabilizado');
  });

  it('gera evento de autuação válido', () => {
    const event = buildManualFollowupEvent({
      tipoEvento: 'autuacao',
      orgao: 'IBAMA',
      numeroOuDescricao: 'Auto 1234',
      autuacaoStatus: 'Aberta',
    }, { updatedBy: 'alice@empresa.com' });
    expect(event?.tipoEvento).toBe('autuacao');
    expect(event?.resumo).toContain('Autuação (IBAMA)');
  });

  it('retorna null para evento inválido', () => {
    expect(buildManualFollowupEvent({ tipoEvento: 'obra', obraEtapa: '', descricao: '' }, {})).toBeNull();
  });
});

describe('normalizeFollowupEventType', () => {
  it('trata evento legado sem tipo como sistema', () => {
    expect(normalizeFollowupEventType({ resumo: 'evento legado' })).toBe('sistema');
  });
});

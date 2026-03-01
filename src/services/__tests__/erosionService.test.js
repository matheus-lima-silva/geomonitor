import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firestoreClient', () => ({
  deleteDocById: vi.fn(),
  loadDoc: vi.fn(),
  saveDoc: vi.fn(),
  subscribeCollection: vi.fn(),
}));

vi.mock('../../features/shared/statusUtils', () => ({
  normalizeErosionStatus: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  deleteField: vi.fn(() => '__DELETE__'),
}));

vi.mock('../../features/erosions/utils/erosionUtils', () => ({
  EROSION_REMOVED_FIELDS: [
    'profundidade',
    'declividadeClasse',
    'declividadeClassePdf',
    'faixaServidao',
    'areaTerceiros',
    'usoSolo',
    'soloSaturadoAgua',
  ],
  appendFollowupEvent: vi.fn(),
  buildManualFollowupEvent: vi.fn(),
  buildCriticalityInputFromErosion: vi.fn(),
  deriveErosionTypeFromTechnicalFields: vi.fn(),
  buildFollowupEvent: vi.fn(),
  normalizeErosionTechnicalFields: vi.fn(),
  normalizeFollowupHistory: vi.fn(),
  stripRemovedErosionFields: vi.fn((payload) => ({ ...(payload || {}) })),
  validateErosionTechnicalFields: vi.fn(),
}));

vi.mock('../../features/erosions/utils/criticalityV2', () => ({
  buildCriticalityTrend: vi.fn(() => 'estavel'),
  calcular_criticidade: vi.fn(() => ({
    criticidade_score: 10,
    criticidade_classe: 'Medio',
    codigo: 'C2',
    alertas_validacao: [],
    legacy: {
      impacto: 'Medio',
      score: 10,
      frequencia: '12 meses',
      intervencao: 'Canaletas vegetadas',
    },
  })),
  normalizeCriticalityHistory: vi.fn(() => []),
}));

import { deleteDocById, loadDoc, saveDoc, subscribeCollection } from '../firestoreClient';
import { normalizeErosionStatus } from '../../features/shared/statusUtils';
import {
  appendFollowupEvent,
  buildManualFollowupEvent,
  buildCriticalityInputFromErosion,
  deriveErosionTypeFromTechnicalFields,
  buildFollowupEvent,
  normalizeErosionTechnicalFields,
  normalizeFollowupHistory,
  validateErosionTechnicalFields,
} from '../../features/erosions/utils/erosionUtils';
import {
  deleteErosion,
  saveErosion,
  saveErosionManualFollowupEvent,
  subscribeErosions,
} from '../erosionService';

describe('erosionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateErosionTechnicalFields).mockReturnValue({
      ok: true,
      message: '',
      value: {
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
      },
    });
    vi.mocked(normalizeErosionTechnicalFields).mockReturnValue({
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
    vi.mocked(buildCriticalityInputFromErosion).mockReturnValue({
      tipo: '',
    });
    vi.mocked(deriveErosionTypeFromTechnicalFields).mockReturnValue('');
  });

  it('subscribeErosions delega para coleção erosions', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeCollection).mockReturnValue('UNSUB');

    const unsub = subscribeErosions(onData, onError);

    expect(subscribeCollection).toHaveBeenCalledWith('erosions', onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('saveErosion normaliza status, usa fallback crítico e histórico anterior em merge', async () => {
    vi.mocked(loadDoc).mockResolvedValue({
      id: 'ERS-7',
      acompanhamentosResumo: [{ tipo: 'LEGADO' }],
    });
    vi.mocked(normalizeErosionStatus).mockReturnValue('Resolvido');
    vi.mocked(normalizeFollowupHistory).mockReturnValue([{ tipo: 'NORMALIZADO' }]);
    vi.mocked(buildFollowupEvent).mockReturnValue({ tipo: 'AUTO' });
    vi.mocked(appendFollowupEvent).mockReturnValue([{ tipo: 'FINAL' }]);
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    const id = await saveErosion(
      {
        id: ' ERS-7 ',
        status: 'resolved',
        criticality: {
          impacto: 'Alto',
          score: 4,
          frequencia: '3 meses',
          intervencao: 'Obra emergencial',
        },
      },
      { merge: true, updatedBy: 'eng@empresa.com', origem: 'manual' },
    );

    expect(id).toBe('ERS-7');
    expect(loadDoc).toHaveBeenCalledWith('erosions', 'ERS-7');
    expect(normalizeErosionStatus).toHaveBeenCalledWith('resolved');
    expect(normalizeFollowupHistory).toHaveBeenCalledWith([{ tipo: 'LEGADO' }]);
    expect(buildFollowupEvent).toHaveBeenCalledWith(
      { id: 'ERS-7', acompanhamentosResumo: [{ tipo: 'LEGADO' }] },
      expect.objectContaining({
        id: 'ERS-7',
        status: 'Resolvido',
        impacto: 'Alto',
        score: 4,
        frequencia: '3 meses',
        intervencao: 'Obra emergencial',
        localContexto: {
          localTipo: '',
          exposicao: '',
          estruturaProxima: '',
          localDescricao: '',
        },
      }),
      {
        updatedBy: 'eng@empresa.com',
        isCreate: false,
        origem: 'manual',
      },
    );
    expect(appendFollowupEvent).toHaveBeenCalledWith([{ tipo: 'NORMALIZADO' }], { tipo: 'AUTO' });
    expect(saveDoc).toHaveBeenCalledWith(
      'erosions',
      'ERS-7',
      expect.objectContaining({
        id: 'ERS-7',
        status: 'Resolvido',
        impacto: 'Alto',
        score: 4,
        frequencia: '3 meses',
        intervencao: 'Obra emergencial',
        localContexto: {
          localTipo: '',
          exposicao: '',
          estruturaProxima: '',
          localDescricao: '',
        },
        localTipo: '__DELETE__',
        localDescricao: '__DELETE__',
        localizacaoExposicao: '__DELETE__',
        estruturaProxima: '__DELETE__',
        declividadeClasse: '__DELETE__',
        declividadeClassePdf: '__DELETE__',
        criticalidadeV2: expect.objectContaining({
          codigo: 'C2',
        }),
        historicoCriticidade: expect.any(Array),
        acompanhamentosResumo: [{ tipo: 'FINAL' }],
      }),
      {
        merge: true,
        updatedBy: 'eng@empresa.com',
        origem: 'manual',
      },
    );
  });

  it('saveErosion não carrega histórico quando merge false e respeita skipAutoFollowup', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-08-05T09:00:00.000Z'));
    vi.mocked(normalizeErosionStatus).mockReturnValue('Monitoramento');
    vi.mocked(normalizeFollowupHistory).mockReturnValue([]);
    vi.mocked(appendFollowupEvent).mockReturnValue([]);
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    const id = await saveErosion(
      {
        status: 'monitoring',
      },
      { skipAutoFollowup: true },
    );

    expect(id).toBe(`ERS-${Date.now()}`);
    expect(loadDoc).not.toHaveBeenCalled();
    expect(buildFollowupEvent).not.toHaveBeenCalled();
    expect(appendFollowupEvent).toHaveBeenCalledWith([], null);
    expect(saveDoc).toHaveBeenCalledWith(
      'erosions',
      id,
      expect.objectContaining({
        id,
        status: 'Monitoramento',
        impacto: 'Medio',
        score: 10,
        frequencia: '12 meses',
        intervencao: 'Canaletas vegetadas',
        declividadeClasse: '__DELETE__',
        declividadeClassePdf: '__DELETE__',
        criticalidadeV2: expect.objectContaining({
          codigo: 'C2',
        }),
      }),
      {
        skipAutoFollowup: true,
        merge: true,
      },
    );

    vi.useRealTimers();
  });

  it('deleteErosion delega exclusão', async () => {
    vi.mocked(deleteDocById).mockResolvedValue(undefined);

    await deleteErosion('ERS-1');

    expect(deleteDocById).toHaveBeenCalledWith('erosions', 'ERS-1');
  });

  it('saveErosion normaliza vistoriaIds com deduplicação mantendo principal', async () => {
    vi.mocked(loadDoc).mockResolvedValue({
      id: 'ERS-9',
      vistoriaId: 'VS-1',
      vistoriaIds: ['VS-1', 'VS-2'],
    });
    vi.mocked(normalizeErosionStatus).mockReturnValue('Ativo');
    vi.mocked(normalizeFollowupHistory).mockReturnValue([]);
    vi.mocked(buildFollowupEvent).mockReturnValue(null);
    vi.mocked(appendFollowupEvent).mockReturnValue([]);
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    await saveErosion({
      id: 'ERS-9',
      vistoriaId: 'VS-3',
      vistoriaIds: ['VS-3', 'VS-2', 'VS-3'],
      status: 'Ativo',
    }, { merge: true });

    expect(saveDoc).toHaveBeenCalledWith(
      'erosions',
      'ERS-9',
      expect.objectContaining({
        vistoriaId: 'VS-3',
        vistoriaIds: ['VS-3', 'VS-2', 'VS-1'],
      }),
      expect.objectContaining({ merge: true }),
    );
  });

  it('saveErosionManualFollowupEvent salva evento manual e estabiliza em obra concluida', async () => {
    vi.mocked(loadDoc).mockResolvedValue({
      id: 'ER-1',
      status: 'Ativo',
      acompanhamentosResumo: [],
      vistoriaId: 'VS-1',
      vistoriaIds: ['VS-1'],
    });
    vi.mocked(normalizeErosionStatus).mockImplementation((value) => String(value || '').trim() || 'Ativo');
    vi.mocked(normalizeFollowupHistory).mockReturnValue([]);
    vi.mocked(buildFollowupEvent).mockReturnValue(null);
    vi.mocked(appendFollowupEvent).mockImplementation((history, event) => {
      const list = Array.isArray(history) ? history : [];
      return event ? [...list, event] : [...list];
    });
    vi.mocked(buildManualFollowupEvent).mockReturnValue({
      tipoEvento: 'obra',
      obraEtapa: 'Concluida',
      descricao: 'Execucao finalizada',
      timestamp: '2026-03-01T10:00:00.000Z',
    });
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    const erosion = {
      id: 'ER-1',
      projetoId: 'P1',
      status: 'Ativo',
      vistoriaId: 'VS-1',
      vistoriaIds: ['VS-1'],
      acompanhamentosResumo: [],
    };

    const result = await saveErosionManualFollowupEvent(erosion, {
      tipoEvento: 'obra',
      obraEtapa: 'Concluida',
      descricao: 'Execucao finalizada',
    }, {
      updatedBy: 'analista@empresa.com',
      inspections: [{ id: 'VS-1', dataFim: '2026-02-10' }],
    });

    expect(buildManualFollowupEvent).toHaveBeenCalledWith({
      tipoEvento: 'obra',
      obraEtapa: 'Concluida',
      descricao: 'Execucao finalizada',
    }, { updatedBy: 'analista@empresa.com' });
    expect(result).toEqual({
      manualEvent: {
        tipoEvento: 'obra',
        obraEtapa: 'Concluida',
        descricao: 'Execucao finalizada',
        timestamp: '2026-03-01T10:00:00.000Z',
      },
      nextStatus: 'Estabilizado',
    });

    expect(saveDoc).toHaveBeenCalledWith(
      'erosions',
      'ER-1',
      expect.objectContaining({
        id: 'ER-1',
        status: 'Estabilizado',
        acompanhamentosResumo: [
          expect.objectContaining({
            tipoEvento: 'obra',
            obraEtapa: 'Concluida',
          }),
        ],
      }),
      expect.objectContaining({
        merge: true,
        skipAutoFollowup: true,
        updatedBy: 'analista@empresa.com',
      }),
    );
  });

  it('saveErosionManualFollowupEvent rejeita quando evento manual e invalido', async () => {
    vi.mocked(buildManualFollowupEvent).mockReturnValue(null);

    await expect(saveErosionManualFollowupEvent({ id: 'ER-2' }, { tipoEvento: 'obra' }, {}))
      .rejects
      .toThrow('Dados do evento invalidos.');
  });
});

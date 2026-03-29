import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));
import {
  deleteErosion,
  postCalculoErosao,
  saveErosion,
  saveErosionManualFollowupEvent,
  subscribeErosions
} from '../erosionService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('erosionService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('subscribeErosions busca lista via API', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'ERS-1', projetoId: 'P-1' }] })
    });

    const unsub = subscribeErosions(onData, onError);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toContain('/erosions');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'ERS-1' })]);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('saveErosion envia POST e retorna id da resposta', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'ERS-77' } })
    });

    await expect(
      saveErosion({ id: 'ERS-77', projetoId: 'P-1' }, { updatedBy: 'eng@empresa.com' })
    ).resolves.toBe('ERS-77');

    const call = fetchMock.mock.calls[0];
    const url = call[0];
    const request = call[1];
    expect(url).toContain('/erosions');
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer token-123');

    const body = JSON.parse(request.body);
    expect(body.data).toEqual({ id: 'ERS-77', projetoId: 'P-1' });
    expect(body.meta).toEqual({ updatedBy: 'eng@empresa.com' });
  });

  it('saveErosion falha quando usuario nao esta autenticado', async () => {
    const { getAccessToken, refreshAccessToken } = await import('../../utils/tokenStorage');
    getAccessToken.mockReturnValueOnce(null);
    refreshAccessToken.mockResolvedValueOnce(null);

    await expect(saveErosion({ id: 'ERS-1' })).rejects.toThrow(/autenticado/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('postCalculoErosao normaliza o breakdown completo da API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          criticidade_score: 8,
          criticidade_classe: 'Medio',
          codigo: 'C2',
          alertas_validacao: [],
          breakdown: {
            criticidade_score: 8,
            criticidade_classe: 'Medio',
            codigo: 'C2',
            pontos: { T: 2, P: 1, D: 2, S: 1, E: 2 },
            tipo_erosao_classe: 'T2',
            profundidade_classe: 'P1',
            declividade_classe: 'D2',
            solo_classe: 'S2',
            exposicao_classe: 'E2',
            tipo_medida_recomendada: 'monitoramento',
            lista_solucoes_sugeridas: ['Monitoramento visual'],
            alertas_validacao: [],
            legacy: {
              impacto: 'Medio',
              score: 8,
              frequencia: '12 meses',
              intervencao: 'Monitoramento visual'
            }
          }
        }
      })
    });

    const result = await postCalculoErosao({ tipo_erosao: 'sulco' });

    expect(result.campos_calculados).toEqual(expect.objectContaining({
      criticidade_score: 8,
      criticidade_classe: 'Medio',
      codigo: 'C2',
      pontos: { T: 2, P: 1, D: 2, S: 1, E: 2 },
      tipo_erosao_classe: 'T2'
    }));
  });

  it('saveErosionManualFollowupEvent falha com erosao invalida', async () => {
    await expect(
      saveErosionManualFollowupEvent(null, { tipoEvento: 'obra' }, {})
    ).rejects.toThrow(/Erosao invalida/i);
  });

  it('saveErosionManualFollowupEvent falha com dados de evento invalidos', async () => {
    await expect(
      saveErosionManualFollowupEvent(
        { id: 'ER-2', status: 'Ativo' },
        { tipoEvento: 'obra' },
        {}
      )
    ).rejects.toThrow('Dados do evento invalidos.');
  });

  it('saveErosionManualFollowupEvent estabiliza status em obra concluida', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'ER-1' } })
    });

    const result = await saveErosionManualFollowupEvent(
      {
        id: 'ER-1',
        status: 'Ativo',
        acompanhamentosResumo: [],
        vistoriaId: 'VS-1',
        vistoriaIds: ['VS-1']
      },
      {
        tipoEvento: 'obra',
        obraEtapa: 'Concluida',
        descricao: 'Execucao finalizada'
      },
      {
        updatedBy: 'analista@empresa.com',
        inspections: [{ id: 'VS-1', dataFim: '2026-02-10' }]
      }
    );

    expect(result.nextStatus).toBe('Estabilizado');
    expect(result.manualEvent).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(body.data.status).toBe('Estabilizado');
    expect(Array.isArray(body.data.acompanhamentosResumo)).toBe(true);
    expect(body.data.acompanhamentosResumo).toHaveLength(1);
    expect(body.meta).toEqual(
      expect.objectContaining({
        merge: true,
        skipAutoFollowup: true,
        updatedBy: 'analista@empresa.com'
      })
    );
  });

  it('deleteErosion envia DELETE para a API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteErosion('ERS-1')).resolves.toEqual({});
    expect(fetchMock.mock.calls[0][0]).toContain('/erosions/ERS-1');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123' }
    });
  });
});

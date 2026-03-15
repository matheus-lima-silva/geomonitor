import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { auth } from '../../firebase/config';
import {
  buildReportDeliveryTrackingId,
  normalizeReportDeliveryTrackingPayload,
  saveReportDeliveryTracking,
  subscribeReportDeliveryTracking,
} from '../reportDeliveryTrackingService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('reportDeliveryTrackingService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildReportDeliveryTrackingId valida projectId e monthKey', () => {
    expect(buildReportDeliveryTrackingId('P-1', '2026-03')).toBe('P-1__2026-03');
    expect(() => buildReportDeliveryTrackingId('', '2026-03')).toThrow(/obrigatorios/i);
    expect(() => buildReportDeliveryTrackingId('P-1', '03-2026')).toThrow(/obrigatorios/i);
  });

  it('normalizeReportDeliveryTrackingPayload normaliza status e deliveredAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));

    const normalized = normalizeReportDeliveryTrackingPayload({
      projectId: 'P-1',
      monthKey: '2026-03',
      operationalStatus: 'entregue',
      sourceOverride: 'manual',
      notes: ' ok ',
    });

    expect(normalized).toEqual({
      projectId: 'P-1',
      monthKey: '2026-03',
      operationalStatus: 'ENTREGUE',
      sourceOverride: 'AUTO',
      deliveredAt: '2026-03-15',
      notes: 'ok',
    });
  });

  it('subscribeReportDeliveryTracking busca lista via API e filtra linhas invalidas', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'P-1__2026-03',
            projectId: 'P-1',
            monthKey: '2026-03',
            operationalStatus: 'Entregue',
            sourceOverride: 'manual',
            deliveredAt: '2026-03-05',
            notes: 'ok',
            _links: {
              self: { href: '/api/report-delivery-tracking/P-1__2026-03', method: 'GET' },
              update: { href: '/api/report-delivery-tracking/P-1__2026-03', method: 'PUT' },
            },
          },
          { id: 'INVALID', projectId: '', monthKey: '2026-03' },
        ]
      })
    });

    const unsub = subscribeReportDeliveryTracking(onData, onError);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toContain('/report-delivery-tracking');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'P-1__2026-03',
        projectId: 'P-1',
        monthKey: '2026-03',
        operationalStatus: 'ENTREGUE',
        _links: expect.objectContaining({
          self: expect.objectContaining({ href: '/api/report-delivery-tracking/P-1__2026-03', method: 'GET' }),
          update: expect.objectContaining({ href: '/api/report-delivery-tracking/P-1__2026-03', method: 'PUT' }),
        }),
      })
    ]);
    expect(onError).not.toHaveBeenCalled();
    unsub();
  });

  it('saveReportDeliveryTracking usa link HATEOAS de update quando disponivel', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'P-1__2026-03' } })
    });

    await expect(
      saveReportDeliveryTracking('P-1', '2026-03', {
        operationalStatus: 'pendente',
        sourceOverride: 'manual',
        notes: 'obs',
        _links: {
          update: {
            href: 'https://geomonitor-api.fly.dev/api/report-delivery-tracking/P-1__2026-03',
            method: 'PUT'
          }
        }
      }, { updatedBy: 'ops@empresa.com', merge: true })
    ).resolves.toBe('P-1__2026-03');

    expect(fetchMock.mock.calls[0][0]).toContain('/report-delivery-tracking/P-1__2026-03');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      data: {
        id: 'P-1__2026-03',
        projectId: 'P-1',
        monthKey: '2026-03',
        operationalStatus: 'NAO_INICIADO',
        sourceOverride: 'AUTO',
        deliveredAt: '',
        notes: 'obs',
        _links: {
          update: {
            href: 'https://geomonitor-api.fly.dev/api/report-delivery-tracking/P-1__2026-03',
            method: 'PUT'
          }
        }
      },
      meta: { updatedBy: 'ops@empresa.com', merge: true }
    });
  });

  it('saveReportDeliveryTracking mantém fallback por rota quando _links não existem', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'P-1__2026-03' } })
    });

    await expect(
      saveReportDeliveryTracking('P-1', '2026-03', {
        operationalStatus: 'entregue',
        notes: 'ok',
      }, { updatedBy: 'ops@empresa.com' })
    ).resolves.toBe('P-1__2026-03');

    expect(fetchMock.mock.calls[0][0]).toContain('/report-delivery-tracking/P-1__2026-03');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });
});
import { describe, expect, it } from 'vitest';
import {
  ensurePendingTowersVisibleInDays,
  findDuplicateTowersAcrossDays,
  getPendingErosionsForInspection,
  isBrDateValid,
  isErosionLinkedToInspection,
  normalizeInspectionPendencies,
  normalizeLinkedInspectionIds,
  upsertInspectionPendency,
} from '../inspectionWorkflow';

describe('inspectionWorkflow', () => {
  it('normalizeInspectionPendencies deduplicates by vistoriaId', () => {
    const out = normalizeInspectionPendencies([
      { vistoriaId: 'V1', status: 'pendente', dia: '' },
      { vistoriaId: 'V1', status: 'visitada', dia: '02/02/2026' },
      { vistoriaId: 'V2', status: 'pending', dia: '' },
    ]);

    expect(out).toEqual([
      { vistoriaId: 'V1', status: 'visitada', dia: '02/02/2026' },
      { vistoriaId: 'V2', status: 'pendente', dia: '' },
    ]);
  });

  it('findDuplicateTowersAcrossDays returns towers present in multiple days', () => {
    const out = findDuplicateTowersAcrossDays([
      { data: '2026-01-10', torresInput: '1-3' },
      { data: '2026-01-11', torresInput: '3, 4' },
      { data: '2026-01-12', torresDetalhadas: [{ numero: '1' }] },
    ]);

    expect(out).toEqual([
      { tower: '1', days: ['10/01/2026', '12/01/2026'] },
      { tower: '3', days: ['10/01/2026', '11/01/2026'] },
    ]);
  });

  it('upsertInspectionPendency creates and updates pendencies', () => {
    const erosion = { pendenciasVistoria: [{ vistoriaId: 'V1', status: 'pendente', dia: '' }] };
    const created = upsertInspectionPendency(erosion, 'V2', { status: 'pendente' });
    expect(created).toContainEqual({ vistoriaId: 'V2', status: 'pendente', dia: '' });

    const updated = upsertInspectionPendency({ pendenciasVistoria: created }, 'V2', { status: 'visitada', dia: '01/03/2026' });
    expect(updated).toContainEqual({ vistoriaId: 'V2', status: 'visitada', dia: '01/03/2026' });
  });

  it('isBrDateValid validates DD/MM/YYYY format', () => {
    expect(isBrDateValid('01/03/2026')).toBe(true);
    expect(isBrDateValid('31/02/2026')).toBe(false);
    expect(isBrDateValid('2026-03-01')).toBe(false);
  });

  it('normalizeLinkedInspectionIds merges primary/list/pendencies ids', () => {
    const out = normalizeLinkedInspectionIds({
      vistoriaId: 'V2',
      vistoriaIds: ['V1', 'V2', 'V3'],
      pendenciasVistoria: [{ vistoriaId: 'V4' }, { vistoriaId: 'V1' }],
    });
    expect(out).toEqual(['V2', 'V1', 'V3', 'V4']);
  });

  it('getPendingErosionsForInspection returns only linked pending erosions', () => {
    const out = getPendingErosionsForInspection({
      projectId: 'P1',
      inspectionId: 'V1',
      erosions: [
        { id: 'ER-1', projetoId: 'P1', pendenciasVistoria: [{ vistoriaId: 'V1', status: 'pendente', dia: '' }] },
        { id: 'ER-2', projetoId: 'P1', pendenciasVistoria: [{ vistoriaId: 'V1', status: 'visitada', dia: '01/03/2026' }] },
        { id: 'ER-3', projetoId: 'P1', pendenciasVistoria: [{ vistoriaId: 'V2', status: 'pendente', dia: '' }] },
        { id: 'ER-4', projetoId: 'P2', pendenciasVistoria: [{ vistoriaId: 'V1', status: 'pendente', dia: '' }] },
      ],
    });

    expect(out.map((item) => item.id)).toEqual(['ER-1']);
  });

  it('ensurePendingTowersVisibleInDays keeps towers in their original day', () => {
    const out = ensurePendingTowersVisibleInDays({
      detailsDays: [
        { data: '2026-01-10', torresDetalhadas: [{ numero: '1', obs: '', temErosao: false }] },
        { data: '2026-01-11', torresDetalhadas: [{ numero: '5', obs: '', temErosao: false }] },
      ],
      pendingErosions: [
        { torreRef: '1' },
        { torreRef: '5' },
      ],
      targetDay: '2026-01-10',
    });

    expect(out[0].torresDetalhadas.map((tower) => tower.numero)).toEqual(['1']);
    expect(out[1].torresDetalhadas.map((tower) => tower.numero)).toEqual(['5']);
    expect(out[0].torresDetalhadas[0].temErosao).toBe(true);
    expect(out[1].torresDetalhadas[0].temErosao).toBe(true);
  });

  it('isErosionLinkedToInspection checks vistoriaId, vistoriaIds, and pendencies', () => {
    expect(isErosionLinkedToInspection({ vistoriaId: 'V1' }, 'V1')).toBe(true);
    expect(isErosionLinkedToInspection({ vistoriaIds: ['V2', 'V3'] }, 'V3')).toBe(true);
    expect(isErosionLinkedToInspection({ pendenciasVistoria: [{ vistoriaId: 'V4' }] }, 'V4')).toBe(true);
    expect(isErosionLinkedToInspection({ vistoriaId: 'V1' }, 'V99')).toBe(false);
    expect(isErosionLinkedToInspection({}, 'V1')).toBe(false);
    expect(isErosionLinkedToInspection({ vistoriaId: 'V1' }, '')).toBe(false);
  });
});

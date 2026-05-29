import { describe, expect, it } from 'vitest';
import {
  easterDate,
  dateKey,
  parseDateKey,
  brazilHolidaysFor,
  buildHolidaySet,
  isWorkingDay,
} from '../holidays';
import { getDateRange, getActivitySegments, packWeekActivities } from '../calendar';
import { computedMetaForProject, formatDateLabel } from '../projectMeta';

describe('holidays', () => {
  it('calcula a Pascoa de 2026 (05/04)', () => {
    expect(dateKey(easterDate(2026))).toBe('2026-04-05');
  });

  it('inclui moveis e fixos de 2026 (Sexta-feira Santa, Carnaval, Corpus Christi, Tiradentes)', () => {
    const byDate = Object.fromEntries(brazilHolidaysFor(2026).map((h) => [h.date, h.name]));
    expect(byDate['2026-04-03']).toBe('Sexta-feira Santa');
    expect(byDate['2026-02-17']).toBe('Carnaval');
    expect(byDate['2026-06-04']).toBe('Corpus Christi');
    expect(byDate['2026-04-21']).toBe('Tiradentes');
    expect(byDate['2026-04-23']).toBe('São Jorge'); // estadual RJ
  });

  it('isWorkingDay: sabado e feriado nao contam; dia util normal conta', () => {
    const set = buildHolidaySet(2026, 4, []);
    expect(isWorkingDay(parseDateKey('2026-04-18'), set)).toBe(false); // sabado
    expect(isWorkingDay(parseDateKey('2026-04-21'), set)).toBe(false); // Tiradentes
    expect(isWorkingDay(parseDateKey('2026-04-20'), set)).toBe(true); // segunda util
  });

  it('buildHolidaySet inclui overrides do usuario', () => {
    const set = buildHolidaySet(2026, 4, [{ date: '2026-04-20', name: 'Ponto facultativo' }]);
    expect(isWorkingDay(parseDateKey('2026-04-20'), set)).toBe(false);
  });
});

describe('calendar', () => {
  it('getDateRange: dia 16 do mes anterior ate dia 15 do mes de referencia', () => {
    const { start, end } = getDateRange(2026, 4); // Maio/2026
    expect(dateKey(start)).toBe('2026-04-16');
    expect(dateKey(end)).toBe('2026-05-15');
  });

  it('getActivitySegments: atividade de 1 dia rende 1 segmento na coluna certa', () => {
    const segs = getActivitySegments(
      { startDate: '2026-04-16', endDate: '2026-04-16' },
      parseDateKey('2026-04-12'), // domingo (inicio da semana)
      parseDateKey('2026-04-18'),
      buildHolidaySet(2026, 4, []),
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ startCol: 5, endCol: 5, showText: true });
  });

  it('packWeekActivities empilha atividades sobrepostas em lanes distintas', () => {
    const set = buildHolidaySet(2026, 4, []);
    const positioned = packWeekActivities(
      [
        { id: 'a', startDate: '2026-04-16', endDate: '2026-04-16', category: 'vistoria' },
        { id: 'b', startDate: '2026-04-16', endDate: '2026-04-16', category: 'doc' },
      ],
      parseDateKey('2026-04-12'),
      parseDateKey('2026-04-18'),
      set,
    );
    expect(positioned).toHaveLength(2);
    const lanes = positioned.map((p) => p.lane).sort();
    expect(lanes).toEqual([0, 1]);
  });
});

describe('projectMeta', () => {
  it('computedMetaForProject monta categorias + dias uteis pulando feriado', () => {
    const set = buildHolidaySet(2026, 4, []);
    const activities = [
      { id: '1', projectId: 'P1', category: 'vistoria', startDate: '2026-04-16', endDate: '2026-04-16' },
      // 20 e segunda util; 21 e Tiradentes (excluido em multi-dia)
      { id: '2', projectId: 'P1', category: 'relatorio', startDate: '2026-04-20', endDate: '2026-04-21' },
      { id: '3', projectId: 'P2', category: 'geo', startDate: '2026-04-17', endDate: '2026-04-17' },
    ];
    const meta = computedMetaForProject(activities, 'P1', 2026, 4, set);
    expect(meta).toBe('VISTORIA, RELATÓRIO · 16 E 20/04 (2 DIAS ÚTEIS)');
  });

  it('computedMetaForProject retorna vazio sem atividades vinculadas', () => {
    expect(computedMetaForProject([], 'P1', 2026, 4, buildHolidaySet(2026, 4, []))).toBe('');
  });

  it('formatDateLabel agrupa por mes', () => {
    expect(formatDateLabel(['2026-04-16', '2026-04-24', '2026-05-04'])).toBe('16 E 24/04 E 04/05');
  });
});

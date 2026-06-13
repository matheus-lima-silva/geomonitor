import { describe, expect, it } from 'vitest';
import {
  easterDate,
  dateKey,
  parseDateKey,
  brazilHolidaysFor,
  officialHolidaysForPeriod,
  buildHolidaySet,
  isWorkingDay,
} from '../holidays';
import { getDateRange, getActivitySegments, packWeekActivities } from '../calendar';
import { introTemplate, conclusaoTemplate, listEngineerNames } from '../templates';
import { genId, ID_PREFIX } from '../ids';

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

  it('officialHolidaysForPeriod filtra ao periodo 16->15 e ordena por data', () => {
    // Maio/2026: periodo 16/04 a 15/05 cobre Tiradentes, Sao Jorge e Dia do Trabalho.
    const list = officialHolidaysForPeriod(2026, 4);
    expect(list.map((h) => h.date)).toEqual(['2026-04-21', '2026-04-23', '2026-05-01']);
  });

  it('officialHolidaysForPeriod cruza a virada de ano (Janeiro)', () => {
    // Janeiro/2026: periodo 16/12/2025 a 15/01/2026 — Natal, Confraternizacao.
    const dates = officialHolidaysForPeriod(2026, 0).map((h) => h.date);
    expect(dates).toContain('2025-12-25');
    expect(dates).toContain('2026-01-01');
    expect(dates.every((d) => d >= '2025-12-16' && d <= '2026-01-15')).toBe(true);
  });

  it('buildHolidaySet usa somente a lista explicita do relatorio', () => {
    const set = buildHolidaySet([{ date: '2026-04-21', name: 'Tiradentes' }]);
    expect(isWorkingDay(parseDateKey('2026-04-21'), set)).toBe(false); // marcado
    expect(isWorkingDay(parseDateKey('2026-05-01'), set)).toBe(true); // nao marcado => util
    expect(isWorkingDay(parseDateKey('2026-04-18'), set)).toBe(false); // sabado
    expect(isWorkingDay(parseDateKey('2026-04-20'), set)).toBe(true); // segunda util
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
      buildHolidaySet([]),
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ startCol: 5, endCol: 5, showText: true });
  });

  it('getActivitySegments pula feriado marcado na lista explicita', () => {
    const set = buildHolidaySet([{ date: '2026-04-21', name: 'Tiradentes' }]);
    // Semana 19-25/04; atividade 20->22 quebra em [seg 20] e [qua 22] pulando 21.
    const segs = getActivitySegments(
      { startDate: '2026-04-20', endDate: '2026-04-22' },
      parseDateKey('2026-04-19'),
      parseDateKey('2026-04-25'),
      set,
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ startCol: 2, endCol: 2 });
    expect(segs[1]).toMatchObject({ startCol: 4, endCol: 4 });
  });

  it('packWeekActivities empilha atividades sobrepostas em lanes distintas', () => {
    const set = buildHolidaySet([]);
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

describe('templates', () => {
  it('listEngineerNames junta nomes com "e" final', () => {
    expect(listEngineerNames([])).toBe('da equipe');
    expect(listEngineerNames([{ name: 'Ana' }])).toBe('Ana');
    expect(listEngineerNames([{ name: 'Ana' }, { name: 'Bia' }, { name: 'Caio' }])).toBe('Ana, Bia e Caio');
  });

  it('introTemplate embute periodo, engenheiros e contrato', () => {
    const text = introTemplate({
      refYear: 2026,
      refMonth: 4,
      engineers: [{ name: 'Matheus Lima' }, { name: 'Victor Britto' }],
      contrato: { numero: '30001490', objeto: 'APOIO', contratante: 'AXIA', contratada: 'CONCREMAT' },
    });
    expect(text).toContain('16 de abril a 15 de maio de 2026');
    expect(text).toContain('Matheus Lima e Victor Britto');
    expect(text).toContain('contrato nº 30001490');
    expect(text).toContain('contratante AXIA');
    expect(text).toContain('contratada CONCREMAT');
  });

  it('conclusaoTemplate retorna o paragrafo padrao', () => {
    expect(conclusaoTemplate()).toContain('campanhas de vistoria');
  });
});

describe('ids', () => {
  it('genId aplica o prefixo e gera ids distintos', () => {
    const a = genId(ID_PREFIX.engineer);
    const b = genId(ID_PREFIX.engineer);
    expect(a).toMatch(/^MRE-/);
    expect(a).not.toBe(b);
  });
});

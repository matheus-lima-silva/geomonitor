import { describe, expect, it } from 'vitest';
import { activitiesOnDate, computeDropDates, applyDrop, applyDayEdits, toggleHoliday } from '../dayEdit';

const BASE = [
  { id: 'MRA-1', category: 'vistoria', description: 'Vistoria LT', startDate: '2026-04-16', endDate: '2026-04-18' },
  { id: 'MRA-2', category: 'doc', description: 'Documentos', startDate: '2026-04-20', endDate: '2026-04-20' },
];

describe('activitiesOnDate', () => {
  it('retorna atividades cujo intervalo cobre a data (sem filtro de dia util)', () => {
    expect(activitiesOnDate(BASE, '2026-04-17').map((a) => a.id)).toEqual(['MRA-1']);
    expect(activitiesOnDate(BASE, '2026-04-20').map((a) => a.id)).toEqual(['MRA-2']);
    expect(activitiesOnDate(BASE, '2026-04-19')).toHaveLength(0);
  });
});

describe('computeDropDates', () => {
  const act = BASE[0]; // 16 -> 18 (3 dias)

  it('copy/move preserva a duracao a partir da celula alvo', () => {
    expect(computeDropDates('copy', act, '2026-04-22')).toEqual({ startDate: '2026-04-22', endDate: '2026-04-24' });
    expect(computeDropDates('move', act, '2026-05-01')).toEqual({ startDate: '2026-05-01', endDate: '2026-05-03' });
  });

  it('move preserva duracao cruzando a virada de mes', () => {
    expect(computeDropDates('move', act, '2026-04-29')).toEqual({ startDate: '2026-04-29', endDate: '2026-05-01' });
  });

  it('resize-start move o inicio sem ultrapassar o fim', () => {
    expect(computeDropDates('resize-start', act, '2026-04-14')).toEqual({ startDate: '2026-04-14', endDate: '2026-04-18' });
    expect(computeDropDates('resize-start', act, '2026-04-25')).toEqual({ startDate: '2026-04-18', endDate: '2026-04-18' });
  });

  it('resize-end move o fim sem recuar do inicio', () => {
    expect(computeDropDates('resize-end', act, '2026-04-24')).toEqual({ startDate: '2026-04-16', endDate: '2026-04-24' });
    expect(computeDropDates('resize-end', act, '2026-04-10')).toEqual({ startDate: '2026-04-16', endDate: '2026-04-16' });
  });
});

describe('applyDrop', () => {
  it('copy cria atividade nova com mesma categoria/descricao', () => {
    const next = applyDrop(BASE, 'MRA-1', 'copy', '2026-04-27');
    expect(next).toHaveLength(3);
    const copy = next[2];
    expect(copy.id).toMatch(/^MRA-/);
    expect(copy.id).not.toBe('MRA-1');
    expect(copy).toMatchObject({ category: 'vistoria', description: 'Vistoria LT', startDate: '2026-04-27', endDate: '2026-04-29' });
  });

  it('move atualiza a atividade existente', () => {
    const next = applyDrop(BASE, 'MRA-2', 'move', '2026-04-23');
    expect(next).toHaveLength(2);
    expect(next.find((a) => a.id === 'MRA-2')).toMatchObject({ startDate: '2026-04-23', endDate: '2026-04-23' });
  });

  it('ignora id inexistente', () => {
    expect(applyDrop(BASE, 'MRA-x', 'move', '2026-04-23')).toBe(BASE);
  });
});

describe('applyDayEdits', () => {
  it('atualiza linhas existentes e adiciona novas', () => {
    const rows = [
      { id: 'MRA-1', category: 'relatorio', description: 'Editada', startDate: '2026-04-16', endDate: '2026-04-18' },
      { id: null, category: 'geo', description: 'Nova', startDate: '2026-04-16', endDate: '2026-04-16' },
    ];
    const next = applyDayEdits(BASE, '2026-04-16', rows);
    expect(next.find((a) => a.id === 'MRA-1')).toMatchObject({ category: 'relatorio', description: 'Editada' });
    expect(next.find((a) => a.description === 'Nova')).toBeTruthy();
    expect(next.find((a) => a.id === 'MRA-2')).toBeTruthy(); // nao cobria o dia, intacta
  });

  it('descarta linhas sem descricao e corrige datas invertidas', () => {
    const rows = [
      { id: null, category: 'outro', description: '   ', startDate: '2026-04-16', endDate: '2026-04-16' },
      { id: null, category: 'outro', description: 'Invertida', startDate: '2026-04-20', endDate: '2026-04-16' },
    ];
    const next = applyDayEdits([], '2026-04-16', rows);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ startDate: '2026-04-16', endDate: '2026-04-20' });
  });

  it('exclui atividades que cobriam o dia e sairam da lista', () => {
    const next = applyDayEdits(BASE, '2026-04-17', []); // MRA-1 cobre 17 e foi removida
    expect(next.map((a) => a.id)).toEqual(['MRA-2']);
  });
});

describe('toggleHoliday', () => {
  it('adiciona e remove o feriado da data', () => {
    const added = toggleHoliday([], '2026-04-21', 'Tiradentes');
    expect(added).toEqual([{ date: '2026-04-21', name: 'Tiradentes' }]);
    expect(toggleHoliday(added, '2026-04-21')).toEqual([]);
  });

  it('mantem a lista ordenada por data', () => {
    const list = toggleHoliday([{ date: '2026-05-01', name: 'Dia do Trabalho' }], '2026-04-21', 'Tiradentes');
    expect(list.map((h) => h.date)).toEqual(['2026-04-21', '2026-05-01']);
  });
});

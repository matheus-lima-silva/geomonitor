import { describe, expect, it } from 'vitest';
import { buildDocModel, buildQuadroWeeks, EMPTY_INTRO } from '../docModel';
import fixture from '../../../../../../../worker/tests/fixtures/monthly_report_render_model.json';

const report = fixture.monthlyReport;

describe('buildDocModel (fixture compartilhada com o worker)', () => {
  it('snapshot estrutural — mudou aqui, muda o renderer Python junto', () => {
    expect(buildDocModel(report)).toMatchSnapshot();
  });

  it('monta cabecalho, sumario de blocos e secoes na ordem do documento', () => {
    const model = buildDocModel(report);
    expect(model.title).toBe('RELATÓRIO MENSAL DE ACOMPANHAMENTO DOS SERVIÇOS');
    expect(model.monthLabel).toBe('MAIO - 2026');
    expect(model.periodLabel).toBe('Período: 16/04/2026 a 15/05/2026');

    const kinds = model.blocks.map((b) => b.kind);
    const headings = model.blocks.filter((b) => b.kind.startsWith('heading')).map((b) => b.text);
    expect(headings).toEqual([
      '1 INTRODUÇÃO',
      '2 ATIVIDADES REALIZADAS NO PERÍODO',
      '2.1 Atividades que o eng. Matheus Lima realizou',
      '2.1.1 Resumo por projeto:',
      '2.2 Atividades que o eng. Victor Britto realizou',
      '2.2.1 Resumo por projeto:',
      '3 CONCLUSÃO',
    ]);
    // Cada engenheiro tem quadro + legenda + bullets.
    expect(kinds.filter((k) => k === 'quadro')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'legend')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'bullets')).toHaveLength(2);
  });

  it('usa placeholder italico quando a introducao esta vazia', () => {
    const model = buildDocModel({ ...report, intro: '' });
    const emptyBlock = model.blocks.find((b) => b.kind === 'empty');
    expect(emptyBlock.text).toBe(EMPTY_INTRO);
  });

  it('bullets ignoram projetos sem nome e sem texto', () => {
    const model = buildDocModel({
      ...report,
      engineers: [{
        ...report.engineers[0],
        projects: [
          { id: 'p1', name: '', description: '' },
          { id: 'p2', name: 'Só nome', description: '' },
        ],
      }],
    });
    const bullets = model.blocks.find((b) => b.kind === 'bullets');
    expect(bullets.items).toEqual([{ name: 'Só nome', text: '' }]);
  });
});

describe('buildQuadroWeeks', () => {
  const weeksFor = buildQuadroWeeks(report);
  const weeks = weeksFor(report.engineers[0].activities);

  it('cobre o periodo em semanas completas domingo->sabado', () => {
    expect(weeks).toHaveLength(5); // 12/04 a 16/05/2026
    weeks.forEach((week) => expect(week).toHaveLength(7));
    expect(weeks[0][0].dateKey).toBe('2026-04-12');
    expect(weeks[4][6].dateKey).toBe('2026-05-16');
  });

  it('feriado marcado esconde atividade multi-dia e mostra o nome', () => {
    const cells = weeks.flat();
    const tiradentes = cells.find((c) => c.dateKey === '2026-04-21');
    expect(tiradentes.holidayName).toBe('Tiradentes');
    // MRA-1 (16->24, multi-dia) nao aparece no feriado...
    expect(tiradentes.activities).toHaveLength(0);
    // ...mas aparece no dia util seguinte como continuacao.
    const day22 = cells.find((c) => c.dateKey === '2026-04-22');
    expect(day22.activities.some((a) => a.description.includes('LT 500kv') && !a.isFirstDay)).toBe(true);
  });

  it('marca isFirstDay no primeiro dia da atividade', () => {
    const day16 = weeks.flat().find((c) => c.dateKey === '2026-04-16');
    expect(day16.activities.some((a) => a.isFirstDay && a.description.includes('LT 500kv'))).toBe(true);
  });

  it('dias fora do periodo ficam sem atividades e sem feriado', () => {
    const out = weeks.flat().find((c) => c.dateKey === '2026-04-12');
    expect(out.inRange).toBe(false);
    expect(out.activities).toHaveLength(0);
  });
});

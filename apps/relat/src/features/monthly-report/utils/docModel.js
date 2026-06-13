// Modelo estrutural do documento "Relatorio Mensal de Acompanhamento dos
// Servicos": a MESMA sequencia de blocos que o renderer Python emite no DOCX
// (capa -> sumario -> 1 INTRODUCAO -> 2 ATIVIDADES por engenheiro com quadro
// semanal + legenda + resumo -> 3 CONCLUSAO). A preview (DocSheet) renderiza
// este modelo; a fixture compartilhada com o worker trava a paridade
// estrutural — mudou aqui, muda em worker/monthly_report_renderer.py junto.

import { MONTHS } from './constants';
import { SECTION2_LEAD, ENG_LEAD, RESUMO_DESC } from './templates';
import { getDateRange, fmtDate, activitiesVisibleOnDate } from './calendar';
import { buildHolidaySet, dateKey } from './holidays';

export const DOC_TITLE = 'RELATÓRIO MENSAL DE ACOMPANHAMENTO DOS SERVIÇOS';
export const DOC_SUBTITLE = 'Relatório Mensal de Acompanhamento dos Serviços';
export const CLASSIFICATION = 'Classificação: Interna';

export const EMPTY_INTRO = 'Introdução ainda não escrita — use o texto-modelo na etapa 1.';
export const EMPTY_CONCLUSAO = 'Conclusão ainda não escrita — use o texto-modelo na etapa 3.';

function splitParagraphs(text) {
  return String(text || '')
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// Matriz semanal do quadro do Word: semanas domingo->sabado cobrindo o
// periodo, celulas com numero do dia, fundo (fora/feriado/fds) e atividades
// visiveis (multi-dia so em dias uteis; ● primeiro dia, ↳ continuacao).
export function buildQuadroWeeks(report) {
  const { start, end } = getDateRange(report.refYear, report.refMonth);
  const holidaySet = buildHolidaySet(report.holidays);
  const holidayByDate = new Map((report.holidays || []).map((h) => [h.date, h]));

  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  return (engineerActivities) => {
    const weeks = [];
    let week = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      const inRange = d >= start && d <= end;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const holiday = inRange ? holidayByDate.get(key) : null;
      const visible = inRange ? activitiesVisibleOnDate(engineerActivities, key, holidaySet) : [];
      week.push({
        dateKey: key,
        dayNum: d.getDate(),
        inRange,
        isWeekend,
        holidayName: holiday ? (holiday.name || 'Feriado') : null,
        activities: visible.map((a) => ({
          category: a.category,
          description: a.description,
          isFirstDay: key === a.startDate,
        })),
      });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    return weeks;
  };
}

// Modelo completo do documento a partir do estado do relatorio.
export function buildDocModel(report) {
  const { start, end } = getDateRange(report.refYear, report.refMonth);
  const monthLabel = `${MONTHS[report.refMonth].toUpperCase()} - ${report.refYear}`;
  const weeksFor = buildQuadroWeeks(report);

  const blocks = [];
  blocks.push({ kind: 'heading1', text: '1 INTRODUÇÃO' });
  const introParas = splitParagraphs(report.intro);
  blocks.push(introParas.length > 0
    ? { kind: 'paragraphs', texts: introParas }
    : { kind: 'empty', text: EMPTY_INTRO });

  blocks.push({ kind: 'heading1', text: '2 ATIVIDADES REALIZADAS NO PERÍODO' });
  blocks.push({ kind: 'paragraphs', texts: [SECTION2_LEAD] });

  (report.engineers || []).forEach((engineer, i) => {
    const n = i + 1;
    blocks.push({ kind: 'heading2', text: `2.${n} Atividades que o eng. ${engineer.name || `Engenheiro ${n}`} realizou` });
    blocks.push({ kind: 'paragraphs', texts: [ENG_LEAD] });
    blocks.push({ kind: 'quadro', engineerId: engineer.id, quadroStyle: report.quadroStyle || 'marcador', weeks: weeksFor(engineer.activities || []) });
    blocks.push({ kind: 'legend' });
    blocks.push({ kind: 'heading3', text: `2.${n}.1 Resumo por projeto:` });
    blocks.push({ kind: 'paragraphs', texts: [RESUMO_DESC] });
    const bullets = (engineer.projects || [])
      .filter((p) => (p.name || '').trim() || (p.description || '').trim())
      .map((p) => ({
        name: (p.name || '').trim() || 'Empreendimento',
        text: String(p.description || '').replace(/\n+/g, ' ').trim(),
      }));
    if (bullets.length > 0) blocks.push({ kind: 'bullets', items: bullets });
  });

  blocks.push({ kind: 'heading1', text: '3 CONCLUSÃO' });
  const conclusaoParas = splitParagraphs(report.conclusao);
  blocks.push(conclusaoParas.length > 0
    ? { kind: 'paragraphs', texts: conclusaoParas }
    : { kind: 'empty', text: EMPTY_CONCLUSAO });

  return {
    title: DOC_TITLE,
    subtitle: DOC_SUBTITLE,
    monthLabel,
    periodLabel: `Período: ${fmtDate(start)} a ${fmtDate(end)}`,
    classification: CLASSIFICATION,
    blocks,
  };
}

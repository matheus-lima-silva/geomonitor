import StepCard from './StepCard';
import { getDateRange, countWorkingDays, fmtDate } from '../../utils/calendar';
import { buildHolidaySet } from '../../utils/holidays';

/**
 * Card 2 — Atividades realizadas no periodo. Rotulo do periodo + area do
 * calendario interativo e resumo por projeto (preenchidos na etapa do
 * calendario; este card define a estrutura e o rotulo).
 */
export default function ActivitiesCard({ report, children }) {
  const { start, end } = getDateRange(report.refYear, report.refMonth);
  const holidaySet = buildHolidaySet(report.holidays);
  const workingDays = countWorkingDays(report.refYear, report.refMonth, holidaySet);

  return (
    <StepCard
      id="sec-ativ"
      number={2}
      title="Atividades realizadas no período"
      subtitle={(
        <span className="font-mono text-xs text-slate-500">
          Período: {fmtDate(start)} – {fmtDate(end)} · {workingDays} dias úteis
        </span>
      )}
    >
      {children}
    </StepCard>
  );
}

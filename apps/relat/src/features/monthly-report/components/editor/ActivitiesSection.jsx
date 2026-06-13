import { useEffect, useState } from 'react';
import EngineerSelector from './EngineerSelector';
import ProjectSummaryList from './ProjectSummaryList';
import CalendarGrid from '../calendar/CalendarGrid';
import CategoryLegend from '../calendar/CategoryLegend';
import DayActivitiesModal from '../modals/DayActivitiesModal';
import { applyDayEdits, toggleHoliday } from '../../utils/dayEdit';
import { genId, ID_PREFIX } from '../../utils/ids';

/**
 * Conteudo do card 2: seletor de engenheiro + calendario interativo + legenda
 * + resumo por projeto. Toda mutacao passa por updateReport (autosave).
 */
export default function ActivitiesSection({ report, updateReport }) {
  const engineers = report.engineers || [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [dayModal, setDayModal] = useState(null); // dateStr | null

  // Mantem o indice valido quando engenheiros mudam (remocao, troca de mes).
  useEffect(() => {
    if (activeIndex > Math.max(0, engineers.length - 1)) {
      setActiveIndex(Math.max(0, engineers.length - 1));
    }
  }, [engineers.length, activeIndex]);

  const active = engineers[Math.min(activeIndex, Math.max(0, engineers.length - 1))];
  if (!active) {
    return <p className="m-0 text-sm text-slate-400">Adicione um engenheiro para lançar atividades.</p>;
  }

  function updateEngineer(engineerId, patch) {
    updateReport((r) => ({
      ...r,
      engineers: r.engineers.map((e) => (e.id === engineerId ? { ...e, ...patch } : e)),
    }));
  }

  return (
    <div>
      <div className="mb-3">
        <EngineerSelector
          engineers={engineers}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onAdd={() => {
            updateReport((r) => ({
              ...r,
              engineers: [...r.engineers, {
                id: genId(ID_PREFIX.engineer),
                name: '',
                sortOrder: r.engineers.length,
                activities: [],
                projects: [],
              }],
            }));
            setActiveIndex(engineers.length);
          }}
          onRename={(engineerId, name) => updateEngineer(engineerId, { name })}
          onRemove={(engineerId) => {
            updateReport((r) => ({ ...r, engineers: r.engineers.filter((e) => e.id !== engineerId) }));
          }}
        />
      </div>

      <p className="m-0 mb-2 text-xs text-slate-500">
        Clique em um dia para lançar · arraste a barra para copiar · Ctrl+arraste para mover · arraste as bordas para ajustar a duração
      </p>

      <CalendarGrid
        refYear={report.refYear}
        refMonth={report.refMonth}
        activities={active.activities}
        holidays={report.holidays}
        onActivitiesChange={(activities) => updateEngineer(active.id, { activities })}
        onDayClick={(dateStr) => setDayModal(dateStr)}
      />
      <CategoryLegend />

      <ProjectSummaryList
        projects={active.projects}
        onChange={(projects) => updateEngineer(active.id, { projects })}
      />

      <DayActivitiesModal
        open={Boolean(dayModal)}
        dateStr={dayModal}
        activities={active.activities}
        holidays={report.holidays}
        onClose={() => setDayModal(null)}
        onSaveRows={(dateStr, rows) => {
          updateEngineer(active.id, { activities: applyDayEdits(active.activities, dateStr, rows) });
          setDayModal(null);
        }}
        onToggleHoliday={(dateStr, name) => {
          updateReport((r) => ({ ...r, holidays: toggleHoliday(r.holidays, dateStr, name || '') }));
        }}
      />
    </div>
  );
}

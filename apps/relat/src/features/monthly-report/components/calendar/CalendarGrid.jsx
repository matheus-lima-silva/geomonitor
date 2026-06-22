import { useMemo, useRef } from 'react';
import { CATEGORIES } from '../../utils/constants';
import { getDateRange, packWeekActivities } from '../../utils/calendar';
import { dateKey, parseDateKey } from '../../utils/holidays';
import { applyDrop } from '../../utils/dayEdit';

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildWeeks(refYear, refMonth) {
  const { start, end } = getDateRange(refYear, refMonth);
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks = [];
  for (let ws = new Date(gridStart); ws <= gridEnd; ws.setDate(ws.getDate() + 7)) {
    const weekStart = new Date(ws);
    const weekEnd = new Date(ws);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({ weekStart, weekEnd });
  }
  return { start, end, weeks };
}

/**
 * Calendario interativo do periodo (16 -> 15): clique no dia abre o modal de
 * lancamento; arrastar a barra copia, Ctrl/Cmd+arrastar move e as bordas
 * redimensionam (drag & drop nativo, como no design handoff). Barras
 * multi-dia sao continuas; a aritmetica do drop vive em utils/dayEdit.js.
 */
export default function CalendarGrid({ refYear, refMonth, activities, holidays, onActivitiesChange, onDayClick }) {
  const dragRef = useRef(null); // { activityId, mode }
  const pendingResizeRef = useRef(null);
  const todayKey = dateKey(new Date());

  const holidayByDate = useMemo(() => {
    const map = new Map();
    (holidays || []).forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  const { start, end, weeks } = useMemo(() => buildWeeks(refYear, refMonth), [refYear, refMonth]);
  const rangeStartKey = dateKey(start);

  function handleBarDragStart(event, activity) {
    let mode;
    if (pendingResizeRef.current) mode = pendingResizeRef.current;
    else if (event.ctrlKey || event.metaKey) mode = 'move';
    else mode = 'copy';
    pendingResizeRef.current = null;
    dragRef.current = { activityId: activity.id, mode };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = mode === 'copy' ? 'copy' : 'move';
      try { event.dataTransfer.setData('text/plain', String(activity.id)); } catch { /* jsdom */ }
    }
  }

  function handleCellDrop(event, targetKey) {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.currentTarget.classList.remove('ring-2', 'ring-inset', 'ring-brand-500', 'bg-brand-100');
    dragRef.current = null;
    onActivitiesChange(applyDrop(activities, drag.activityId, drag.mode, targetKey));
  }

  function handleCellDragOver(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = dragRef.current.mode === 'copy' ? 'copy' : 'move';
    }
    event.currentTarget.classList.add('ring-2', 'ring-inset', 'ring-brand-500', 'bg-brand-100');
  }

  function handleCellDragLeave(event) {
    event.currentTarget.classList.remove('ring-2', 'ring-inset', 'ring-brand-500', 'bg-brand-100');
  }

  return (
    <div data-testid="calendar-grid">
      <div className="grid grid-cols-7 rounded-t-[10px] overflow-hidden border border-b-0 border-slate-300 bg-app-bg">
        {WEEKDAYS.map((w) => (
          <span key={w} className="px-2 py-1.5 text-center text-2xs font-bold uppercase tracking-wide text-slate-500">
            {w}
          </span>
        ))}
      </div>

      <div className="border border-slate-300 rounded-b-[10px] overflow-hidden divide-y divide-slate-200">
        {weeks.map(({ weekStart, weekEnd }) => {
          const positioned = packWeekActivities(activities, weekStart, weekEnd);
          const laneCount = positioned.reduce((max, p) => Math.max(max, p.lane + 1), 0);
          return (
            <div
              key={dateKey(weekStart)}
              className="relative grid grid-cols-7 divide-x divide-slate-200"
              style={{ minHeight: Math.max(104, 30 + laneCount * 24 + 20) }}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                const key = dateKey(d);
                const inRange = d >= start && d <= end;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const holiday = inRange ? holidayByDate.get(key) : null;
                const isMonthStart = d.getDate() === 1;
                const showMonth = isMonthStart || (inRange && key === rangeStartKey);

                const bg = !inRange ? 'bg-slate-100'
                  : holiday ? 'bg-danger-light'
                  : isWeekend ? 'bg-app-surfaceMuted'
                  : 'bg-app-surface hover:bg-brand-50';

                return (
                  <div
                    key={key}
                    data-date={key}
                    data-testid={inRange ? 'cal-day' : 'cal-day-out'}
                    className={[
                      'p-1.5 transition-colors duration-150',
                      bg,
                      inRange ? 'cursor-pointer' : '',
                      isMonthStart ? 'border-t-2 border-t-brand-400' : '',
                    ].join(' ')}
                    style={{ paddingBottom: laneCount > 0 ? laneCount * 24 + 8 : undefined }}
                    onClick={inRange ? (e) => {
                      if (e.target.closest('[data-activity-bar]')) return;
                      onDayClick(key);
                    } : undefined}
                    onDragOver={inRange ? handleCellDragOver : undefined}
                    onDragLeave={inRange ? handleCellDragLeave : undefined}
                    onDrop={inRange ? (e) => handleCellDrop(e, key) : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={[
                          'inline-flex items-center justify-center text-xs font-semibold',
                          key === todayKey
                            ? 'w-5 h-5 rounded-full bg-brand-600 text-white'
                            : inRange ? 'text-slate-600' : 'text-slate-400',
                        ].join(' ')}
                      >
                        {d.getDate()}
                      </span>
                      {showMonth ? (
                        <span className="text-2xs font-bold uppercase text-brand-600">{MONTH_ABBR[d.getMonth()]}</span>
                      ) : null}
                    </div>
                    {holiday ? (
                      <div className="mt-0.5 text-2xs leading-tight text-critical" title={holiday.name || 'Feriado'}>
                        ★ {holiday.name || 'Feriado'}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {positioned.length > 0 ? (
                <div
                  className="absolute inset-x-0 top-[26px] grid grid-cols-7 gap-y-[3px] px-px pointer-events-none"
                  style={{ gridAutoRows: '21px' }}
                >
                  {positioned.map((p) => p.segments.map((s, segIdx) => {
                    const cat = CATEGORIES[p.activity.category] || { color: '#64748b' };
                    const text = s.showText ? p.activity.description : (s.continuesLeft ? `↳ ${p.activity.description}` : '');
                    return (
                      <div
                        key={`${p.activity.id}-${segIdx}`}
                        data-activity-bar
                        data-aid={p.activity.id}
                        draggable
                        title={`${p.activity.description} · ${p.activity.startDate} – ${p.activity.endDate}`}
                        className={[
                          'relative pointer-events-auto flex items-center px-1.5 text-2xs font-semibold text-white truncate shadow-sm cursor-grab',
                          s.continuesLeft ? '' : 'rounded-l-md',
                          s.continuesRight ? '' : 'rounded-r-md',
                        ].join(' ')}
                        style={{
                          gridColumn: `${s.startCol} / ${s.endCol + 1}`,
                          gridRow: p.lane + 1,
                          background: cat.color,
                        }}
                        onDragStart={(e) => handleBarDragStart(e, p.activity)}
                        onDragEnd={() => { dragRef.current = null; }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick(p.activity.startDate, p.activity.id);
                        }}
                      >
                        {text}
                        {segIdx === 0 && !s.continuesLeft ? (
                          <span
                            data-resize="start"
                            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
                            onMouseDown={() => { pendingResizeRef.current = 'resize-start'; }}
                          />
                        ) : null}
                        {segIdx === p.segments.length - 1 && !s.continuesRight ? (
                          <span
                            data-resize="end"
                            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                            onMouseDown={() => { pendingResizeRef.current = 'resize-end'; }}
                          />
                        ) : null}
                      </div>
                    );
                  }))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

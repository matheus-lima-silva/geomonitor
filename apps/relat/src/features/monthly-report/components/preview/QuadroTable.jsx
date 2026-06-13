import { CATEGORIES } from '../../utils/constants';

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

// Fundos das celulas — mesmos hex do exportar-docx / renderer Python.
const FILL = {
  out: '#F1F3F6',
  holiday: '#FDF0F4',
  weekend: '#F8FAFC',
  normal: '#FFFFFF',
};

function cellFill(cell) {
  if (!cell.inRange) return FILL.out;
  if (cell.holidayName) return FILL.holiday;
  if (cell.isWeekend) return FILL.weekend;
  return FILL.normal;
}

function ActivityLine({ activity, variant }) {
  const cat = CATEGORIES[activity.category] || { color: '#64748b', light: '#ECEFF3' };
  const prefix = activity.isFirstDay ? '' : '↳ ';

  if (variant === 'preenchido') {
    if (activity.isFirstDay) {
      return (
        <p className="m-0 mt-0.5 px-0.5 rounded-sm font-semibold text-white" style={{ background: cat.color, fontSize: '6.5pt' }}>
          {activity.description}
        </p>
      );
    }
    return (
      <p className="m-0 mt-0.5 px-0.5 rounded-sm" style={{ background: cat.light, color: cat.color, fontSize: '6.5pt' }}>
        ↳ {activity.description}
      </p>
    );
  }

  if (variant === 'barra') {
    return (
      <p
        className="m-0 mt-0.5 px-0.5"
        style={{ background: cat.light, borderLeft: `2.5px solid ${cat.color}`, color: '#1E293B', fontSize: '6.5pt' }}
      >
        {prefix}{activity.description}
      </p>
    );
  }

  // marcador (estilo do relatorio real)
  return (
    <p className="m-0 mt-0.5" style={{ fontSize: '6.5pt', color: '#333333' }}>
      <span style={{ color: cat.color, fontWeight: 700 }}>{activity.isFirstDay ? '● ' : '↳ '}</span>
      {activity.description}
    </p>
  );
}

/**
 * Quadro semanal do documento (tabela DOM-SAB) nas 3 variantes do Word.
 * Espelha _build_calendar_table do renderer Python — mesmos fundos e
 * marcadores ● / ↳ / ★.
 */
export default function QuadroTable({ weeks, variant = 'marcador' }) {
  return (
    <table
      data-testid="quadro-table"
      className="w-full border-collapse table-fixed"
      style={{ border: '1px solid #C9CFD8' }}
    >
      <thead>
        <tr>
          {WEEKDAYS.map((w) => (
            <th
              key={w}
              className="text-center font-bold"
              style={{ border: '1px solid #C9CFD8', background: '#EEF3FB', color: '#64748B', fontSize: '7pt', padding: '3px 4px' }}
            >
              {w}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, wi) => (
          <tr key={wi}>
            {week.map((cell) => (
              <td
                key={cell.dateKey}
                className="align-top"
                style={{ border: '1px solid #C9CFD8', background: cellFill(cell), padding: '4px 5px', minHeight: 52 }}
              >
                <p className="m-0 font-bold" style={{ fontSize: '7.5pt', color: cell.inRange ? '#334155' : '#A8B0BC' }}>
                  {cell.dayNum}
                </p>
                {cell.holidayName ? (
                  <p className="m-0 mt-0.5" style={{ fontSize: '6pt', color: '#993556' }}>★ {cell.holidayName}</p>
                ) : null}
                {cell.activities.map((activity, ai) => (
                  <ActivityLine key={ai} activity={activity} variant={variant} />
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Legenda do quadro — categorias + feriado, igual ao documento. */
export function QuadroLegend() {
  return (
    <p className="m-0 mt-2 mb-4" style={{ fontSize: '7pt', color: '#334155' }}>
      <span className="font-bold" style={{ color: '#64748B' }}>LEGENDA{'   '}</span>
      {Object.values(CATEGORIES).map((cat) => (
        <span key={cat.label}>
          <span style={{ color: cat.color, fontWeight: 700 }}>● </span>
          {cat.label}{'   '}
        </span>
      ))}
      <span style={{ color: '#993556', fontWeight: 700 }}>★ </span>
      Feriado
    </p>
  );
}

import { useEffect, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { formatMonitoringMonthLabel } from '../utils/monitoringViewModel';

function buildScopeLabel(item) {
  if (item?.scopeType === 'lo') {
    return `LO ${item?.loNumero || item?.loId || '-'} (${item?.orgaoAmbiental || '-'})`;
  }
  return `${item?.projectNames?.[0] || '-'} (${item?.projectIds?.[0] || '-'})`;
}

function TopPlanningAlert({ alerts = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const list = Array.isArray(alerts) ? alerts : [];

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (list.length === 0) return null;

  return (
    <div className="monitor-topbar-alert relative" ref={containerRef}>
      <button
        type="button"
        className="monitor-topbar-alert-trigger relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="dialog"
        aria-label="Alertas de planejamento"
        title="Alertas de planejamento"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <AppIcon name="bell" size={16} />
        <span className="sr-only">Alertas de planejamento</span>
        <span
          className="monitor-topbar-alert-badge absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
          aria-label={`Total de alertas: ${list.length}`}
        >
          {list.length}
        </span>
      </button>

      {isOpen ? (
        <div
          className="monitor-topbar-alert-panel absolute right-0 z-50 mt-2 w-[min(90vw,360px)] max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-panel"
          role="dialog"
          aria-label="Alertas de planejamento"
        >
          <h3 className="m-0 mb-2 text-sm font-bold text-slate-800">Planejamento de visita (janela de 45 dias)</h3>
          <div className="monitor-topbar-alert-list flex flex-col gap-2">
            {list.map((item, index) => (
              <article
                key={`${item.scopeId || 'scope'}-${item.monthKey || 'month'}-${index}`}
                className="monitor-topbar-alert-item rounded-lg border border-slate-200 bg-slate-50 p-2.5"
              >
                <strong className="block text-xs text-slate-800">{buildScopeLabel(item)}</strong>
                <span className="mt-0.5 block text-xs text-slate-600">
                  Entrega {formatMonitoringMonthLabel(item?.month)}/{item?.year || '-'}
                </span>
                <small className="mt-0.5 block text-xs font-semibold text-brand-700">
                  Faltam {item?.days ?? '-'} dia(s)
                </small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TopPlanningAlert;

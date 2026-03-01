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
    <div className="monitor-topbar-alert" ref={containerRef}>
      <button
        type="button"
        className="secondary monitor-topbar-alert-trigger"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="dialog"
        aria-label="Alertas de planejamento"
        title="Alertas de planejamento"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <AppIcon name="bell" />
        <span className="monitor-topbar-alert-label">Alertas de planejamento</span>
        <span className="monitor-topbar-alert-badge" aria-label={`Total de alertas: ${list.length}`}>
          {list.length}
        </span>
      </button>

      {isOpen ? (
        <div className="monitor-topbar-alert-panel" role="dialog" aria-label="Alertas de planejamento">
          <h3>Planejamento de visita (janela de 45 dias)</h3>
          <div className="monitor-topbar-alert-list">
            {list.map((item, index) => (
              <article key={`${item.scopeId || 'scope'}-${item.monthKey || 'month'}-${index}`} className="monitor-topbar-alert-item">
                <strong>{buildScopeLabel(item)}</strong>
                <span>
                  Entrega {formatMonitoringMonthLabel(item?.month)}/{item?.year || '-'}
                </span>
                <small>Faltam {item?.days ?? '-'} dia(s)</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TopPlanningAlert;

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Card } from '../../../components/ui';
import { useOptionalToast } from '../../../context/ToastContext';
import { acknowledgeAlert, listAlerts } from '../services/adminAlertsService';

const ALERT_TYPE_LABEL = {
  query_count_exceeded: 'Queries excessivas',
};

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function severityTone(count, threshold) {
  if (!Number.isFinite(count) || !Number.isFinite(threshold) || threshold <= 0) {
    return 'warning';
  }
  const ratio = count / threshold;
  if (ratio > 2) return 'danger';
  if (ratio > 1.5) return 'warning';
  return 'neutral';
}

function AlertRow({ alert, onAck, ackingId }) {
  const payload = alert?.payload || {};
  const count = Number(payload.count) || 0;
  const threshold = Number(payload.threshold) || 0;
  const isPending = !alert.acknowledgedAt;
  const isAcking = ackingId === alert.id;

  return (
    <tr className="hover:bg-slate-50 transition-colors align-top">
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        {formatDate(alert.createdAt)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
        {ALERT_TYPE_LABEL[alert.type] || alert.type}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
        {payload.method || '-'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-700">
        <span className="font-mono break-all">{payload.url || '-'}</span>
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        <Badge tone={severityTone(count, threshold)}>
          {count} / {threshold}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        {Number.isFinite(Number(payload.durationMs)) ? `${payload.durationMs} ms` : '-'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
        {payload.userId || '-'}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {isPending ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAck(alert)}
            disabled={isAcking}
          >
            <AppIcon name="check" className="w-4 h-4" aria-hidden="true" />
            {isAcking ? 'Marcando...' : 'Marcar revisado'}
          </Button>
        ) : (
          <div className="flex flex-col gap-0.5 text-slate-500">
            <Badge tone="ok">Revisado</Badge>
            <span className="text-[11px]">{alert.acknowledgedBy || '-'}</span>
          </div>
        )}
      </td>
    </tr>
  );
}

function SystemAlertsPanel() {
  const toast = useOptionalToast();
  const [alerts, setAlerts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [ackingId, setAckingId] = useState(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAlerts({ status: statusFilter, page: 1, limit: 20 });
      setAlerts(result.items);
      setPagination(result.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      toast?.show?.(err.message || 'Erro ao carregar alertas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadAlerts();
    })();
    return () => { cancelled = true; };
  }, [loadAlerts]);

  const handleAck = useCallback(async (alert) => {
    setAckingId(alert.id);
    try {
      await acknowledgeAlert(alert);
      toast?.show?.('Alerta marcado como revisado.', 'success');
      await loadAlerts();
    } catch (err) {
      toast?.show?.(err.message || 'Erro ao marcar alerta.', 'error');
    } finally {
      setAckingId(null);
    }
  }, [loadAlerts, toast]);

  const emptyMessage = useMemo(() => {
    return statusFilter === 'pending'
      ? 'Nenhum alerta pendente. Tudo tranquilo por aqui.'
      : 'Nenhum alerta registrado.';
  }, [statusFilter]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Alertas do sistema</h3>
          <p className="text-xs text-slate-500">
            Requests flagradas para revisao (queries por request acima do limite configurado).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === 'pending' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('pending')}
          >
            Pendentes
            {pagination.total > 0 && statusFilter === 'pending' ? ` (${pagination.total})` : ''}
          </Button>
          <Button
            variant={statusFilter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
          <Button variant="ghost" size="sm" onClick={loadAlerts} disabled={loading}>
            <AppIcon name="refresh" className="w-4 h-4" aria-hidden="true" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card variant="flat" className="!p-0 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quando</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metodo</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rota</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Queries</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duracao</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  Carregando alertas...
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAck={handleAck}
                  ackingId={ackingId}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

export default SystemAlertsPanel;

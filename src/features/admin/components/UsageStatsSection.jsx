import { useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Card } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import {
  getAdminTotals,
  getAdminActivity,
  getAdminTopUsers,
  getAdminHealth,
} from '../../../services/adminMetricsService';

function KpiCard({ label, value, icon }) {
  return (
    <Card variant="flat" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-500">
        <AppIcon name={icon} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <strong className="text-3xl font-bold text-slate-800">{value ?? '-'}</strong>
    </Card>
  );
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function UsageStatsSection() {
  const { show } = useToast();
  const [totals, setTotals] = useState(null);
  const [activity, setActivity] = useState(null);
  const [topUsers, setTopUsers] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [t, a, tu, h] = await Promise.all([
          getAdminTotals(),
          getAdminActivity(),
          getAdminTopUsers(10),
          getAdminHealth(),
        ]);
        if (cancelled) return;
        setTotals(t);
        setActivity(a);
        setTopUsers(tu);
        setHealth(h);
      } catch (err) {
        if (!cancelled) show(err.message || 'Erro ao carregar metricas.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [show]);

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando metricas...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Totais basicos */}
      <section>
        <h3 className="text-base font-bold text-slate-800 mb-3">Totais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Usuarios ativos" value={totals?.activeUsers} icon="users" />
          <KpiCard label="Workspaces" value={totals?.workspaces} icon="projects-nav" />
          <KpiCard label="Relatorios gerados" value={totals?.compoundsGenerated} icon="file-text" />
          <KpiCard label="Erosoes cadastradas" value={totals?.erosions} icon="alert" />
        </div>
      </section>

      {/* Atividade recente */}
      <section>
        <h3 className="text-base font-bold text-slate-800 mb-3">Atividade recente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card variant="flat" className="!p-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ultimos jobs de relatorio</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {(activity?.recentReports || []).length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500">Nenhum job recente.</li>
              ) : null}
              {(activity?.recentReports || []).map((job) => (
                <li key={job.id} className="px-4 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">{job.kind || 'job'}</span>
                    <span className="text-xs text-slate-500">{job.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(job.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card variant="flat" className="!p-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ultimos workspaces criados</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {(activity?.recentWorkspaces || []).length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500">Nenhum workspace recente.</li>
              ) : null}
              {(activity?.recentWorkspaces || []).map((ws) => (
                <li key={ws.id} className="px-4 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">{ws.nome || ws.id}</span>
                    <span className="text-xs text-slate-500">{ws.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(ws.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Top usuarios */}
      <section>
        <h3 className="text-base font-bold text-slate-800 mb-3">Top usuarios por relatorios gerados</h3>
        <Card variant="flat" className="!p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Relatorios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(topUsers?.topUsers || []).length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-6 text-center text-sm text-slate-500">Nenhum dado disponivel.</td>
                </tr>
              ) : null}
              {(topUsers?.topUsers || []).map((u, idx) => (
                <tr key={`${u.userId || u.email || idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{u.nome || u.userId || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-bold">{u.reportCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Saude do sistema */}
      <section>
        <h3 className="text-base font-bold text-slate-800 mb-3">Saude do sistema</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="Jobs na fila" value={health?.queued} icon="clipboard" />
          <KpiCard label="Em processamento" value={health?.processing} icon="loader" />
          <KpiCard label="Falhas (24h)" value={health?.failedLast24h} icon="alert" />
        </div>
      </section>
    </div>
  );
}

export default UsageStatsSection;

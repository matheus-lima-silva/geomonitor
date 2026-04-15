import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, Input } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import { subscribeReportWorkspaces } from '../../../services/reportWorkspaceService';
import { subscribeProjects } from '../../../services/projectService';
import WorkspaceMembersModal from '../../reports/components/WorkspaceMembersModal';

function WorkspacesAccessSection() {
  const { show } = useToast();
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  useEffect(
    () => subscribeReportWorkspaces(
      (rows) => setWorkspaces(rows || []),
      () => show('Erro ao carregar workspaces.', 'error'),
    ),
    [show],
  );

  useEffect(
    () => subscribeProjects(
      (rows) => setProjects(rows || []),
      () => show('Erro ao carregar empreendimentos.', 'error'),
    ),
    [show],
  );

  const projectsById = useMemo(() => {
    const map = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const filteredWorkspaces = useMemo(() => {
    const term = String(filter || '').toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter((w) => (
      String(w.nome || '').toLowerCase().includes(term)
      || String(projectsById[w.projectId]?.nome || '').toLowerCase().includes(term)
    ));
  }, [workspaces, filter, projectsById]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Consolida todos os workspaces do sistema. Clique em um workspace para gerenciar seus membros.
      </p>
      <div className="max-w-md">
        <Input
          id="admin-workspaces-filter"
          label="Filtrar"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Nome do workspace ou do empreendimento"
        />
      </div>
      <Card variant="flat" className="overflow-x-auto w-full !p-0">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Workspace</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empreendimento</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Criado em</th>
              <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredWorkspaces.map((w) => {
              const project = projectsById[w.projectId];
              return (
                <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <strong>{w.nome || '-'}</strong>
                    <div className="text-xs text-slate-500">ID: {w.id}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{project?.nome || w.projectId || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {w.createdAt ? new Date(w.createdAt).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <Button variant="outline" size="sm" onClick={() => setSelectedWorkspace(w)}>
                      <AppIcon name="users" />
                      Membros
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filteredWorkspaces.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-6 text-center text-sm text-slate-500">Nenhum workspace encontrado.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <WorkspaceMembersModal
        open={Boolean(selectedWorkspace)}
        onClose={() => setSelectedWorkspace(null)}
        workspaceId={selectedWorkspace?.id}
        workspaceName={selectedWorkspace?.nome}
        canManage={true}
      />
    </div>
  );
}

export default WorkspacesAccessSection;

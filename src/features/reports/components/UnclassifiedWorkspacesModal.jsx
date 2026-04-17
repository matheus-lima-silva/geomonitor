import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';

function formatInspectionLabel(inspection) {
  const id = inspection.id || '';
  const dataInicio = inspection.dataInicio ? new Date(inspection.dataInicio).toLocaleDateString('pt-BR') : '';
  const responsavel = inspection.responsavel || '';
  return [id, dataInicio, responsavel].filter(Boolean).join(' — ');
}

export default function UnclassifiedWorkspacesModal({
  open,
  unclassifiedWorkspaces,
  inspections = [],
  projectNamesById,
  busy,
  onAssign,
  onCreateInspection,
}) {
  const [assignments, setAssignments] = useState({});
  const [newFormWorkspaceId, setNewFormWorkspaceId] = useState(null);
  const [newInspectionDraft, setNewInspectionDraft] = useState({ dataInicio: '', responsavel: '' });
  const [savingBatch, setSavingBatch] = useState(false);
  const [creatingInspection, setCreatingInspection] = useState(false);

  useEffect(() => {
    if (!open) {
      setAssignments({});
      setNewFormWorkspaceId(null);
      setNewInspectionDraft({ dataInicio: '', responsavel: '' });
    }
  }, [open]);

  // Indexa vistorias por projeto para lookup rapido por linha. Ordena desc
  // por dataInicio para que a mais recente apareca primeiro no dropdown.
  const inspectionsByProject = useMemo(() => {
    const map = new Map();
    for (const inspection of inspections || []) {
      if (!inspection?.id) continue;
      const projectKey = String(inspection.projetoId || '');
      if (!projectKey) continue;
      if (!map.has(projectKey)) map.set(projectKey, []);
      map.get(projectKey).push(inspection);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(b.dataInicio || '').localeCompare(String(a.dataInicio || '')));
    }
    return map;
  }, [inspections]);

  // Agrupa workspaces por projeto para renderizar secoes separadas.
  const groupedByProject = useMemo(() => {
    const groups = new Map();
    for (const workspace of unclassifiedWorkspaces || []) {
      const projectKey = String(workspace.projectId || '');
      if (!groups.has(projectKey)) groups.set(projectKey, []);
      groups.get(projectKey).push(workspace);
    }
    return [...groups.entries()]
      .map(([projectId, items]) => ({
        projectId,
        projectName: (projectNamesById?.get?.(projectId)) || projectId || 'Sem empreendimento',
        items,
      }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [unclassifiedWorkspaces, projectNamesById]);

  const allAssigned = useMemo(() => {
    if (!unclassifiedWorkspaces?.length) return true;
    return unclassifiedWorkspaces.every((workspace) => Boolean(assignments[workspace.id]));
  }, [unclassifiedWorkspaces, assignments]);

  function setAssignment(workspaceId, inspectionId) {
    setAssignments((prev) => ({ ...prev, [workspaceId]: inspectionId }));
  }

  async function handleCreateInspection(workspace) {
    if (!newInspectionDraft.dataInicio || !workspace?.projectId) return;
    setCreatingInspection(true);
    try {
      const created = await onCreateInspection({
        projetoId: workspace.projectId,
        dataInicio: newInspectionDraft.dataInicio,
        responsavel: newInspectionDraft.responsavel,
      });
      if (created?.id) {
        setAssignment(workspace.id, created.id);
        setNewFormWorkspaceId(null);
        setNewInspectionDraft({ dataInicio: '', responsavel: '' });
      }
    } finally {
      setCreatingInspection(false);
    }
  }

  async function handleSubmit() {
    const pairs = Object.entries(assignments).filter(([, inspectionId]) => Boolean(inspectionId));
    if (pairs.length === 0) return;
    setSavingBatch(true);
    try {
      await onAssign(pairs.map(([workspaceId, inspectionId]) => ({ workspaceId, inspectionId })));
    } finally {
      setSavingBatch(false);
    }
  }

  const assignedCount = Object.keys(assignments).filter((key) => assignments[key]).length;
  const totalUnclassified = unclassifiedWorkspaces?.length || 0;

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="Classifique os workspaces existentes"
      size="xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {assignedCount} de {totalUnclassified} workspace(s) vinculado(s) a uma vistoria.
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!allAssigned || savingBatch || busy === 'classify-batch'}
          >
            <AppIcon name="save" size={14} />
            {savingBatch ? 'Salvando...' : 'Salvar classificação'}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1" data-testid="unclassified-body">
        <p className="m-0 text-sm text-slate-600">
          Os workspaces abaixo ainda nao estao vinculados a uma vistoria.
          Escolha uma vistoria existente (ou crie uma nova) para cada um antes de continuar.
        </p>

        {totalUnclassified === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Todos os workspaces ja estao classificados.
          </div>
        ) : (
          groupedByProject.map(({ projectId, projectName, items }) => {
            const projectInspectionOptions = inspectionsByProject.get(projectId) || [];
            return (
              <section
                key={projectId || '__none__'}
                data-testid={`unclassified-project-${projectId || '__none__'}`}
                className="flex flex-col gap-2"
              >
                <header className="flex items-center gap-2 border-b border-slate-200 pb-1">
                  <AppIcon name="file-text" size={14} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">{projectName}</span>
                  <span className="text-xs text-slate-500">
                    · {items.length} pendente{items.length === 1 ? '' : 's'}
                  </span>
                </header>
                <ul className="m-0 flex flex-col gap-2 p-0 list-none">
                  {items.map((workspace) => {
                    const assignment = assignments[workspace.id] || '';
                    const isCreating = newFormWorkspaceId === workspace.id;
                    return (
                      <li
                        key={workspace.id}
                        data-testid={`unclassified-row-${workspace.id}`}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="m-0 text-sm font-semibold text-slate-800 truncate">
                              {workspace.nome || workspace.id}
                            </p>
                            <p className="m-0 text-xs text-slate-500">{workspace.id}</p>
                          </div>
                          <div className="w-full sm:w-72">
                            <Select
                              id={`unclassified-select-${workspace.id}`}
                              value={assignment}
                              onChange={(event) => setAssignment(workspace.id, event.target.value)}
                              disabled={isCreating}
                            >
                              <option value="">
                                {projectInspectionOptions.length === 0
                                  ? 'Nenhuma vistoria cadastrada — crie uma nova'
                                  : 'Selecione uma vistoria...'}
                              </option>
                              {projectInspectionOptions.map((inspection) => (
                                <option key={inspection.id} value={inspection.id}>
                                  {formatInspectionLabel(inspection)}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewFormWorkspaceId(isCreating ? null : workspace.id);
                              setNewInspectionDraft({ dataInicio: '', responsavel: '' });
                            }}
                          >
                            <AppIcon name="plus" size={14} />
                            Nova vistoria
                          </Button>
                        </div>

                        {isCreating && (
                          <div
                            className="mt-3 rounded border border-brand-200 bg-brand-50 p-3"
                            data-testid={`unclassified-new-form-${workspace.id}`}
                          >
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Input
                                id={`new-inspection-data-${workspace.id}`}
                                type="date"
                                label="Data da vistoria"
                                value={newInspectionDraft.dataInicio}
                                onChange={(event) => setNewInspectionDraft((prev) => ({ ...prev, dataInicio: event.target.value }))}
                              />
                              <Input
                                id={`new-inspection-resp-${workspace.id}`}
                                label="Responsavel (opcional)"
                                value={newInspectionDraft.responsavel}
                                onChange={(event) => setNewInspectionDraft((prev) => ({ ...prev, responsavel: event.target.value }))}
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNewFormWorkspaceId(null);
                                  setNewInspectionDraft({ dataInicio: '', responsavel: '' });
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleCreateInspection(workspace)}
                                disabled={!newInspectionDraft.dataInicio || creatingInspection}
                              >
                                {creatingInspection ? 'Criando...' : 'Criar e vincular'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </Modal>
  );
}

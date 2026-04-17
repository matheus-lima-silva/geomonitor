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
  projectInspections,
  projectId,
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

  const inspectionOptions = useMemo(() => {
    return (projectInspections || [])
      .filter((inspection) => inspection && inspection.id)
      .slice()
      .sort((a, b) => String(b.dataInicio || '').localeCompare(String(a.dataInicio || '')));
  }, [projectInspections]);

  const allAssigned = useMemo(() => {
    if (!unclassifiedWorkspaces?.length) return true;
    return unclassifiedWorkspaces.every((workspace) => Boolean(assignments[workspace.id]));
  }, [unclassifiedWorkspaces, assignments]);

  function setAssignment(workspaceId, inspectionId) {
    setAssignments((prev) => ({ ...prev, [workspaceId]: inspectionId }));
  }

  async function handleCreateInspection(workspaceId) {
    if (!newInspectionDraft.dataInicio) return;
    setCreatingInspection(true);
    try {
      const created = await onCreateInspection({
        projetoId: projectId,
        dataInicio: newInspectionDraft.dataInicio,
        responsavel: newInspectionDraft.responsavel,
      });
      if (created?.id) {
        setAssignment(workspaceId, created.id);
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

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="Classifique os workspaces existentes"
      size="xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {Object.keys(assignments).filter((key) => assignments[key]).length} de {unclassifiedWorkspaces?.length || 0} workspace(s) vinculado(s) a uma vistoria.
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
      <div className="flex flex-col gap-3" data-testid="unclassified-body">
        <p className="m-0 text-sm text-slate-600">
          Workspaces existentes neste empreendimento ainda não estão vinculados a uma vistoria.
          Escolha uma vistoria existente ou crie uma nova antes de continuar.
        </p>

        {(!unclassifiedWorkspaces || unclassifiedWorkspaces.length === 0) ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Todos os workspaces deste empreendimento já estão classificados.
          </div>
        ) : (
          <ul className="m-0 flex flex-col gap-2 p-0 list-none">
            {unclassifiedWorkspaces.map((workspace) => {
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
                        <option value="">Selecione uma vistoria...</option>
                        {inspectionOptions.map((inspection) => (
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
                          label="Responsável (opcional)"
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
                          onClick={() => handleCreateInspection(workspace.id)}
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
        )}
      </div>
    </Modal>
  );
}

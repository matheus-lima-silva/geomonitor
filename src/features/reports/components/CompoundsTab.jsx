import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import CompoundCard from './CompoundCard';
import CompoundWizard from './CompoundWizard';
import DeliveryUploadModal from './DeliveryUploadModal';
import { fmt } from '../utils/reportUtils';

// Orquestrador do modulo "Relatorio Final" (antes "Relatorios Compostos").
// Responsabilidades:
//   - mostrar/ocultar o CompoundWizard (create ou edit)
//   - listar compounds ativos via CompoundCard
//   - manter a lixeira expandivel como antes
//   - encaminhar callbacks (create/update/generate/trash/delete/etc.) ao ReportsView
//
// O wizard e a fonte da criacao e edicao de textos; o card mostra cada
// compound salvo e concentra acoes pos-criacao (gerar, baixar, entregar).
export default function CompoundsTab({
  compoundDraft,
  setCompoundDraft,
  profissoes,
  signatariosCandidatos,
  compounds,
  workspaces,
  workspaceLabelsById,
  compoundWorkspaceSelections,
  setCompoundWorkspaceSelections,
  compoundPreflights,
  busy,
  handleCreateCompound,
  handleUpdateCompoundDraft,
  handleCompoundAddWorkspace,
  handleCompoundRemoveWorkspace,
  handleCompoundReorder,
  handleCompoundGenerate,
  handleTrashCompound,
  handleRestoreCompound,
  handleHardDeleteCompound,
  handleDownloadReportOutput,
  buildCompoundDownloadFileName,
  userEmail = '',
  showToast = () => {},
}) {
  // Estado do wizard: fechado por padrao. Uma unica instancia, alterna entre
  // modo create e edit.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState('create');
  const [wizardCompound, setWizardCompound] = useState(null);

  const [confirmHardDelete, setConfirmHardDelete] = useState(null);
  const [deliveryCompound, setDeliveryCompound] = useState(null);
  const [archiveRefreshToken, setArchiveRefreshToken] = useState(0);
  const [showTrash, setShowTrash] = useState(false);

  const activeCompounds = compounds.filter((c) => !c.deletedAt);
  const trashedCompounds = compounds.filter((c) => c.deletedAt);

  function openCreate() {
    setWizardCompound(null);
    setWizardMode('create');
    setWizardOpen(true);
  }

  function openEdit(compound) {
    setWizardCompound(compound);
    setWizardMode('edit');
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setWizardCompound(null);
    setWizardMode('create');
  }

  async function handleWizardCreate(draft) {
    // Passa draft completo para ReportsView, que ja sabe montar o payload.
    // Retorna o compound criado (com .id) para que o wizard possa anexar os
    // workspaces que o usuario selecionou no Step 3 durante a criacao.
    setCompoundDraft(draft);
    return handleCreateCompound(draft);
  }

  async function handleWizardUpdate(compound, draft) {
    await handleUpdateCompoundDraft?.(compound, draft);
    // Atualiza o compound na referencia local para workspaces step refletir mudanca.
    const fresh = compounds.find((c) => c.id === compound.id);
    if (fresh) setWizardCompound(fresh);
  }

  return (
    <>
      {!wizardOpen ? (
        <div className="flex justify-end">
          <Button onClick={openCreate} data-testid="compounds-create-new">
            <AppIcon name="plus" /> Criar novo relatório
          </Button>
        </div>
      ) : (
        <CompoundWizard
          mode={wizardMode}
          initialCompound={wizardCompound}
          compounds={compounds}
          signatariosCandidatos={signatariosCandidatos}
          profissoes={profissoes}
          workspaces={workspaces}
          workspaceLabelsById={workspaceLabelsById}
          compoundWorkspaceSelections={compoundWorkspaceSelections}
          setCompoundWorkspaceSelections={setCompoundWorkspaceSelections}
          onAddWorkspace={handleCompoundAddWorkspace}
          onRemoveWorkspace={handleCompoundRemoveWorkspace}
          onReorder={handleCompoundReorder}
          onCreate={handleWizardCreate}
          onUpdate={handleWizardUpdate}
          onClose={closeWizard}
          userEmail={userEmail}
          busy={busy}
          showToast={showToast}
        />
      )}

      <Card variant="nested" className="flex flex-col gap-3">
        <div className="text-sm font-bold text-slate-800">Relatórios</div>
        {activeCompounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum relatório criado ainda. Clique em <strong>Criar novo relatório</strong> acima.
          </div>
        ) : null}

        {activeCompounds.map((compound) => (
          <CompoundCard
            key={compound.id}
            compound={compound}
            workspaceLabelsById={workspaceLabelsById}
            compoundPreflights={compoundPreflights}
            busy={busy}
            onTrash={handleTrashCompound}
            onGenerate={handleCompoundGenerate}
            onOpenEdit={openEdit}
            onDownloadDocx={(mediaId, fileName) => handleDownloadReportOutput(mediaId, fileName)}
            onUploadDelivery={(target) => setDeliveryCompound(target)}
            compoundDownloadFileName={buildCompoundDownloadFileName(compound)}
            archiveRefreshToken={archiveRefreshToken}
            showToast={showToast}
          />
        ))}
      </Card>

      {/* Lixeira */}
      {trashedCompounds.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
            onClick={() => setShowTrash((v) => !v)}
          >
            <AppIcon name="trash-2" size={12} />
            Lixeira ({trashedCompounds.length})
            <AppIcon name="chevron-right" size={12} className={`transition-transform ${showTrash ? 'rotate-90' : ''}`} />
          </button>
          {showTrash ? (
            <div className="mt-2 flex flex-col gap-2">
              {trashedCompounds.map((compound) => (
                <div
                  key={compound.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      {compound.nome || compound.id}
                    </span>
                    <p className="mt-0.5 mb-0 text-xs text-red-400">
                      Na lixeira • {fmt(compound.deletedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreCompound(compound)}
                      disabled={busy === `compound-restore:${compound.id}`}
                    >
                      <AppIcon name="undo" size={14} /> Restaurar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmHardDelete(compound)}
                      disabled={busy === `compound-delete:${compound.id}`}
                    >
                      <AppIcon name="trash-2" size={14} /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={Boolean(confirmHardDelete)}
        onClose={() => setConfirmHardDelete(null)}
        title="Excluir definitivamente"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setConfirmHardDelete(null)}>
              <AppIcon name="close" /> Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                handleHardDeleteCompound(confirmHardDelete);
                setConfirmHardDelete(null);
              }}
              disabled={busy === `compound-delete:${confirmHardDelete?.id}`}
            >
              <AppIcon name="trash-2" /> Excluir definitivamente
            </Button>
          </>
        )}
      >
        <p className="m-0 text-sm text-slate-700">
          Deseja excluir permanentemente o relatório{' '}
          <strong>{confirmHardDelete?.nome || confirmHardDelete?.id}</strong>? Essa ação não pode
          ser desfeita.
        </p>
      </Modal>

      <DeliveryUploadModal
        open={Boolean(deliveryCompound)}
        onClose={() => setDeliveryCompound(null)}
        compoundId={deliveryCompound?.id || ''}
        compoundName={deliveryCompound?.nome || ''}
        userEmail={userEmail}
        onDelivered={() => setArchiveRefreshToken((t) => t + 1)}
        showToast={showToast}
      />
    </>
  );
}

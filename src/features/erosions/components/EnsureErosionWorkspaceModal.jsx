import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import { useOptionalToast } from '../../../context/ToastContext';
import { createReportWorkspace } from '../../../services/reportWorkspaceService';

// Cria um workspace dedicado a armazenar fotos do projeto, usado como fonte
// pelo picker de fotos principais da erosao. O usuario escolhe o nome; o
// workspace fica vinculado ao projeto e marcado com purpose='erosion_photos'
// no draftState para identificacao futura (nao afeta outros fluxos).
export default function EnsureErosionWorkspaceModal({
  open,
  projectId,
  projectName,
  defaultName,
  userEmail,
  onClose,
  onCreated,
}) {
  const { show: showToast } = useOptionalToast();
  const [name, setName] = useState(defaultName || '');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && Boolean(projectId) && !busy;

  async function handleConfirm() {
    if (!canSubmit) return;
    try {
      setBusy(true);
      const result = await createReportWorkspace({
        id: `RW-${Date.now()}`,
        projectId,
        nome: name.trim(),
        descricao: `Banco de fotos de erosoes - ${projectName || projectId}`,
        status: 'draft',
        slots: [],
        draftState: { purpose: 'erosion_photos' },
      }, { updatedBy: userEmail || 'web' });
      const createdId = String(result?.data?.id || result?.id || '').trim();
      showToast('Banco de fotos criado.', 'success');
      if (typeof onCreated === 'function') {
        onCreated({ id: createdId, nome: name.trim(), projectId });
      }
      onClose?.();
    } catch (error) {
      showToast(error?.message || 'Erro ao criar workspace.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <>
      <Button variant="primary" onClick={handleConfirm} disabled={!canSubmit}>
        <AppIcon name="plus" className="w-4 h-4" />
        {busy ? 'Criando...' : 'Criar banco de fotos'}
      </Button>
      <Button variant="outline" onClick={onClose} disabled={busy}>
        <AppIcon name="close" className="w-4 h-4" />
        Cancelar
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Criar banco de fotos do empreendimento"
      size="md"
      footer={footer}
    >
      <div className="flex flex-col gap-3 text-sm text-slate-700">
        <p className="m-0">
          Este empreendimento ainda nao tem nenhum workspace com fotos. Crie um
          banco dedicado e faca upload das imagens; depois selecione ate 6 delas
          como fotos principais da erosao.
        </p>
        <Input
          id="ensure-workspace-name"
          label="Nome do banco"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={`Fotos de erosoes - ${projectName || projectId || ''}`.trim()}
          disabled={busy}
          autoFocus
        />
      </div>
    </Modal>
  );
}

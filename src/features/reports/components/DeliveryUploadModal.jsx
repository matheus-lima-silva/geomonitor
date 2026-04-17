import { useEffect, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Modal, Textarea } from '../../../components/ui';
import { createMediaUpload, uploadMediaBinary } from '../../../services/mediaService';
import {
  attachDeliveredMedia,
  computeFileSha256,
  createCompoundDelivery,
} from '../../../services/reportArchiveService';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPTED_EXTS = ['.pdf', '.docx'];

function isAcceptedFile(file) {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const name = String(file.name || '').toLowerCase();
  return ACCEPTED_EXTS.some((ext) => name.endsWith(ext));
}

export default function DeliveryUploadModal({
  open,
  onClose,
  compoundId,
  compoundName,
  userEmail,
  onDelivered = () => {},
  showToast = () => {},
}) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState('idle'); // idle | creating | uploading | attaching | done
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setNotes('');
      setStep('idle');
      setErrorMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  function handleFileChange(event) {
    const picked = event.target.files?.[0] || null;
    if (picked && !isAcceptedFile(picked)) {
      setErrorMessage('Tipo de arquivo nao suportado. Envie PDF ou DOCX.');
      setFile(null);
      return;
    }
    setErrorMessage('');
    setFile(picked);
  }

  async function handleSubmit() {
    if (!compoundId || !file) return;
    setErrorMessage('');
    try {
      setStep('creating');
      const archive = await createCompoundDelivery(
        compoundId,
        { notes },
        { updatedBy: userEmail || 'web' },
      );
      if (!archive?.id) throw new Error('Falha ao criar entrega (sem id).');

      setStep('uploading');
      const uploadResponse = await createMediaUpload(
        {
          fileName: file.name,
          contentType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          sizeBytes: file.size,
          purpose: 'report_archive_delivered',
          linkedResourceType: 'report_archive',
          linkedResourceId: archive.id,
        },
        { updatedBy: userEmail || 'web' },
      );
      const mediaData = uploadResponse?.data || {};
      const mediaId = mediaData.id;
      const uploadDescriptor = mediaData.upload;
      if (!mediaId || !uploadDescriptor) throw new Error('Resposta de upload invalida.');

      await uploadMediaBinary(uploadDescriptor, file);

      setStep('attaching');
      const sha256 = await computeFileSha256(file);
      const updated = await attachDeliveredMedia(
        archive.id,
        { mediaId, sha256, notes },
        { updatedBy: userEmail || 'web' },
      );

      setStep('done');
      showToast(`Entrega v${updated?.version || archive.version} registrada.`, 'success');
      onDelivered(updated || archive);
      onClose?.();
    } catch (error) {
      setErrorMessage(error?.message || 'Erro ao registrar entrega.');
      setStep('idle');
    }
  }

  const isBusy = step !== 'idle' && step !== 'done';
  const canSubmit = Boolean(file) && !isBusy;

  return (
    <Modal
      open={open}
      onClose={isBusy ? () => {} : onClose}
      title={`Marcar como entregue${compoundName ? ` — ${compoundName}` : ''}`}
      size="lg"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="delivery-submit"
          >
            <AppIcon name="save" size={14} />
            {step === 'creating' ? 'Criando snapshot...' : null}
            {step === 'uploading' ? 'Enviando arquivo...' : null}
            {step === 'attaching' ? 'Validando sha256...' : null}
            {step === 'idle' || step === 'done' ? 'Registrar entrega' : null}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3" data-testid="delivery-upload-body">
        <p className="m-0 text-sm text-slate-600">
          Anexe o PDF (ou DOCX) final entregue externamente. A versao atual do DOCX gerado
          pelo sistema sera preservada como snapshot imutavel (v<strong>N+1</strong>) junto
          com o arquivo entregue. Regenerar o composto depois nao afeta esta entrega.
        </p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label htmlFor="delivery-file" className="block text-xs font-medium text-slate-700 mb-1">
            Arquivo final
          </label>
          <input
            ref={fileInputRef}
            id="delivery-file"
            type="file"
            accept=".pdf,.docx,application/pdf"
            onChange={handleFileChange}
            disabled={isBusy}
            data-testid="delivery-file-input"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 file:cursor-pointer"
          />
          {file ? (
            <p className="m-0 mt-1.5 text-xs text-slate-600">
              <AppIcon name="file-text" size={12} /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          ) : null}
        </div>

        <Textarea
          id="delivery-notes"
          label="Observacoes (opcional)"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex: assinaturas de Fulano e Cicrano, revisao final do PDF..."
          disabled={isBusy}
        />

        {errorMessage ? (
          <div
            className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700"
            data-testid="delivery-error"
          >
            {errorMessage}
          </div>
        ) : null}

        {isBusy ? (
          <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
            {step === 'creating' ? 'Criando snapshot imutavel...' : null}
            {step === 'uploading' ? 'Enviando arquivo para o storage...' : null}
            {step === 'attaching' ? 'Calculando sha256 e vinculando ao snapshot...' : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

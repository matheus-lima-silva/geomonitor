import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card } from '../../../components/ui';
import {
  LICENSE_ATTACHMENT_SLOTS,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
} from '../services/licenseAttachmentService';

// MVP de anexos: 2 slots fixos (documentoLO, planoGerenciamento).
// Redesign completo com abas/drawer fica no PR3.

const SLOT_CONFIG = {
  documentoLO: {
    titulo: 'Documento da LO',
    subtitulo: 'PDF original da licença',
    iconName: 'file-text',
  },
  planoGerenciamento: {
    titulo: 'Plano de Gerenciamento Ambiental',
    subtitulo: 'PGA anexo (opcional)',
    iconName: 'file-text',
  },
};

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function SlotCard({
  slot,
  entry,
  uploading,
  disabled,
  onPick,
  onDownload,
  onDelete,
}) {
  const config = SLOT_CONFIG[slot];
  const inputRef = useRef(null);

  const handleFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPick(slot, file);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <Card variant="nested" className="p-4">
      <header className="flex items-start gap-3">
        <span className="text-slate-400 mt-1"><AppIcon name={config.iconName} className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-bold text-slate-800 m-0">{config.titulo}</h5>
          <p className="text-xs text-slate-500 m-0">{config.subtitulo}</p>
        </div>
      </header>

      <div className="mt-3">
        {uploading ? (
          <p className="text-xs text-brand-600 font-semibold m-0 flex items-center gap-2">
            <AppIcon name="upload" className="w-4 h-4 animate-pulse" />
            Enviando...
          </p>
        ) : entry ? (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-800 font-medium break-all">{entry.fileName || '(sem nome)'}</div>
            <div className="text-2xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
              {entry.sizeBytes ? <span>{formatBytes(entry.sizeBytes)}</span> : null}
              {entry.attachedAt ? <span>Anexado em {formatDate(entry.attachedAt)}</span> : null}
              {entry.attachedBy ? <span>por {entry.attachedBy}</span> : null}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => onDownload(slot, entry)} disabled={disabled}>
                <AppIcon name="download" />
                Baixar
              </Button>
              <Button variant="outline" size="sm" onClick={openPicker} disabled={disabled}>
                <AppIcon name="edit" />
                Substituir
              </Button>
              <Button variant="danger" size="sm" onClick={() => onDelete(slot)} disabled={disabled}>
                <AppIcon name="trash" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={openPicker} disabled={disabled} aria-label={`Anexar ${config.titulo} em PDF`}>
            <AppIcon name="plus" />
            Anexar PDF
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid={`license-file-input-${slot}`}
        onChange={handleFileChosen}
      />
    </Card>
  );
}

function LicenseFilesSection({ licenseId, showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState('');

  const hasLicenseId = useMemo(() => Boolean(String(licenseId || '').trim()), [licenseId]);

  useEffect(() => {
    let cancelled = false;
    if (!hasLicenseId) {
      setItems([]);
      return undefined;
    }
    setLoading(true);
    listAttachments(licenseId)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch((err) => { if (!cancelled) showToast?.(err?.message || 'Erro ao listar anexos.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [licenseId, hasLicenseId, showToast]);

  const entryBySlot = useMemo(() => {
    const map = {};
    for (const it of items) {
      if (it?.slot) map[it.slot] = it;
    }
    return map;
  }, [items]);

  const handlePick = useCallback(async (slot, file) => {
    setUploading(slot);
    try {
      const entry = await uploadAttachment(licenseId, slot, file);
      setItems((prev) => {
        const next = prev.filter((x) => x.slot !== slot);
        return [...next, { ...entry, slot }];
      });
      showToast?.('Arquivo anexado com sucesso.', 'success');
    } catch (err) {
      const msg = err?.code === 'UNSUPPORTED_MEDIA_TYPE'
        ? 'Apenas PDF é aceito.'
        : err?.code === 'PAYLOAD_TOO_LARGE'
          ? 'Arquivo excede 50 MB.'
          : err?.message || 'Falha no upload.';
      showToast?.(msg, 'error');
    } finally {
      setUploading('');
    }
  }, [licenseId, showToast]);

  const handleDownload = useCallback(async (slot, entry) => {
    try {
      await downloadAttachment(entry.mediaAssetId, entry.fileName);
    } catch (err) {
      showToast?.(err?.message || 'Falha ao baixar anexo.', 'error');
    }
  }, [showToast]);

  const handleDelete = useCallback(async (slot) => {
    setUploading(slot);
    try {
      await deleteAttachment(licenseId, slot);
      setItems((prev) => prev.filter((x) => x.slot !== slot));
      showToast?.('Anexo removido.', 'success');
    } catch (err) {
      showToast?.(err?.message || 'Falha ao remover anexo.', 'error');
    } finally {
      setUploading('');
    }
  }, [licenseId, showToast]);

  return (
    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
      <h4 className="text-sm font-bold text-slate-800 m-0 mb-3">Documentos anexos</h4>

      {!hasLicenseId ? (
        <p className="text-xs text-slate-500 m-0">
          Salve a LO primeiro para anexar documentos.
        </p>
      ) : (
        <>
          {loading && <p className="text-xs text-slate-500 m-0 mb-2">Carregando anexos...</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LICENSE_ATTACHMENT_SLOTS.map((slot) => (
              <SlotCard
                key={slot}
                slot={slot}
                entry={entryBySlot[slot]}
                uploading={uploading === slot}
                disabled={Boolean(uploading)}
                onPick={handlePick}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default LicenseFilesSection;

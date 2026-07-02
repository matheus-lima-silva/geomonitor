import { useState } from 'react';
import AppIcon from '@app/components/AppIcon';
import { Button, Modal } from '@app/components/ui';
import { useToast } from '@app/context/ToastContext';

/**
 * Resultado da geracao do PAEC: sucesso simples quando zero pendencias, ou
 * aviso + lista das pendencias que foram marcadas [[PENDENTE]] no proprio
 * documento. O download nunca e bloqueado pelas pendencias.
 */
export default function GenerateResultModal({ result, onClose, onDownload }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  if (!result) return null;

  const pendencies = result.pendencies || [];
  const hasPendencies = pendencies.length > 0;

  async function handleDownload() {
    setDownloading(true);
    try {
      await onDownload();
    } catch (err) {
      toast.show(err?.message || 'Erro ao baixar o documento.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resultado da geração"
      icon={hasPendencies ? 'alert' : 'check'}
      size="md"
    >
      {hasPendencies ? (
        <>
          <p className="m-0 text-sm text-slate-700">
            O documento foi gerado, mas <strong>{pendencies.length} {pendencies.length === 1 ? 'item ficou' : 'itens ficaram'}</strong> marcado{pendencies.length === 1 ? '' : 's'} como pendente{pendencies.length === 1 ? '' : 's'} dentro dele — destacado{pendencies.length === 1 ? '' : 's'} em amarelo.
          </p>
          <ul className="mt-3 mb-0 max-h-44 overflow-y-auto p-0 list-none flex flex-col gap-1 border border-slate-200 rounded-md p-2">
            {pendencies.map((p) => (
              <li key={p.key} className="text-xs text-slate-600 px-2 py-1">{p.label}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="m-0 text-sm text-slate-700">
          O documento foi gerado a partir do modelo institucional, sem pendências.
        </p>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button variant="primary" onClick={handleDownload} disabled={downloading}>
          <AppIcon name="download" className="w-4 h-4 mr-1.5" />
          {downloading ? 'Baixando…' : 'Baixar .docx'}
        </Button>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Textarea } from '../../../components/ui';
import { followupDue, followupMonthLabel } from '../utils/followupCampaigns';

const EMPTY_FORM = { inicio: '', fim: '', obs: '' };

/* Modal "Agendar campo": define a janela de campo de uma campanha (sessão). */
function ScheduleFieldModal({ open, campaign, value, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ inicio: value?.inicio || '', fim: value?.fim || '', obs: value?.obs || '' });
      setError('');
    }
  }, [open, campaign?.id]);

  if (!campaign) return null;

  function handleSave() {
    if (!form.inicio || !form.fim) {
      setError('Informe as datas de início e fim do campo.');
      return;
    }
    if (form.fim < form.inicio) {
      setError('A data de fim deve ser igual ou posterior à de início.');
      return;
    }
    onSave({ inicio: form.inicio, fim: form.fim, obs: String(form.obs || '').trim() });
  }

  const due = followupDue(campaign);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Agendar campo"
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <AppIcon name="check" size={14} />Salvar agendamento
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{campaign.projeto}</span> · {campaign.rotulo} — entrega {followupMonthLabel(campaign.entregaMes, campaign.entregaAno)}
          {due.state !== 'entregue' ? <span className="text-slate-400"> ({due.label.toLowerCase()})</span> : null}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="schedule-field-inicio"
            label="Início do campo"
            type="date"
            value={form.inicio}
            onChange={(e) => setForm((prev) => ({ ...prev, inicio: e.target.value }))}
          />
          <Input
            id="schedule-field-fim"
            label="Fim do campo"
            type="date"
            value={form.fim}
            onChange={(e) => setForm((prev) => ({ ...prev, fim: e.target.value }))}
          />
        </div>
        <Textarea
          id="schedule-field-obs"
          label="Observação (opcional)"
          rows={2}
          placeholder="Ex.: equipe, logística, plano de amostragem..."
          value={form.obs}
          onChange={(e) => setForm((prev) => ({ ...prev, obs: e.target.value }))}
        />
        {error ? (
          <p className="flex items-start gap-2 m-0 text-xs font-medium rounded-lg px-3 py-2 bg-rose-50 text-rose-800">
            <AppIcon name="alert" size={13} className="mt-0.5 shrink-0" />{error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export default ScheduleFieldModal;

import { useEffect, useState } from 'react';
import AppIcon from '@app/components/AppIcon';
import { Button, IconButton, Input, Modal, Select } from '@app/components/ui';
import { CATEGORIES, CATEGORY_KEYS } from '../../utils/constants';
import { parseDateKey } from '../../utils/holidays';
import { fmtDate } from '../../utils/calendar';
import { activitiesOnDate } from '../../utils/dayEdit';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function newRow(dateStr) {
  return { id: null, category: 'vistoria', description: '', startDate: dateStr, endDate: dateStr };
}

/**
 * Modal "Atividades do dia": linhas categoria/descricao/inicio/fim. Salvar
 * descarta linhas sem descricao, corrige datas invertidas e exclui atividades
 * que cobriam o dia e sairam da lista (semantica em utils/dayEdit.applyDayEdits,
 * aplicada pelo chamador). Tambem marca/remove o feriado do dia.
 */
export default function DayActivitiesModal({ open, dateStr, activities, holidays, onClose, onSaveRows, onToggleHoliday }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open || !dateStr) return;
    const covering = activitiesOnDate(activities, dateStr).map((a) => ({
      id: a.id,
      category: a.category,
      description: a.description,
      startDate: a.startDate,
      endDate: a.endDate,
    }));
    setRows(covering.length > 0 ? covering : [newRow(dateStr)]);
  }, [open, dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !dateStr) return null;

  const date = parseDateKey(dateStr);
  const holiday = (holidays || []).find((h) => h.date === dateStr);

  function updateRow(index, patch) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleToggleHoliday() {
    if (holiday) {
      onToggleHoliday(dateStr, null);
    } else {
      const name = window.prompt('Nome do feriado (opcional):', '') || '';
      onToggleHoliday(dateStr, name);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${WEEKDAYS[date.getDay()]}, ${fmtDate(date)}`}
      subtitle="Atividades do dia — datas maiores criam barras de vários dias"
      icon="calendar-days"
      size="2xl"
      footer={(
        <div className="flex items-center w-full gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRows((prev) => [...prev, newRow(dateStr)])}>
            <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
            Outra atividade
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToggleHoliday}>
            {holiday ? 'Remover feriado' : 'Marcar feriado'}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSaveRows(dateStr, rows)}>Salvar</Button>
        </div>
      )}
    >
      {holiday ? (
        <p
          data-testid="holiday-indicator"
          className="m-0 mb-3 inline-block rounded-md border border-danger-border bg-critical-light px-2.5 py-1 text-xs font-semibold text-critical"
        >
          ★ Feriado: {holiday.name || 'sem nome'}
        </p>
      ) : null}

      <div className="grid grid-cols-[170px_1fr_132px_132px_34px] gap-2 mb-1 text-2xs font-bold uppercase tracking-wide text-slate-500">
        <span>Categoria</span><span>Descrição</span><span>Início</span><span>Fim</span><span />
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={row.id || `new-${index}`} data-testid="activity-row" className="grid grid-cols-[170px_1fr_132px_132px_34px] gap-2 items-center">
            <Select
              aria-label="Categoria"
              value={row.category}
              onChange={(e) => updateRow(index, { category: e.target.value })}
            >
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>{CATEGORIES[key].label}</option>
              ))}
            </Select>
            <Input
              type="text"
              aria-label="Descrição"
              placeholder="Descrição (ex: Vistoria LT 500 kV trecho T142–T168)"
              value={row.description}
              onChange={(e) => updateRow(index, { description: e.target.value })}
            />
            <Input
              type="date"
              aria-label="Início"
              value={row.startDate}
              onChange={(e) => updateRow(index, { startDate: e.target.value })}
            />
            <Input
              type="date"
              aria-label="Fim"
              value={row.endDate}
              onChange={(e) => updateRow(index, { endDate: e.target.value })}
            />
            <IconButton
              variant="dangerGhost"
              size="sm"
              aria-label="Remover atividade"
              onClick={() => removeRow(index)}
            >
              <AppIcon name="x" className="w-4 h-4" />
            </IconButton>
          </div>
        ))}
      </div>
    </Modal>
  );
}

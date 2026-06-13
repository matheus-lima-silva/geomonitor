// Aritmetica pura das edicoes do calendario (drag & drop e modal do dia).
// Mantida fora dos componentes para teste unitario direto — os hooks/handlers
// so fazem binding de eventos.

import { dateKey, parseDateKey, addDays } from './holidays';
import { genId, ID_PREFIX } from './ids';

const MS_PER_DAY = 86400000;

// Atividades que cobrem uma data (intervalo simples, sem filtro de dia util).
export function activitiesOnDate(activities, dateStr) {
  return (activities || []).filter((a) => dateStr >= a.startDate && dateStr <= a.endDate);
}

// Novas datas de uma atividade apos um drop. Modos:
//   'copy' | 'move'    -> desloca preservando a duracao (inicio = celula alvo)
//   'resize-start'     -> move o inicio (limitado ao fim)
//   'resize-end'       -> move o fim (limitado ao inicio)
export function computeDropDates(mode, activity, targetDateKey) {
  if (mode === 'resize-start') {
    return {
      startDate: targetDateKey > activity.endDate ? activity.endDate : targetDateKey,
      endDate: activity.endDate,
    };
  }
  if (mode === 'resize-end') {
    return {
      startDate: activity.startDate,
      endDate: targetDateKey < activity.startDate ? activity.startDate : targetDateKey,
    };
  }
  const duration = Math.round((parseDateKey(activity.endDate) - parseDateKey(activity.startDate)) / MS_PER_DAY);
  const newStart = parseDateKey(targetDateKey);
  return {
    startDate: dateKey(newStart),
    endDate: dateKey(addDays(newStart, duration)),
  };
}

// Aplica um drop a lista de atividades do engenheiro: 'copy' cria uma nova
// atividade com as datas novas; demais modos atualizam a existente.
export function applyDrop(activities, activityId, mode, targetDateKey) {
  const list = activities || [];
  const activity = list.find((a) => a.id === activityId);
  if (!activity) return list;

  const dates = computeDropDates(mode, activity, targetDateKey);
  if (mode === 'copy') {
    return [...list, {
      id: genId(ID_PREFIX.activity),
      category: activity.category,
      description: activity.description,
      ...dates,
    }];
  }
  return list.map((a) => (a.id === activityId ? { ...a, ...dates } : a));
}

// Aplica o "Salvar" do modal do dia: linhas sem descricao sao descartadas,
// datas invertidas sao corrigidas, e atividades que cobriam o dia mas sairam
// da lista sao excluidas. Linhas sem id viram atividades novas.
export function applyDayEdits(activities, dateStr, rows) {
  const list = activities || [];
  const editedIds = new Set();
  const updates = new Map();
  const additions = [];

  (rows || []).forEach((row) => {
    const description = (row.description || '').trim();
    let { startDate, endDate } = row;
    if (!description || !startDate || !endDate) return;
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

    if (row.id && list.some((a) => a.id === row.id)) {
      editedIds.add(row.id);
      updates.set(row.id, { category: row.category, description, startDate, endDate });
    } else {
      const id = genId(ID_PREFIX.activity);
      editedIds.add(id);
      additions.push({ id, category: row.category, description, startDate, endDate });
    }
  });

  const next = list
    .filter((a) => {
      const coveredDay = dateStr >= a.startDate && dateStr <= a.endDate;
      return !coveredDay || editedIds.has(a.id);
    })
    .map((a) => (updates.has(a.id) ? { ...a, ...updates.get(a.id) } : a));

  return [...next, ...additions];
}

// Alterna o feriado de uma data na lista explicita do relatorio.
export function toggleHoliday(holidays, dateStr, name = '') {
  const list = holidays || [];
  if (list.some((h) => h.date === dateStr)) {
    return list.filter((h) => h.date !== dateStr);
  }
  return [...list, { date: dateStr, name: (name || '').trim() }].sort((a, b) => a.date.localeCompare(b.date));
}

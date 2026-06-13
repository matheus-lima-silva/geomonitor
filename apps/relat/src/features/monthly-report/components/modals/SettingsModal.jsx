import { useEffect, useMemo, useState } from 'react';
import AppIcon from '@app/components/AppIcon';
import { Button, Input, Modal } from '@app/components/ui';
import { useToast } from '@app/context/ToastContext';
import QuadroTable, { QuadroLegend } from '../preview/QuadroTable';
import { QUADRO_STYLES } from '../../utils/constants';
import { genId, ID_PREFIX } from '../../utils/ids';
import { getDateRange, fmtDate } from '../../utils/calendar';
import { dateKey, officialHolidaysForPeriod } from '../../utils/holidays';
import { buildQuadroWeeks } from '../../utils/docModel';

const TABS = [
  { key: 'equipe', label: 'Equipe', icon: 'users' },
  { key: 'feriados', label: 'Feriados', icon: 'calendar-x' },
  { key: 'contrato', label: 'Contrato', icon: 'file-text' },
  { key: 'quadro', label: 'Quadro', icon: 'table' },
];

const AVATAR_COLORS = ['bg-brand-600', 'bg-success', 'bg-warning', 'bg-critical', 'bg-slate-600'];

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// Mescla as edicoes de feriados do periodo com os feriados fora do periodo
// (que o painel nao mostra e nao deve apagar).
export function mergeHolidayEdits(allHolidays, periodRows, startKey, endKey) {
  const outOfPeriod = (allHolidays || []).filter((h) => h.date < startKey || h.date > endKey);
  const inPeriod = (periodRows || [])
    .filter((h) => h.date && h.date >= startKey && h.date <= endKey)
    .map((h) => ({ date: h.date, name: (h.name || '').trim() }));
  const seen = new Set();
  const deduped = inPeriod.filter((h) => {
    if (seen.has(h.date)) return false;
    seen.add(h.date);
    return true;
  });
  return [...outOfPeriod, ...deduped].sort((a, b) => a.date.localeCompare(b.date));
}

// Sincroniza engenheiros do mes com a selecao "Neste relatorio" da equipe.
export function syncEngineersWithTeam(engineers, teamRows) {
  let next = [...(engineers || [])];
  teamRows.forEach((member) => {
    const name = (member.name || '').trim();
    if (!name) return;
    const existing = next.find((e) => (e.name || '').trim() === name);
    if (member.inReport && !existing) {
      next.push({ id: genId(ID_PREFIX.engineer), name, sortOrder: next.length, activities: [], projects: [] });
    } else if (!member.inReport && existing) {
      next = next.filter((e) => e.id !== existing.id);
    }
  });
  return next.map((e, i) => ({ ...e, sortOrder: i }));
}

/**
 * Modal de Configuracoes (nav lateral): Equipe (cadastro global + inclusao no
 * mes), Feriados (lista do periodo + preencher oficiais RJ), Contrato (dados
 * do texto-modelo) e Quadro (estilo do Word + comparacao). Tudo aplicado no
 * Salvar: equipe/contrato vao para as settings globais; feriados, estilo e
 * inclusao de engenheiros vao para o relatorio do mes.
 */
export default function SettingsModal({ open, onClose, settings, onSaveSettings, report, updateReport }) {
  const toast = useToast();
  const [tab, setTab] = useState('equipe');
  const [team, setTeam] = useState([]);
  const [contrato, setContrato] = useState({ numero: '', objeto: '', contratante: '', contratada: '' });
  const [holidayRows, setHolidayRows] = useState([]);
  const [autofillInfo, setAutofillInfo] = useState('');
  const [quadroStyle, setQuadroStyle] = useState('marcador');
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { start, end } = getDateRange(report.refYear, report.refMonth);
  const startKey = dateKey(start);
  const endKey = dateKey(end);

  useEffect(() => {
    if (!open) return;
    setTab('equipe');
    setAutofillInfo('');
    setComparing(false);
    const engineerNames = new Set((report.engineers || []).map((e) => (e.name || '').trim()).filter(Boolean));
    const baseTeam = (settings?.team || []).map((m) => ({
      id: m.id || genId(ID_PREFIX.member),
      name: m.name || '',
      inReport: engineerNames.has((m.name || '').trim()),
    }));
    // Engenheiros do mes que nao estao no cadastro global aparecem para nao sumirem.
    (report.engineers || []).forEach((e) => {
      const name = (e.name || '').trim();
      if (name && !baseTeam.some((m) => (m.name || '').trim() === name)) {
        baseTeam.push({ id: genId(ID_PREFIX.member), name, inReport: true });
      }
    });
    setTeam(baseTeam);
    setContrato({ numero: '', objeto: '', contratante: '', contratada: '', ...(settings?.contrato || {}) });
    setHolidayRows((report.holidays || []).filter((h) => h.date >= startKey && h.date <= endKey));
    setQuadroStyle(report.quadroStyle || 'marcador');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeksForFirstEngineer = useMemo(() => {
    if (!comparing) return null;
    const firstWithActivities = (report.engineers || []).find((e) => (e.activities || []).length > 0)
      || (report.engineers || [])[0];
    return buildQuadroWeeks(report)(firstWithActivities?.activities || []);
  }, [comparing, report]);

  if (!open) return null;

  function autofillHolidays() {
    const official = officialHolidaysForPeriod(report.refYear, report.refMonth);
    const officialDates = new Set(official.map((h) => h.date));
    const custom = holidayRows.filter((h) => h.date && !officialDates.has(h.date));
    setHolidayRows([...official, ...custom].sort((a, b) => a.date.localeCompare(b.date)));
    setAutofillInfo(`${official.length} feriado(s) oficial(is) no período — nacionais + estaduais (RJ) + municipais (Rio). Revise e salve.`);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveSettings({
        team: team.filter((m) => (m.name || '').trim()).map((m) => ({ id: m.id, name: m.name.trim() })),
        contrato,
      });
      updateReport((r) => ({
        ...r,
        quadroStyle,
        holidays: mergeHolidayEdits(r.holidays, holidayRows, startKey, endKey),
        engineers: syncEngineersWithTeam(r.engineers, team),
      }));
      onClose();
    } catch (err) {
      toast.show(err?.message || 'Erro ao salvar as configurações.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configurações"
      size="2xl"
      footer={(
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      )}
    >
      <p className="m-0 mb-3 text-sm text-slate-500">Equipe e contrato valem para todos os meses.</p>

      <div className="grid grid-cols-[176px_1fr] min-h-[380px] -mx-1">
        <nav className="flex flex-col gap-0.5 bg-app-surfaceMuted border-r border-slate-200 rounded-l-[10px] p-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              data-testid={`settings-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={[
                'flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-sm font-semibold text-left transition-colors',
                tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100',
              ].join(' ')}
            >
              <AppIcon name={t.icon} className={`w-[15px] h-[15px] ${tab === t.key ? 'text-brand-600' : ''}`} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {tab === 'equipe' ? (
            <div>
              <p className="m-0 mb-3 text-sm text-slate-500">
                Cadastro da equipe — vale para todos os meses. "Neste relatório" inclui ou retira o engenheiro do mês atual.
              </p>
              <div className="flex flex-col gap-1.5">
                {team.map((member, idx) => (
                  <div key={member.id} data-testid="team-row" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-slate-50">
                    <span
                      className={`flex items-center justify-center w-[22px] h-[22px] rounded-full text-white text-2xs font-bold shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                      aria-hidden="true"
                    >
                      {initials(member.name)}
                    </span>
                    <input
                      type="text"
                      aria-label={`Nome do funcionário ${idx + 1}`}
                      placeholder="Nome do funcionário"
                      className="flex-1 min-w-0 bg-transparent text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1 py-0.5"
                      value={member.name}
                      onChange={(e) => setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, name: e.target.value } : m)))}
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                      <input
                        type="checkbox"
                        checked={member.inReport}
                        onChange={(e) => setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, inReport: e.target.checked } : m)))}
                      />
                      Neste relatório
                    </label>
                    <button
                      type="button"
                      aria-label={`Excluir ${member.name || 'funcionário'}`}
                      className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"
                      onClick={() => setTeam((prev) => prev.filter((m) => m.id !== member.id))}
                    >
                      <AppIcon name="trash-2" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setTeam((prev) => [...prev, { id: genId(ID_PREFIX.member), name: '', inReport: true }])}
              >
                <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
                Adicionar funcionário
              </Button>
            </div>
          ) : null}

          {tab === 'feriados' ? (
            <div>
              <p className="m-0 mb-3 text-sm text-slate-500">
                Feriados aparecem destacados no quadro. Use "Preencher feriados RJ" para os oficiais do período ({fmtDate(start)} a {fmtDate(end)}).
              </p>
              <div className="flex flex-col gap-1.5">
                {holidayRows.length === 0 ? (
                  <p className="m-0 text-sm text-slate-400">
                    Nenhum feriado marcado neste período. Use "Preencher feriados RJ" para adicionar os oficiais automaticamente.
                  </p>
                ) : holidayRows.map((h, idx) => (
                  <div key={`${h.date}-${idx}`} data-testid="holiday-row" className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label="Data do feriado"
                      min={startKey}
                      max={endKey}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={h.date}
                      onChange={(e) => setHolidayRows((prev) => prev.map((row, i) => (i === idx ? { ...row, date: e.target.value } : row)))}
                    />
                    <input
                      type="text"
                      aria-label="Nome do feriado"
                      placeholder="Nome do feriado (opcional)"
                      className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={h.name}
                      onChange={(e) => setHolidayRows((prev) => prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)))}
                    />
                    <button
                      type="button"
                      aria-label="Remover feriado"
                      className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"
                      onClick={() => setHolidayRows((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <AppIcon name="x" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {autofillInfo ? (
                <p className="mt-3 mb-0 rounded-md bg-brand-50 border border-brand-200 px-3 py-2 text-xs text-brand-700">{autofillInfo}</p>
              ) : null}
              <div className="flex items-center gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={() => setHolidayRows((prev) => [...prev, { date: startKey, name: '' }])}>
                  + Adicionar
                </Button>
                <Button variant="ghost" size="sm" onClick={autofillHolidays}>
                  Preencher feriados RJ
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'contrato' ? (
            <div>
              <p className="m-0 mb-3 text-sm text-slate-500">Dados usados no texto-modelo da introdução.</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="cfg-numero"
                  label="Nº do contrato"
                  value={contrato.numero}
                  onChange={(e) => setContrato((c) => ({ ...c, numero: e.target.value }))}
                />
                <div className="col-span-2">
                  <Input
                    id="cfg-objeto"
                    label="Objeto"
                    value={contrato.objeto}
                    onChange={(e) => setContrato((c) => ({ ...c, objeto: e.target.value }))}
                  />
                </div>
                <Input
                  id="cfg-contratante"
                  label="Contratante"
                  value={contrato.contratante}
                  onChange={(e) => setContrato((c) => ({ ...c, contratante: e.target.value }))}
                />
                <Input
                  id="cfg-contratada"
                  label="Contratada"
                  value={contrato.contratada}
                  onChange={(e) => setContrato((c) => ({ ...c, contratada: e.target.value }))}
                />
              </div>
            </div>
          ) : null}

          {tab === 'quadro' ? (
            <div>
              <p className="m-0 mb-3 text-sm text-slate-500">Como as atividades aparecem no quadro do Word.</p>
              <div className="flex flex-col gap-2">
                {QUADRO_STYLES.map((style) => (
                  <label
                    key={style.key}
                    data-testid={`quadro-style-${style.key}`}
                    className={[
                      'rounded-[10px] border p-3 cursor-pointer transition-colors',
                      quadroStyle === style.key ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="quadro-style"
                      className="sr-only"
                      checked={quadroStyle === style.key}
                      onChange={() => setQuadroStyle(style.key)}
                    />
                    <span className="block text-sm font-bold text-slate-800">{style.label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{style.description}</span>
                  </label>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setComparing(true)}>
                <AppIcon name="columns-3" className="w-3.5 h-3.5 mr-1.5" />
                Comparar lado a lado
              </Button>

              {comparing ? (
                <div data-testid="quadro-compare" className="mt-4 flex flex-col gap-4">
                  {QUADRO_STYLES.map((style) => (
                    <div key={style.key}>
                      <p className="m-0 mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{style.label}</p>
                      <QuadroTable weeks={weeksForFirstEngineer || []} variant={style.key} />
                    </div>
                  ))}
                  <QuadroLegend />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

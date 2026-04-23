import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Card, ConfirmDeleteModal, Input, Select } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { importarFeriadosNacionais, saveRulesConfig } from '../../../services/rulesService';
import { normalizeFeriados } from '../../shared/rulesConfig';

const TIPO_OPTIONS = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'personalizado', label: 'Personalizado' },
];

function formatDateBR(iso) {
  if (!iso) return '-';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function mergeFeriados(base, incoming) {
  const byData = new Map();
  for (const item of base || []) {
    if (item?.data) byData.set(item.data, item);
  }
  for (const item of incoming || []) {
    if (item?.data) byData.set(item.data, item);
  }
  return normalizeFeriados(Array.from(byData.values()));
}

function FeriadosSection({ rulesConfig }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [draftFeriados, setDraftFeriados] = useState(() => normalizeFeriados(rulesConfig?.feriados));
  const [importYear, setImportYear] = useState(() => new Date().getFullYear());
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [newItem, setNewItem] = useState({ data: '', nome: '', tipo: 'personalizado' });

  useEffect(() => {
    setDraftFeriados(normalizeFeriados(rulesConfig?.feriados));
  }, [rulesConfig]);

  const sortedFeriados = useMemo(() => draftFeriados.slice(), [draftFeriados]);

  function handleAdd() {
    const data = String(newItem.data || '').trim();
    const nome = String(newItem.nome || '').trim();
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      show('Informe uma data valida (YYYY-MM-DD).', 'error');
      return;
    }
    if (!nome) {
      show('Informe o nome do feriado.', 'error');
      return;
    }
    const merged = mergeFeriados(draftFeriados, [{ data, nome, tipo: newItem.tipo || 'personalizado' }]);
    setDraftFeriados(merged);
    setNewItem({ data: '', nome: '', tipo: 'personalizado' });
    show('Feriado adicionado a lista. Clique em "Salvar feriados" para persistir.', 'success');
  }

  function handleRemove(dataIso) {
    setDraftFeriados((prev) => prev.filter((item) => item.data !== dataIso));
    setDeleteCandidate(null);
    show('Feriado removido da lista. Salve para persistir.', 'success');
  }

  async function handleImport() {
    const yearNumber = Number.parseInt(String(importYear || ''), 10);
    if (!Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
      show('Ano invalido para importacao.', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const { feriados: imported } = await importarFeriadosNacionais(yearNumber, rulesConfig);
      const merged = mergeFeriados(draftFeriados, imported);
      const addedCount = merged.length - draftFeriados.length;
      setDraftFeriados(merged);
      show(`${imported.length} feriado(s) nacionais importado(s) (${addedCount} novo(s)). Salve para persistir.`, 'success');
    } catch (error) {
      show(error?.message || 'Falha ao importar feriados nacionais.', 'error');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // Envia somente a fatia `feriados` — o backend usa `merge: true` e preserva
      // `criticalidade`/`retencao`. Enviar `...rulesConfig` junto leva `_links` no
      // payload, que e rejeitado pelo schema Zod `.strict()`.
      await saveRulesConfig(
        { feriados: draftFeriados },
        { updatedBy: user?.email, merge: true },
      );
      show('Feriados salvos com sucesso.', 'success');
    } catch (error) {
      show(error?.message || 'Falha ao salvar feriados.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="admin-feriados-section">
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <h3 className="text-base font-bold text-slate-800 m-0 mb-1">Feriados</h3>
        <p className="text-sm text-slate-500 mb-4">
          Datas cadastradas aqui sao sinalizadas (nao bloqueadas) no planejamento de visitas e
          no diario da vistoria, evitando que um feriado pareca "dia sem producao".
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-end gap-3 mb-4">
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="feriados-import-year" className="block text-xs font-semibold text-slate-700 mb-1">
                Ano
              </label>
              <Input
                id="feriados-import-year"
                type="number"
                min="2000"
                max="2100"
                value={importYear}
                onChange={(event) => setImportYear(event.target.value === '' ? '' : Number(event.target.value))}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleImport}
              disabled={isImporting}
              data-testid="feriados-import-btn"
            >
              <AppIcon name="download" />
              {isImporting ? 'Importando...' : 'Importar nacionais'}
            </Button>
          </div>
          <p className="text-2xs text-slate-500 m-0 md:text-right">
            Consulta a <code>brasilapi.com.br</code> via proxy e mescla com a lista atual (ignora duplicatas).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_180px_auto] items-end gap-2 mb-4">
          <div>
            <label htmlFor="feriados-new-data" className="block text-xs font-semibold text-slate-700 mb-1">
              Data
            </label>
            <Input
              id="feriados-new-data"
              type="date"
              value={newItem.data}
              onChange={(event) => setNewItem((prev) => ({ ...prev, data: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="feriados-new-nome" className="block text-xs font-semibold text-slate-700 mb-1">
              Nome
            </label>
            <Input
              id="feriados-new-nome"
              value={newItem.nome}
              onChange={(event) => setNewItem((prev) => ({ ...prev, nome: event.target.value }))}
              placeholder="Ex.: Aniversario da cidade"
            />
          </div>
          <div>
            <label htmlFor="feriados-new-tipo" className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo
            </label>
            <Select
              id="feriados-new-tipo"
              value={newItem.tipo}
              onChange={(event) => setNewItem((prev) => ({ ...prev, tipo: event.target.value }))}
            >
              {TIPO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <Button variant="primary" onClick={handleAdd} data-testid="feriados-add-btn">
            <AppIcon name="plus" />
            Adicionar
          </Button>
        </div>

        <Card variant="flat" className="overflow-x-auto w-full !p-0">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFeriados.map((item) => (
                <tr key={item.data} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDateBR(item.data)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <Badge tone={item.tipo === 'nacional' ? 'ok' : 'neutral'} size="sm">{item.tipo}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <Button variant="danger" size="sm" onClick={() => setDeleteCandidate(item)} data-testid={`feriados-remove-${item.data}`}>
                      <AppIcon name="trash" />
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
              {sortedFeriados.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-6 text-center text-sm text-slate-500">Nenhum feriado cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={isSaving} data-testid="feriados-save-btn">
            <AppIcon name="save" />
            {isSaving ? 'Salvando...' : 'Salvar feriados'}
          </Button>
        </div>
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteCandidate)}
        itemName="o feriado"
        itemId={deleteCandidate ? `${formatDateBR(deleteCandidate.data)} - ${deleteCandidate.nome}` : ''}
        onConfirm={() => handleRemove(deleteCandidate?.data)}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}

export default FeriadosSection;

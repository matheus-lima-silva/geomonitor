import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import {
  Badge,
  Button,
  Card,
  ConfirmDeleteModal,
  Input,
  Modal,
  Textarea,
} from '../../../components/ui';
import { useOptionalToast } from '../../../context/ToastContext';
import {
  createSnippet,
  deleteSnippet,
  executeSql,
  listAudit,
  listSnippets,
  updateSnippet,
} from '../services/adminSqlService';

const PLACEHOLDER = 'SELECT id, payload->>\'nome\' AS nome\nFROM users\nLIMIT 10';

function formatCellValue(value) {
  if (value == null) return <span className="text-slate-400">NULL</span>;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function AuditRow({ entry }) {
  const statusTone = entry.status === 'success'
    ? 'ok'
    : entry.status === 'blocked'
      ? 'warning'
      : 'danger';

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
        {new Date(entry.executedAt).toLocaleString('pt-BR')}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{entry.executedBy}</td>
      <td className="px-3 py-2">
        <Badge tone={statusTone}>{entry.status}</Badge>
      </td>
      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
        {entry.rowCount == null ? '-' : entry.rowCount}
      </td>
      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
        {entry.durationMs == null ? '-' : `${entry.durationMs} ms`}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        <pre className="font-mono whitespace-pre-wrap break-words max-w-xl">{entry.sqlText}</pre>
        {entry.errorMessage && (
          <p className="mt-1 text-xs text-danger">{entry.errorMessage}</p>
        )}
      </td>
    </tr>
  );
}

function SqlExecutorPanel() {
  const { show } = useOptionalToast();
  const [sql, setSql] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditItems, setAuditItems] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [snippets, setSnippets] = useState([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState('');
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });
  const [isSavingSnippet, setIsSavingSnippet] = useState(false);

  const [isManageOpen, setIsManageOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', sqlText: '', description: '' });
  const [deletingSnippet, setDeletingSnippet] = useState(null);

  const selectedSnippet = useMemo(
    () => snippets.find((s) => String(s.id) === String(selectedSnippetId)) || null,
    [snippets, selectedSnippetId],
  );

  const refreshSnippets = useCallback(async () => {
    try {
      const items = await listSnippets();
      setSnippets(items);
    } catch (err) {
      show(err?.message || 'Erro ao carregar snippets.', 'error');
    }
  }, [show]);

  useEffect(() => {
    refreshSnippets();
  }, [refreshSnippets]);

  const handleExecute = useCallback(async () => {
    if (!sql.trim()) {
      show('Digite uma consulta SQL antes de executar.', 'info');
      return;
    }
    setIsExecuting(true);
    setError(null);
    setResult(null);
    try {
      const data = await executeSql(sql);
      setResult(data);
      show(`Consulta executada (${data?.rowCount ?? 0} linhas em ${data?.durationMs ?? 0} ms).`, 'success');
    } catch (err) {
      setError(err?.message || 'Erro ao executar SQL.');
      show(err?.message || 'Erro ao executar SQL.', 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [sql, show]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const response = await listAudit({ page: 1, limit: 20 });
      setAuditItems(response.items || []);
    } catch (err) {
      show(err?.message || 'Erro ao carregar historico.', 'error');
    } finally {
      setAuditLoading(false);
    }
  }, [show]);

  useEffect(() => {
    if (auditOpen) loadAudit();
  }, [auditOpen, loadAudit]);

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleExecute();
    }
  }

  function handleLoadSnippet() {
    if (!selectedSnippet) {
      show('Selecione um snippet para carregar.', 'info');
      return;
    }
    setSql(selectedSnippet.sqlText || '');
    show(`Snippet "${selectedSnippet.name}" carregado.`, 'success');
  }

  function openSaveModal() {
    if (!sql.trim()) {
      show('Nada para salvar — o editor esta vazio.', 'info');
      return;
    }
    setSaveForm({ name: '', description: '' });
    setIsSaveOpen(true);
  }

  async function handleSaveSnippet() {
    const name = saveForm.name.trim();
    if (!name) {
      show('Informe um nome para o snippet.', 'error');
      return;
    }
    setIsSavingSnippet(true);
    try {
      await createSnippet({
        name,
        sqlText: sql,
        description: saveForm.description.trim() || null,
      });
      show(`Snippet "${name}" salvo.`, 'success');
      setIsSaveOpen(false);
      await refreshSnippets();
    } catch (err) {
      show(err?.message || 'Erro ao salvar snippet.', 'error');
    } finally {
      setIsSavingSnippet(false);
    }
  }

  function beginEditSnippet(snippet) {
    setEditingId(snippet.id);
    setEditDraft({
      name: snippet.name || '',
      sqlText: snippet.sqlText || '',
      description: snippet.description || '',
    });
  }

  async function handleUpdateSnippet() {
    const original = snippets.find((s) => String(s.id) === String(editingId));
    if (!original) return;
    try {
      await updateSnippet(original, {
        name: editDraft.name.trim(),
        sqlText: editDraft.sqlText,
        description: editDraft.description.trim() || null,
      });
      show('Snippet atualizado.', 'success');
      setEditingId(null);
      await refreshSnippets();
    } catch (err) {
      show(err?.message || 'Erro ao atualizar snippet.', 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deletingSnippet) return;
    try {
      await deleteSnippet(deletingSnippet);
      show(`Snippet "${deletingSnippet.name}" excluido.`, 'success');
      setDeletingSnippet(null);
      if (String(selectedSnippetId) === String(deletingSnippet.id)) {
        setSelectedSnippetId('');
      }
      await refreshSnippets();
    } catch (err) {
      show(err?.message || 'Erro ao excluir snippet.', 'error');
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="admin-sql-section">
      <Card variant="flat" className="bg-info/10 border border-info">
        <div className="flex items-start gap-3">
          <AppIcon name="info" className="w-5 h-5 text-info mt-0.5" aria-hidden="true" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold m-0">Console SQL somente leitura</p>
            <p className="m-0 mt-1 text-xs text-slate-600">
              Apenas <code>SELECT</code>, <code>WITH</code>, <code>EXPLAIN</code> e <code>SHOW</code> sao permitidos.
              Executa em transacao READ ONLY com timeout de 5s e limite de 1000 linhas.
              Todas as execucoes sao auditadas.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2" data-testid="admin-sql-snippets-bar">
        <label htmlFor="admin-sql-snippet-select" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Snippets salvos
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="admin-sql-snippet-select"
            value={selectedSnippetId}
            onChange={(event) => setSelectedSnippetId(event.target.value)}
            className="flex-1 min-w-[220px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="">— Selecione um snippet —</option>
            {snippets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.description ? ` · ${s.description}` : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleLoadSnippet} disabled={!selectedSnippetId}>
            <AppIcon name="download" />
            Carregar
          </Button>
          <Button variant="outline" size="sm" onClick={openSaveModal}>
            <AppIcon name="save" />
            Salvar atual
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsManageOpen(true)} disabled={snippets.length === 0}>
            <AppIcon name="edit" />
            Gerenciar
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="admin-sql-input" className="text-sm font-semibold text-slate-700">
          SQL
        </label>
        <Textarea
          id="admin-sql-input"
          value={sql}
          onChange={(event) => setSql(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={8}
          placeholder={PLACEHOLDER}
          className="font-mono text-sm min-h-[180px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500 m-0">
            Atalho: <kbd className="px-1 border border-slate-300 rounded">Ctrl</kbd>+<kbd className="px-1 border border-slate-300 rounded">Enter</kbd> para executar.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSql(''); setResult(null); setError(null); }} disabled={isExecuting}>
              <AppIcon name="close" />
              Limpar
            </Button>
            <Button variant="primary" size="sm" onClick={handleExecute} disabled={isExecuting}>
              <AppIcon name={isExecuting ? 'loader' : 'database'} className={isExecuting ? 'animate-spin' : ''} />
              {isExecuting ? 'Executando...' : 'Executar'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Card variant="flat" className="border border-danger bg-danger/5">
          <p className="text-sm text-danger m-0 font-semibold">Erro</p>
          <pre className="text-xs text-danger mt-1 whitespace-pre-wrap m-0">{error}</pre>
        </Card>
      )}

      {result && (
        <Card variant="flat" className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span><strong>{result.rowCount ?? 0}</strong> linhas</span>
              <span>·</span>
              <span>{result.durationMs ?? 0} ms</span>
              {result.truncated && (
                <>
                  <span>·</span>
                  <Badge tone="warning">Truncado em 1000</Badge>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-left text-sm border-collapse" data-testid="admin-sql-result-table">
              <thead>
                <tr>
                  {(result.columns || []).map((col) => (
                    <th key={col} className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(result.rows || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {(result.columns || []).map((col) => (
                      <td key={col} className="px-3 py-2 text-xs text-slate-700 max-w-md truncate" title={String(row[col] ?? '')}>
                        {formatCellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
                {(result.rows || []).length === 0 && (
                  <tr>
                    <td colSpan={(result.columns || []).length || 1} className="px-3 py-6 text-center text-xs text-slate-500">
                      Nenhuma linha retornada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-2">
        <Button variant="outline" size="sm" onClick={() => setAuditOpen((prev) => !prev)}>
          <AppIcon name={auditOpen ? 'chevron-up' : 'chevron-down'} />
          {auditOpen ? 'Ocultar historico' : 'Ver historico de execucoes'}
        </Button>
        {auditOpen && (
          <Card variant="flat" className="!p-0 mt-3 overflow-hidden">
            <div className="overflow-x-auto max-h-[40vh]">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quando</th>
                    <th className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quem</th>
                    <th className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Linhas</th>
                    <th className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duracao</th>
                    <th className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">SQL</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading && (
                    <tr><td colSpan="6" className="px-3 py-6 text-center text-xs text-slate-500">Carregando...</td></tr>
                  )}
                  {!auditLoading && auditItems.length === 0 && (
                    <tr><td colSpan="6" className="px-3 py-6 text-center text-xs text-slate-500">Sem execucoes registradas.</td></tr>
                  )}
                  {!auditLoading && auditItems.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        title="Salvar snippet"
        size="md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsSaveOpen(false)} disabled={isSavingSnippet}>
              <AppIcon name="close" />
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveSnippet} disabled={isSavingSnippet || !saveForm.name.trim()}>
              <AppIcon name="save" />
              Salvar
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3">
          <Input
            id="snippet-name"
            label="Nome"
            value={saveForm.name}
            onChange={(event) => setSaveForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ex.: Torres com lat/lng por linha"
            maxLength={100}
          />
          <Input
            id="snippet-description"
            label="Descricao (opcional)"
            value={saveForm.description}
            onChange={(event) => setSaveForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Resumo curto do que a query faz"
            maxLength={500}
          />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">SQL que sera salvo</p>
            <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">{sql}</pre>
          </div>
        </div>
      </Modal>

      <Modal
        open={isManageOpen}
        onClose={() => { setIsManageOpen(false); setEditingId(null); }}
        title="Gerenciar snippets"
        size="lg"
      >
        <div className="flex flex-col gap-3" data-testid="admin-sql-manage-list">
          {snippets.length === 0 && (
            <p className="text-sm text-slate-500 m-0">Nenhum snippet salvo.</p>
          )}
          {snippets.map((snippet) => {
            const isEditing = String(editingId) === String(snippet.id);
            return (
              <Card key={snippet.id} variant="flat" className="border border-slate-200">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      id={`snippet-edit-name-${snippet.id}`}
                      label="Nome"
                      value={editDraft.name}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))}
                      maxLength={100}
                    />
                    <Input
                      id={`snippet-edit-description-${snippet.id}`}
                      label="Descricao"
                      value={editDraft.description}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, description: event.target.value }))}
                      maxLength={500}
                    />
                    <label htmlFor={`snippet-edit-sql-${snippet.id}`} className="text-xs font-semibold text-slate-700">SQL</label>
                    <Textarea
                      id={`snippet-edit-sql-${snippet.id}`}
                      value={editDraft.sqlText}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, sqlText: event.target.value }))}
                      rows={6}
                      className="font-mono text-xs"
                    />
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        <AppIcon name="close" />
                        Cancelar
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleUpdateSnippet}>
                        <AppIcon name="save" />
                        Salvar alteracoes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 m-0">{snippet.name}</p>
                      {snippet.description && (
                        <p className="text-xs text-slate-500 m-0 mt-0.5">{snippet.description}</p>
                      )}
                      <pre className="mt-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{snippet.sqlText}</pre>
                      <p className="text-2xs text-slate-400 m-0 mt-1">
                        Criado por {snippet.createdBy}
                        {snippet.updatedAt && snippet.updatedAt !== snippet.createdAt
                          ? ` · atualizado por ${snippet.updatedBy || snippet.createdBy}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => beginEditSnippet(snippet)}>
                        <AppIcon name="edit" />
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeletingSnippet(snippet)}>
                        <AppIcon name="trash" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(deletingSnippet)}
        itemName="o snippet"
        itemId={deletingSnippet?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSnippet(null)}
      />
    </div>
  );
}

export default SqlExecutorPanel;

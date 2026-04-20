import { useCallback, useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Card, Textarea } from '../../../components/ui';
import { useOptionalToast } from '../../../context/ToastContext';
import { executeSql, listAudit } from '../services/adminSqlService';

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
    </div>
  );
}

export default SqlExecutorPanel;

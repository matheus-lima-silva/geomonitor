import AppIcon from '../../../components/AppIcon';
import { Card, IconButton } from '../../../components/ui';

function formatTimestamp(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return String(value);
  }
}

/* Painel lateral: histórico de emissões (relatórios protocolados/entregues),
   montado a partir dos report-archives dos compounds. Do mais recente ao mais
   antigo. Degrada para estados de carregamento/erro/vazio sem quebrar. */
function FollowupEmissionsPanel({ emissions = [], loading = false, error = '', onNavigate, onToast }) {
  return (
    <Card className="!p-5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold text-slate-800 m-0">Emissões</h3>
          <p className="text-xs text-slate-500 m-0">Relatórios entregues, do mais recente ao mais antigo.</p>
        </div>
        <IconButton aria-label="Abrir Relatório Final" title="Abrir Relatório Final" onClick={() => onNavigate?.('georelat')}>
          <AppIcon name="arrow-up-right" size={15} />
        </IconButton>
      </div>

      {loading ? (
        <p className="m-0 text-xs text-slate-500">Carregando emissões...</p>
      ) : error ? (
        <p className="m-0 text-xs text-slate-500">Não foi possível carregar as emissões. Ver no módulo Relatórios.</p>
      ) : emissions.length === 0 ? (
        <p className="m-0 text-xs text-slate-500">Nenhuma entrega registrada ainda.</p>
      ) : (
        <ol className="m-0 p-0 list-none flex flex-col">
          {emissions.map((emission, index) => (
            <li key={emission.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < emissions.length - 1 ? (
                <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" aria-hidden="true" />
              ) : null}
              <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-emerald-100 text-emerald-700">
                <AppIcon name="file-check-2" size={15} />
              </span>
              <div className="flex flex-col gap-0.5 min-w-0 pt-0.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xs font-bold uppercase tracking-wide text-slate-400">v{emission.version}</span>
                  <span className="text-2xs text-slate-400 tabular-nums">{formatTimestamp(emission.deliveredAt)}</span>
                </div>
                <p className="text-sm font-medium text-slate-700 m-0 truncate" title={emission.compoundName}>{emission.compoundName}</p>
                {emission.deliveredBy ? <p className="text-xs text-slate-500 m-0">{emission.deliveredBy}</p> : null}
                {emission.sha ? <p className="text-2xs text-slate-400 m-0 font-mono">{emission.sha}</p> : null}
              </div>
              <IconButton
                aria-label={`Detalhes da emissão ${emission.compoundName} v${emission.version}`}
                title="Baixar no módulo Relatórios"
                onClick={() => onToast?.('Arquivo disponível no módulo Relatórios → Relatório Final.', 'info')}
              >
                <AppIcon name="download" size={14} />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default FollowupEmissionsPanel;

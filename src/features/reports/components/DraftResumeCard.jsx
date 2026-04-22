import AppIcon from '../../../components/AppIcon';
import { Button, Card } from '../../../components/ui';
import { fmt } from '../utils/reportUtils';

// Banner exibido no topo da aba "Relatorio Final" quando ha um rascunho de
// CompoundWizard salvo localmente. Clicar em "Continuar" abre o wizard em
// modo create com o draft ja aplicado (sem o modal legado de confirmacao);
// "Descartar" e explicito e pede confirmacao via modal do chamador.
export default function DraftResumeCard({ draft, savedAt, onResume, onDiscard }) {
  if (!draft || !String(draft.nome || '').trim()) return null;

  return (
    <Card
      variant="nested"
      className="flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50"
      data-testid="compound-draft-resume"
    >
      <div className="flex items-start gap-3">
        <AppIcon name="edit" className="mt-0.5 text-brand-600" />
        <div>
          <div className="text-sm font-bold text-slate-800">Rascunho em andamento</div>
          <p className="m-0 text-xs text-slate-600">
            <strong>{draft.nome}</strong>
            {savedAt ? <> — salvo {fmt(savedAt)}</> : null}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          data-testid="compound-draft-discard"
        >
          <AppIcon name="trash-2" /> Descartar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onResume}
          data-testid="compound-draft-resume-btn"
        >
          <AppIcon name="edit" /> Continuar edição
        </Button>
      </div>
    </Card>
  );
}

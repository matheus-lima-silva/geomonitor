import AppIcon from '../../../../components/AppIcon';
import { WIZARD_STEPS } from './wizardConstants';

// Step 5 — read-only + resumo das pendencias.
// E aqui que o bloqueio acontece: se missingRequired tiver itens, listar quais
// e em qual step, com link para navegar direto.
export default function StepRevisao({
  draft,
  mode,
  missingRequired,
  onJumpToStep,
  signatariosCandidatos,
  workspaceLabelsById,
  compound,
}) {
  const sigLookup = Object.fromEntries(
    (signatariosCandidatos || []).map((s) => [s.id, s]),
  );

  return (
    <div className="flex flex-col gap-4">
      {missingRequired && missingRequired.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AppIcon name="alert" size={16} className="mt-0.5 text-amber-600" />
            <div>
              <p className="m-0 font-semibold">
                Campos obrigatórios pendentes para concluir:
              </p>
              <ul className="mt-2 mb-0 list-disc pl-5 space-y-1">
                {missingRequired.map((field) => {
                  const step = WIZARD_STEPS.find((s) => s.id === field.stepId);
                  return (
                    <li key={field.key}>
                      <button
                        type="button"
                        className="font-medium text-amber-900 underline hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                        onClick={() => onJumpToStep?.(field.stepId)}
                      >
                        {field.label}
                      </button>
                      <span className="text-amber-700"> — em {step?.label || field.stepId}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-success-border bg-success-light p-4 text-sm text-success">
          <AppIcon name="check" size={16} className="mr-2 text-success" />
          Tudo certo para {mode === 'edit' ? 'salvar' : 'criar'} o relatório.
        </div>
      )}

      <SummarySection title="Cabeçalho" onEdit={() => onJumpToStep?.('cabecalho')}>
        <SummaryRow label="Nome" value={draft.nome || <span className="italic text-slate-400">(vazio)</span>} />
        <SummaryRow label="Revisão" value={draft.revisao || '00'} />
        <SummaryRow label="Nome da LT" value={draft.nome_lt || <span className="italic text-slate-400">(vazio)</span>} />
        <SummaryRow label="Título do programa" value={draft.titulo_programa || <span className="italic text-slate-400">(vazio)</span>} />
        <SummaryRow label="Código do documento" value={draft.codigo_documento || <span className="italic text-slate-400">(vazio)</span>} />
        <SummaryRow
          label="Coordenadas nas fotos"
          value={draft.includeTowerCoordinates ? `Sim (${draft.towerCoordinateFormat || 'decimal'})` : 'Não'}
        />
      </SummarySection>

      <SummarySection title="Textos" onEdit={() => onJumpToStep?.('textos')}>
        {['introducao', 'geologia', 'geotecnia', 'geomorfologia', 'descricao_atividades', 'conclusoes', 'analise_evolucao', 'observacoes']
          .map((key) => (
            <SummaryRow
              key={key}
              label={key}
              value={String(draft[key] || '').trim()
                ? <span className="text-emerald-700 font-medium">Preenchido</span>
                : <span className="italic text-slate-400">Vazio</span>}
            />
          ))}
      </SummarySection>

      <SummarySection title="Workspaces" onEdit={() => onJumpToStep?.('workspaces')}>
        {mode === 'create' || !compound?.id ? (
          <p className="m-0 text-xs text-slate-500 italic">
            Vinculados após criar o relatório.
          </p>
        ) : (compound.workspaceIds || []).length === 0 ? (
          <p className="m-0 text-xs text-amber-700">Nenhum workspace vinculado.</p>
        ) : (
          <ul className="m-0 pl-5 text-sm text-slate-700">
            {(compound.workspaceIds || []).map((id) => (
              <li key={id}>{workspaceLabelsById?.get?.(id) || id}</li>
            ))}
          </ul>
        )}
      </SummarySection>

      <SummarySection title="Assinaturas" onEdit={() => onJumpToStep?.('assinaturas')}>
        <SummaryRow
          label="Elaboradores"
          value={(draft.elaboradores || []).length === 0
            ? <span className="italic text-slate-400">(nenhum)</span>
            : (draft.elaboradores || []).map((id) => sigLookup[id]?.nome || id).join(', ')}
        />
        <SummaryRow
          label="Revisores"
          value={(draft.revisores || []).length === 0
            ? <span className="italic text-slate-400">(nenhum)</span>
            : (draft.revisores || []).map((id) => sigLookup[id]?.nome || id).join(', ')}
        />
      </SummarySection>

      <SummarySection title="Fichas de erosão" onEdit={() => onJumpToStep?.('fichas')}>
        <SummaryRow
          label="Anexo"
          value={(() => {
            const mode = draft.anexoFichasMode || 'none';
            if (mode === 'none') return 'Nenhuma ficha anexada';
            if (mode === 'all') return 'Todas as erosões dos projetos vinculados';
            const count = Array.isArray(draft.anexoFichasErosionIds) ? draft.anexoFichasErosionIds.length : 0;
            return count > 0
              ? `${count} ficha(s) selecionada(s)`
              : <span className="italic text-amber-700">Selecionar ativo, mas nenhuma ficha marcada</span>;
          })()}
        />
      </SummarySection>
    </div>
  );
}

function SummarySection({ title, onEdit, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">{title}</span>
        <button
          type="button"
          className="text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          onClick={onEdit}
        >
          Editar
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-[minmax(0,120px)_1fr] items-start gap-3 text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}

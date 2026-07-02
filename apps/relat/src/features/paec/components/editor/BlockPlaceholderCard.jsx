import AppIcon from '@app/components/AppIcon';

/**
 * Card "achatado" para blocos do manifest (tabelas de brigadistas, recursos
 * materiais, anexos como rota de fuga/unifilar etc.) que ainda nao sao
 * editaveis nesta fase — ficam listados como pendencia manual fixa. Icone de
 * tabela para kind=list, icone generico de documento para kind=manual (o
 * backend nao distingue ainda quais blocos "manual" sao imagem vs. tabela de
 * texto — essa distincao fica para a fase 4/imageSlots).
 */
export default function BlockPlaceholderCard({ block }) {
  const icon = block.kind === 'list' ? 'table' : 'file-text';
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-slate-300 bg-app-surfaceMuted px-4 py-3">
      <span className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-400 shrink-0">
        <AppIcon name={icon} className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold text-slate-700 truncate">{block.label}</p>
        <p className="m-0 text-2xs text-slate-400">Edição chega em breve — ajuste direto no documento gerado por enquanto.</p>
      </div>
    </div>
  );
}

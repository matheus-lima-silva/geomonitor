import AppIcon from '@app/components/AppIcon';
import { Button, IconButton, Input } from '@app/components/ui';

function emptyRow(columns) {
  const row = {};
  columns.forEach((col) => { row[col.key] = ''; });
  return row;
}

/**
 * Bloco tabular editavel (brigadistas, recursos materiais BEM, extintores,
 * pontos de encontro etc.) — colunas dirigidas por manifest.blocks[].columns,
 * curadas uma vez por revisao do modelo. Linhas sao substituidas por inteiro
 * no save (sem id estavel por linha), mesma semantica do backend
 * (paec_plant_list_items, replace-on-save). So blocos ja com columns curadas
 * chegam aqui — os demais continuam no BlockPlaceholderCard.
 */
export default function EditableListTable({ block, rows, onChange }) {
  const columns = block.columns || [];
  const items = rows || [];
  const gridTemplate = { gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr)) 34px` };

  function updateCell(index, colKey, value) {
    onChange(block.key, items.map((row, i) => (i === index ? { ...row, [colKey]: value } : row)));
  }

  function addRow() {
    onChange(block.key, [...items, emptyRow(columns)]);
  }

  function removeRow(index) {
    onChange(block.key, items.filter((_, i) => i !== index));
  }

  return (
    <div id={`paec-block-${block.key}`} className="rounded-[10px] border border-slate-200 bg-app-surface p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <AppIcon name="table" className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="m-0 text-sm font-semibold text-slate-700 truncate">{block.label}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={addRow}>
          <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
          Adicionar linha
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="hidden sm:grid gap-2 text-2xs font-bold uppercase tracking-wide text-slate-500" style={gridTemplate}>
          {columns.map((col) => <span key={col.key}>{col.label}</span>)}
          <span />
        </div>

        {items.length === 0 ? (
          <p className="m-0 text-2xs text-slate-400 italic">Nenhuma linha ainda — clique em &quot;Adicionar linha&quot;.</p>
        ) : (
          items.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="grid gap-2 items-center" style={gridTemplate}>
              {columns.map((col) => (
                <Input
                  key={col.key}
                  aria-label={col.label}
                  value={row[col.key] || ''}
                  onChange={(e) => updateCell(index, col.key, e.target.value)}
                />
              ))}
              <IconButton
                variant="dangerGhost"
                size="sm"
                aria-label={`Remover linha ${index + 1} de ${block.label}`}
                onClick={() => removeRow(index)}
              >
                <AppIcon name="trash" className="w-4 h-4" />
              </IconButton>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

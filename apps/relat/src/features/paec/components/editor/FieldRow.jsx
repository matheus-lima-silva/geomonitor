import { Input, Textarea } from '@app/components/ui';

/**
 * Linha de campo do editor: label = o titulo-chave do manifest + input/textarea
 * (conforme field.type) com o valor. Campo vazio ganha um pontinho ambar ao
 * lado do label — sem borda de erro, e normal ter campos vazios preenchendo.
 */
export default function FieldRow({ field, value, onChange, pending }) {
  const id = `paec-field-${field.key}`;
  const isMultiline = field.type === 'multiline';
  const Control = isMultiline ? Textarea : Input;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
      <label
        htmlFor={id}
        className="sm:w-[250px] sm:pt-2 shrink-0 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-slate-500"
      >
        {pending ? (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-warning-border shrink-0"
            aria-hidden="true"
            title="Campo pendente"
          />
        ) : null}
        <span className="truncate">{field.label}</span>
      </label>
      <div className="flex-1 min-w-0">
        <Control
          id={id}
          value={value || ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          {...(isMultiline ? { rows: 2 } : {})}
        />
      </div>
    </div>
  );
}

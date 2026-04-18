import RichTextMini from '../RichTextMini';
import {
  SECTION_EXAMPLES,
  PRE_TEXT_SECTION_KEYS,
  CARACTERIZACAO_KEYS,
  POST_TEXT_SECTION_KEYS,
} from './wizardConstants';

// Step 2 — redacao dos textos tecnicos. Usa RichTextMini (Markdown leve) e
// placeholders concretos com exemplos reais em SECTION_EXAMPLES.
export default function StepTextos({ draft, onChange }) {
  function setField(key) {
    return (event) => {
      const { value } = event.target;
      onChange((prev) => ({ ...prev, [key]: value }));
    };
  }

  function renderSection(key) {
    const example = SECTION_EXAMPLES[key];
    if (!example) return null;
    return (
      <RichTextMini
        key={key}
        id={`wizard-${key}`}
        label={example.label}
        hint={example.hint}
        placeholder={example.placeholder}
        rows={6}
        value={draft[key] || ''}
        onChange={setField(key)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-info-border bg-info-light p-3 text-xs text-info-dark">
        Use <strong>**negrito**</strong> e <em>*itálico*</em> pela toolbar. Linhas começando com
        <code className="ml-1 px-1 bg-white rounded">- </code> viram itens de lista.
      </div>

      {PRE_TEXT_SECTION_KEYS.map(renderSection)}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
          2. Caracterização Técnica
        </p>
        {CARACTERIZACAO_KEYS.map(renderSection)}
      </div>

      {POST_TEXT_SECTION_KEYS.map(renderSection)}
    </div>
  );
}

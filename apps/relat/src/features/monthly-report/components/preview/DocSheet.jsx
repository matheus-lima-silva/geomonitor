import { useEffect, useMemo, useState } from 'react';
import { buildDocModel } from '../../utils/docModel';
import QuadroTable, { QuadroLegend } from './QuadroTable';

export const SHEET_WIDTH_PX = 794; // A4 @96dpi
const PREVIEW_DEBOUNCE_MS = 180;

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Block({ block }) {
  switch (block.kind) {
    case 'heading1':
      return <h1 className="font-bold" style={{ fontSize: '13pt', color: '#1F3864', margin: '16pt 0 9pt' }}>{block.text}</h1>;
    case 'heading2':
      return <h2 className="font-bold" style={{ fontSize: '12pt', color: '#2F5496', margin: '14pt 0 8pt' }}>{block.text}</h2>;
    case 'heading3':
      return <h3 className="font-bold" style={{ fontSize: '11pt', color: '#404040', margin: '12pt 0 7pt' }}>{block.text}</h3>;
    case 'paragraphs':
      return block.texts.map((t, i) => (
        <p key={i} className="text-justify" style={{ margin: '0 0 8pt', lineHeight: 1.38 }}>{t}</p>
      ));
    case 'empty':
      return <p className="italic" style={{ color: '#9aa4b2', margin: '0 0 8pt' }}>{block.text}</p>;
    case 'quadro':
      return <QuadroTable weeks={block.weeks} variant={block.quadroStyle} />;
    case 'legend':
      return <QuadroLegend />;
    case 'bullets':
      return (
        <ul style={{ margin: '0 0 8pt', paddingLeft: '18pt' }}>
          {block.items.map((item, i) => (
            <li key={i} className="text-justify" style={{ margin: '0 0 8pt', lineHeight: 1.38 }}>
              <strong>{item.name}: </strong>{item.text}
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

/**
 * Folha A4 da preview — espelha a estrutura do DOCX gerado pelo worker
 * (corpo Verdana, headings 1F3864/2F5496/404040, quadros, legenda). Nao e
 * paginada: mostra estrutura e estilos, nao quebras de pagina. Re-renderiza
 * com debounce de ~180ms a partir do estado do relatorio.
 */
export default function DocSheet({ report }) {
  const debouncedReport = useDebouncedValue(report, PREVIEW_DEBOUNCE_MS);
  const model = useMemo(() => buildDocModel(debouncedReport), [debouncedReport]);

  return (
    <div
      data-testid="doc-sheet"
      className="bg-white border border-slate-300"
      style={{
        width: SHEET_WIDTH_PX,
        minHeight: 1123,
        padding: 76,
        fontFamily: 'Verdana, Geneva, sans-serif',
        fontSize: '9.5pt',
        color: '#1a1a1a',
        boxShadow: '0 4px 18px rgba(15,23,42,.08)',
      }}
    >
      <p className="text-right m-0" style={{ fontSize: '8pt', color: '#595959' }}>{model.classification}</p>

      <div className="text-center" style={{ margin: '36pt 0 28pt' }}>
        <p className="font-bold m-0" style={{ fontSize: '14pt' }}>{model.title}</p>
        <p className="m-0" style={{ fontSize: '10pt', color: '#595959', marginTop: '6pt' }}>{model.subtitle}</p>
        <p className="font-bold m-0" style={{ fontSize: '11pt', marginTop: '14pt' }}>{model.monthLabel}</p>
        <p className="m-0" style={{ fontSize: '8.5pt', color: '#808080', marginTop: '6pt' }}>{model.periodLabel}</p>
      </div>

      {model.blocks.map((block, i) => <Block key={i} block={block} />)}
    </div>
  );
}

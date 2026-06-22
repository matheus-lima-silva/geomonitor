import { useRef } from 'react';
import AppIcon from '@app/components/AppIcon';
import { Button } from '@app/components/ui';
import DocSheet, { SHEET_WIDTH_PX } from './DocSheet';
import { usePreviewZoom } from '../../hooks/usePreviewZoom';

/**
 * Coluna de pre-visualizacao ao vivo: header com selo "AO VIVO" e controles
 * de zoom (passos de 10%, 40-160%, ajustar a largura), area rolavel com a
 * folha A4 escalada via transform.
 */
export default function PreviewColumn({ report }) {
  const scrollRef = useRef(null);
  const { zoom, zoomIn, zoomOut, fitWidth } = usePreviewZoom(scrollRef);

  return (
    <aside
      className="hidden min-[1180px]:flex flex-col bg-slate-200 border-l border-slate-300 min-h-0"
      data-testid="preview-column"
    >
      <div className="flex items-center gap-2 bg-app-surface border-b border-slate-300 px-4 py-2 shrink-0">
        <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">
          Pré-visualização do documento
        </span>
        <span className="inline-flex items-center gap-1 text-2xs font-bold uppercase text-success">
          <span className="w-[7px] h-[7px] rounded-full bg-success" aria-hidden="true" />
          Ao vivo
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={zoomOut} aria-label="Reduzir" title="Reduzir">−</Button>
          <span data-testid="zoom-value" className="font-mono text-2xs text-slate-500 w-[38px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} aria-label="Ampliar" title="Ampliar">+</Button>
          <Button variant="ghost" size="sm" onClick={fitWidth} aria-label="Ajustar à largura" title="Ajustar à largura">
            <AppIcon name="maximize" className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto px-5 py-6">
        <div
          style={{
            width: SHEET_WIDTH_PX * zoom,
            margin: '0 auto',
          }}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {report ? <DocSheet report={report} /> : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

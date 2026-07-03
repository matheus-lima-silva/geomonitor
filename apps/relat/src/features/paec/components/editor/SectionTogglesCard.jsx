import { Input } from '@app/components/ui';

/**
 * Liga/desliga por secao (Fase 3) — so as secoes do manifest que tem
 * renumberGroup (subsecoes que variam por usina, ex. os recursos internos
 * 12.1.x do REV 10); dirigido pelo manifest, nada hardcoded. Desligada:
 * a secao some do DOCX gerado e as remanescentes do grupo renumeram
 * sequencialmente (worker/paec_renderer.py). Titulo customizado e opcional
 * e so faz sentido pra secao ligada.
 */
export default function SectionTogglesCard({ sections, sectionFlags, onChange }) {
  function flagFor(sectionKey) {
    return (sectionFlags && sectionFlags[sectionKey]) || {};
  }

  function toggleEnabled(sectionKey) {
    const current = flagFor(sectionKey);
    const wasEnabled = current.enabled !== false;
    onChange(sectionKey, { ...current, enabled: !wasEnabled });
  }

  function setTitleOverride(sectionKey, value) {
    const current = flagFor(sectionKey);
    onChange(sectionKey, { ...current, titleOverride: value });
  }

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const flag = flagFor(section.sectionKey);
        const enabled = flag.enabled !== false;
        const inputId = `paec-section-toggle-${section.sectionKey}`;
        return (
          <div
            key={section.sectionKey}
            className={`flex items-start gap-3 rounded-[10px] border px-4 py-3 ${
              enabled ? 'border-slate-200 bg-app-surface' : 'border-slate-200 bg-app-surfaceMuted opacity-60'
            }`}
          >
            <label htmlFor={inputId} className="flex items-center pt-0.5 shrink-0">
              <input
                id={inputId}
                type="checkbox"
                checked={enabled}
                onChange={() => toggleEnabled(section.sectionKey)}
                aria-label={`Incluir ${section.defaultTitle} no PAEC gerado`}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </label>
            <div className="flex-1 min-w-0">
              <p className="m-0 text-sm font-medium text-slate-700">{section.defaultTitle}</p>
              {enabled ? (
                <Input
                  value={flag.titleOverride || ''}
                  placeholder="Título customizado (opcional)"
                  aria-label={`Título customizado para ${section.defaultTitle}`}
                  onChange={(e) => setTitleOverride(section.sectionKey, e.target.value)}
                  className="mt-1.5"
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import { Button } from '@app/components/ui';
import { usePaecPlant } from '../hooks/usePaecPlant';
import { useGeneratePaecDocx } from '../hooks/useGeneratePaecDocx';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { groupFieldsBySection, countFieldPendenciesBySection, sectionAnchorId } from '../utils/manifestSections';
import PaecTopbar from './topbar/PaecTopbar';
import SectionNav from './editor/SectionNav';
import SectionCard from './editor/SectionCard';
import FieldRow from './editor/FieldRow';
import BlockPlaceholderCard from './editor/BlockPlaceholderCard';
import EditableListTable from './editor/EditableListTable';
import ImageSlotsCard from './editor/ImageSlotsCard';
import SectionTogglesCard from './editor/SectionTogglesCard';
import PendenciesPanel from './PendenciesPanel';
import GenerateResultModal from './modals/GenerateResultModal';

/**
 * Editor da ficha PAEC de uma usina: formulario dirigido pelo manifest
 * (agrupado por secao), painel de pendencias fixo e fluxo de geracao do
 * .docx. Layout de 3 colunas (nav | formulario | pendencias), mesmo shell de
 * scroll interno do monthly-report.
 */
export default function PaecFichaPage({ plantId, onExit }) {
  const {
    plant, manifest, loading, error, saveStatus, conflict,
    updateField, updateListItems, updateSectionFlags, updateAssets,
    migrateTemplate, flush, reload,
  } = usePaecPlant(plantId);
  const [migrating, setMigrating] = useState(false);

  const editorRef = useRef(null);

  const sections = useMemo(() => groupFieldsBySection(manifest?.fields), [manifest]);
  const sectionIds = useMemo(
    () => sections.map(({ section }, i) => sectionAnchorId(section, i)),
    [sections],
  );
  const { activeId, scrollTo } = useScrollSpy(editorRef, sectionIds.length > 0 ? sectionIds : ['__empty__']);

  const { generating, generate, result, download, clearResult } = useGeneratePaecDocx({ plant, flush });

  const pendencies = plant?.pendencies || [];
  const pendencyCounts = useMemo(() => countFieldPendenciesBySection(pendencies), [pendencies]);
  const pendingKeys = useMemo(
    () => new Set(pendencies.filter((p) => p.kind === 'field').map((p) => p.key)),
    [pendencies],
  );
  const blocks = manifest?.blocks || [];
  const imageSlots = manifest?.imageSlots || [];
  const toggleableSections = useMemo(
    () => (manifest?.sections || []).filter((s) => s.renumberGroup),
    [manifest],
  );

  function scrollToField(fieldKey) {
    const field = (manifest?.fields || []).find((f) => f.key === fieldKey);
    if (!field) return;
    const index = sections.findIndex((g) => g.section === (field.section || 'Outros campos'));
    if (index === -1) return;
    scrollTo(sectionAnchorId(sections[index].section, index));
    requestAnimationFrame(() => {
      const input = document.getElementById(`paec-field-${fieldKey}`);
      if (input) {
        input.focus();
        input.classList.add('ring-2', 'ring-brand-400');
        setTimeout(() => input.classList.remove('ring-2', 'ring-brand-400'), 1900);
      }
    });
  }

  function scrollToBlock(blockKey) {
    scrollTo('paec-section-blocks');
    requestAnimationFrame(() => {
      document.getElementById(`paec-block-${blockKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app-bg">
      <PaecTopbar
        plantName={plant?.name || '…'}
        revisionLabel={plant?.templateRevisionLabel}
        saveStatus={saveStatus}
        onBack={onExit}
        pendencyCount={pendencies.length}
        onTogglePendencies={() => {
          document.getElementById('paec-pendencies-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onGenerate={generate}
        generating={generating}
        generateDisabled={!plant || conflict}
      />

      {conflict ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-warning-light border-b border-warning-border px-5 py-2"
        >
          <p className="m-0 text-sm text-slate-700">
            Esta ficha foi alterada em outra sessão. Recarregue para ver a versão mais recente — até lá, o formulário está em modo leitura.
          </p>
          <Button variant="outline" size="sm" onClick={() => reload()}>Recarregar</Button>
        </div>
      ) : null}

      {!conflict && plant?.activeTemplate ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 bg-info-light border-b border-info-border px-5 py-2"
        >
          <p className="m-0 text-sm text-slate-700">
            Nova revisão do modelo disponível ({plant.activeTemplate.revisionLabel}). Os valores preenchidos são
            preservados; campos novos da revisão aparecem como pendência.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={migrating}
            onClick={async () => {
              setMigrating(true);
              try {
                await migrateTemplate();
              } finally {
                setMigrating(false);
              }
            }}
          >
            {migrating ? 'Migrando…' : 'Migrar para a revisão nova'}
          </Button>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_320px] gap-6 px-6 pt-4">
        {loading ? (
          <p className="text-sm text-slate-500 col-span-full" aria-live="polite">Carregando ficha…</p>
        ) : error ? (
          <div role="alert" className="bg-danger-light border border-danger rounded-[10px] p-4 col-span-full">
            <p className="m-0 text-sm text-critical">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => reload()}>Tentar de novo</Button>
          </div>
        ) : plant ? (
          <>
            <SectionNav
              sections={sections.map(({ section }, i) => ({ id: sectionAnchorId(section, i), title: section }))}
              activeId={activeId}
              onSectionClick={scrollTo}
              pendencyCounts={pendencyCounts}
              stats={plant.stats}
            />

            <main ref={editorRef} className="overflow-y-auto pb-10 scroll-smooth min-w-0">
              <fieldset disabled={conflict} className="flex flex-col gap-5 min-w-0">
                {sections.map(({ section, fields }, i) => (
                  <SectionCard key={section} id={sectionAnchorId(section, i)} number={i + 1} title={section}>
                    {fields.map((field) => (
                      <FieldRow
                        key={field.key}
                        field={field}
                        value={plant.fields?.[field.key]}
                        onChange={updateField}
                        pending={pendingKeys.has(field.key)}
                      />
                    ))}
                  </SectionCard>
                ))}

                {toggleableSections.length > 0 ? (
                  <SectionCard id="paec-section-toggles" number={sections.length + 1} title="Seções configuráveis">
                    <SectionTogglesCard
                      sections={toggleableSections}
                      sectionFlags={plant.sectionFlags}
                      onChange={updateSectionFlags}
                    />
                  </SectionCard>
                ) : null}

                {blocks.length > 0 || imageSlots.length > 0 ? (
                  <SectionCard
                    id="paec-section-blocks"
                    number={sections.length + (toggleableSections.length > 0 ? 2 : 1)}
                    title="Tabelas e anexos"
                  >
                    {blocks.map((block) => (
                      block.kind === 'list' && (block.columns || []).length > 0 ? (
                        <EditableListTable
                          key={block.key}
                          block={block}
                          rows={plant.listItems?.[block.key]}
                          onChange={updateListItems}
                        />
                      ) : (
                        <BlockPlaceholderCard key={block.key} block={block} />
                      )
                    ))}
                    {imageSlots.map((slot) => (
                      <ImageSlotsCard
                        key={slot.assetKey}
                        slot={slot}
                        mediaIds={plant.assets?.[slot.assetKey]}
                        plantId={plant.id}
                        onChange={updateAssets}
                      />
                    ))}
                  </SectionCard>
                ) : null}
              </fieldset>
            </main>

            <div id="paec-pendencies-panel">
              <PendenciesPanel pendencies={pendencies} onFieldClick={scrollToField} onBlockClick={scrollToBlock} />
            </div>
          </>
        ) : null}
      </div>

      <GenerateResultModal result={result} onClose={clearResult} onDownload={download} />
    </div>
  );
}

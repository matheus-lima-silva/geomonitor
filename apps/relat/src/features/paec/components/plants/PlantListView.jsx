import { useState } from 'react';
import { Button, EmptyState, PageHeader } from '@app/components/ui';
import { useToast } from '@app/context/ToastContext';
import { usePaecPlants } from '../../hooks/usePaecPlants';
import PlantCard from './PlantCard';
import NewPlantModal from './NewPlantModal';

const TEMPLATE_REVISION_FALLBACK = '—';

/**
 * Tela inicial do modulo PAEC: lista de usinas (fichas ja criadas) + cadastro
 * de usina nova. Onze estados de completude vem de plant.completeness
 * (fieldsFilled/fieldsTotal), calculado server-side contra o manifest ativo.
 */
export default function PlantListView({ onOpenPlant, onExit }) {
  const { plants, loading, error, create } = usePaecPlants();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const revisionLabel = plants[0]?.templateRevisionLabel || TEMPLATE_REVISION_FALLBACK;

  async function handleCreate(data) {
    const created = await create(data);
    setModalOpen(false);
    toast.show(
      data.copyFromId ? `Ficha criada a partir de outra usina.` : 'Ficha criada.',
      'success',
    );
    onOpenPlant(created.id);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="mb-4 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          ‹ portal relat
        </button>
      ) : null}

      <PageHeader
        title="PAEC — Planos de Emergência"
        subtitle={plants.length > 0 ? `Modelo institucional: ${revisionLabel}` : undefined}
        action={
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            Nova usina
          </Button>
        }
      />

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-500" aria-live="polite">Carregando usinas…</p>
        ) : error ? (
          <div role="alert" className="bg-danger-light border border-danger rounded-[10px] p-4">
            <p className="m-0 text-sm text-critical">{error}</p>
          </div>
        ) : plants.length === 0 ? (
          <EmptyState
            icon="building"
            title="Nenhuma usina cadastrada ainda"
            description="Cadastre a primeira usina para começar a preencher o PAEC."
            action={<Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>Nova usina</Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} onOpen={onOpenPlant} />
            ))}
          </div>
        )}
      </div>

      <NewPlantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
        existingPlants={plants}
      />
    </div>
  );
}

import { useMemo } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Modal } from '../../../components/ui';
import { buildGoogleMapsMultiStopUrl, chunkRoutePoints } from '../utils/routeUtils';
import { compareTowerNumbers, validateTowerCoordinatesAsString } from '../utils/kmlUtils';

function formatTowerLabel(towerRef) {
  const ref = String(towerRef ?? '').trim();
  if (!ref) return 'Nao informado';
  if (ref === '0') return 'Portico (T0)';
  return `Torre ${ref}`;
}

function RoutePlannerModal({ project, routeSelection, setRouteSelection, onClose }) {
  const routeProjectTowers = useMemo(() => {
    if (!project) return [];
    const reviewed = validateTowerCoordinatesAsString(project.torresCoordenadas || []);
    return reviewed.rows
      .filter((r) => !r.error)
      .sort((a, b) => compareTowerNumbers(a.numero, b.numero));
  }, [project]);

  if (!project) return null;

  const selectedRoutePoints = routeSelection
    .map((num) => routeProjectTowers.find((t) => String(t.numero) === String(num)))
    .filter(Boolean);

  function toggleRouteTower(towerNumber) {
    const id = String(towerNumber);
    setRouteSelection((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  }

  function handleOpenRoute() {
    if (selectedRoutePoints.length < 2) {
      alert('Selecione pelo menos 2 torres para tracar a rota.');
      return;
    }
    const chunks = chunkRoutePoints(selectedRoutePoints, 8);
    chunks.forEach((chunk, idx) => {
      const previousChunk = idx > 0 ? chunks[idx - 1] : null;
      const previousLast = previousChunk?.[previousChunk.length - 1];
      const opts = idx > 0 && previousLast ? { origin: `${previousLast.latitude},${previousLast.longitude}` } : {};
      const url = buildGoogleMapsMultiStopUrl(chunk, opts);
      if (!url) return;
      setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), idx * 250);
    });
    if (chunks.length > 1) {
      alert(`A rota foi dividida em ${chunks.length} etapas por limite de waypoints do Google Maps.`);
    }
  }

  const footer = (
    <>
      <div className="text-sm text-slate-500 font-medium">{selectedRoutePoints.length} torre(s) selecionada(s)</div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        <Button variant="primary" onClick={handleOpenRoute}>
          <AppIcon name="route" />
          Abrir rota
        </Button>
      </div>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Traçar rota - ${project.nome || project.id}`}
      size="lg"
      footer={footer}
    >
      <p className="text-sm text-brand-800 bg-brand-50 border border-brand-100 p-3 rounded-lg mb-4">
        Selecione torres na ordem desejada. A rota será aberta no Google Maps com origem na sua localização.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {routeProjectTowers.map((tower) => {
          const active = routeSelection.includes(String(tower.numero));
          const order = routeSelection.findIndex((n) => n === String(tower.numero));
          return (
            <button
              key={`route-${tower.numero}`}
              type="button"
              className={`flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-all ${active
                  ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50'
                }`}
              onClick={() => toggleRouteTower(tower.numero)}
            >
              <span>{formatTowerLabel(tower.numero)}</span>
              {active && <strong className="text-brand-600">#{order + 1}</strong>}
            </button>
          );
        })}
      </div>

      {routeProjectTowers.length === 0 && (
        <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
          Este empreendimento não possui torres com coordenadas válidas.
        </p>
      )}
    </Modal>
  );
}

export default RoutePlannerModal;

import { useMemo } from 'react';
import { buildGoogleMapsMultiStopUrl, chunkRoutePoints } from '../utils/routeUtils';
import { validateTowerCoordinatesAsString } from '../utils/kmlUtils';

function formatTowerLabel(towerRef) {
  const ref = String(towerRef ?? '').trim();
  if (!ref) return 'Não informado';
  if (ref === '0') return 'Pórtico (T0)';
  return `Torre ${ref}`;
}

function RoutePlannerModal({ project, routeSelection, setRouteSelection, onClose }) {
  const routeProjectTowers = useMemo(() => {
    if (!project) return [];
    const reviewed = validateTowerCoordinatesAsString(project.torresCoordenadas || []);
    return reviewed.rows
      .filter((r) => !r.error)
      .sort((a, b) => Number(a.numero) - Number(b.numero));
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
      alert('Selecione pelo menos 2 torres para traçar a rota.');
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

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <h3>Traçar rota - {project.nome || project.id}</h3>
        <p className="muted">Selecione torres na ordem desejada.</p>

        <div className="tower-grid">
          {routeProjectTowers.map((tower) => {
            const active = routeSelection.includes(String(tower.numero));
            const order = routeSelection.findIndex((n) => n === String(tower.numero));
            return (
              <button
                key={`route-${tower.numero}`}
                type="button"
                className={active ? 'chip-active' : ''}
                onClick={() => toggleRouteTower(tower.numero)}
              >
                {formatTowerLabel(tower.numero)} {active ? `#${order + 1}` : ''}
              </button>
            );
          })}
        </div>

        {routeProjectTowers.length === 0 && <p className="muted">Este empreendimento não possui torres com coordenadas válidas.</p>}

        <div className="row-actions">
          <button type="button" onClick={handleOpenRoute}>Abrir rota</button>
          <button type="button" className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default RoutePlannerModal;

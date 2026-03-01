import { useMemo } from 'react';
import AppIcon from '../../../components/AppIcon';
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

  return (
    <div className="modal-backdrop">
      <div className="modal projects-modal projects-modal-route">
        <div className="projects-modal-head">
          <h3 className="projects-modal-title">Tracar rota - {project.nome || project.id}</h3>
          <button type="button" className="projects-modal-close" aria-label="Fechar" onClick={onClose}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="projects-modal-body">
          <p className="projects-route-helper">
            Selecione torres na ordem desejada. A rota sera aberta no Google Maps com origem na sua localizacao.
          </p>

          <div className="projects-route-grid">
            {routeProjectTowers.map((tower) => {
              const active = routeSelection.includes(String(tower.numero));
              const order = routeSelection.findIndex((n) => n === String(tower.numero));
              return (
                <button
                  key={`route-${tower.numero}`}
                  type="button"
                  className={`projects-route-tower-btn ${active ? 'is-active' : ''}`.trim()}
                  onClick={() => toggleRouteTower(tower.numero)}
                >
                  <span>{formatTowerLabel(tower.numero)}</span>
                  {active && <strong>#{order + 1}</strong>}
                </button>
              );
            })}
          </div>

          {routeProjectTowers.length === 0 && (
            <p className="projects-route-empty">Este empreendimento nao possui torres com coordenadas validas.</p>
          )}
        </div>

        <div className="projects-modal-foot projects-route-foot">
          <div className="projects-route-count">{selectedRoutePoints.length} torre(s) selecionada(s)</div>
          <div className="projects-route-actions">
            <button type="button" className="projects-cancel-btn" onClick={onClose}>Fechar</button>
            <button type="button" className="projects-open-route-btn" onClick={handleOpenRoute}>
              <AppIcon name="route" />
              Abrir rota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoutePlannerModal;

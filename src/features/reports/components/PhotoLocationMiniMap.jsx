import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import AppIcon from '../../../components/AppIcon';
import { formatTowerLabel } from '../../projects/utils/kmlUtils';
import { formatPhotoDistanceLabel } from '../utils/reportUtils';

// Marcadores em HTML (divIcon) para nao depender dos assets de marcador padrao
// do Leaflet: torre = quadrado escuro, foto = circulo brand. O glifo fica na
// legenda do rodape (radio-tower / camera), mantendo os pinos limpos no mapa.
const TOWER_DIV_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:5px;background:#1e293b;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,.5)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const PHOTO_DIV_ICON = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,.5)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Ajusta o viewport aos pontos disponiveis (torre/foto). invalidateSize cobre o
// caso de o mapa montar dentro de um painel que ainda estava com tamanho 0.
function FitPhotoBounds({ points }) {
  const map = useMap();
  const boundsKey = points.map((p) => p.join(',')).join('|');

  useEffect(() => {
    if (!map) return;
    if (typeof map.invalidateSize === 'function') map.invalidateSize(false);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16, { animate: false });
      return;
    }
    map.fitBounds(points, { padding: [28, 28], maxZoom: 17, animate: false });
    // boundsKey serializa as coordenadas para reagir a mudanca de foto/torre
    // sem refazer o efeito a cada render (o array `points` e novo a cada vez).
  }, [map, boundsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * Mini-mapa "Localizacao da foto" do lightbox de curadoria.
 *
 * Props:
 *   towerPoint     — [lat, lng] da torre de referencia (ou null)
 *   photoPoint     — [lat, lng] do ponto onde a foto foi tirada (ou null)
 *   towerLabel     — rotulo da torre (ex.: "606"); formatado com formatTowerLabel
 *   distanceMeters — distancia foto->torre em metros (backend PostGIS), opcional
 *
 * Degrada graciosamente: sem nenhum ponto, nao renderiza nada.
 */
export default function PhotoLocationMiniMap({
  towerPoint = null,
  photoPoint = null,
  towerLabel = '',
  distanceMeters = null,
}) {
  const points = useMemo(
    () => [towerPoint, photoPoint].filter(Boolean),
    [towerPoint, photoPoint],
  );

  if (points.length === 0) return null;

  const distanceLabel = formatPhotoDistanceLabel(distanceMeters, towerPoint, photoPoint);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div style={{ height: 152 }}>
        <MapContainer
          center={points[0]}
          zoom={16}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <FitPhotoBounds points={points} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {towerPoint && <Marker position={towerPoint} icon={TOWER_DIV_ICON} />}
          {photoPoint && <Marker position={photoPoint} icon={PHOTO_DIV_ICON} />}
          {towerPoint && photoPoint && (
            <Polyline
              positions={[towerPoint, photoPoint]}
              pathOptions={{ color: '#64748b', weight: 2, dashArray: '4 5' }}
            />
          )}
        </MapContainer>
      </div>
      <div className="flex items-center justify-between gap-2 bg-app-surface border-t border-slate-200 px-3 py-2 text-2xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="radio-tower" className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
            {towerLabel ? formatTowerLabel(towerLabel) : 'Torre'}
          </span>
          <span className="inline-flex items-center gap-1">
            <AppIcon name="camera" className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
            Foto avaliada
          </span>
        </div>
        {distanceLabel && <span className="font-mono text-slate-500">{distanceLabel}</span>}
      </div>
    </div>
  );
}

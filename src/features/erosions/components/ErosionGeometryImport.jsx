import { useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Select } from '../../../components/ui';
import { useOptionalToast } from '../../../context/ToastContext';
import { GEOMETRY_FILE_ACCEPT, parseGeometryFile } from '../utils/geometryFile';
import {
  GEOMETRY_TYPE_LABELS,
  computeGeometryMetrics,
  formatArea,
  formatMeters,
  nearestPointOnGeometry,
  representativePoint,
} from '../utils/geometryMetrics';

function describeMetrics(geometry, metrics) {
  if (!geometry) return '';
  const label = GEOMETRY_TYPE_LABELS[geometry.type] || geometry.type;
  if (geometry.type === 'LineString') return `${label} · ${formatMeters(metrics?.comprimentoMetros)}`;
  if (geometry.type === 'Polygon') return `${label} · ${formatArea(metrics?.areaM2)} · perímetro ${formatMeters(metrics?.perimetroMetros)}`;
  return label;
}

/**
 * Importa o tracado da erosao (ponto, linha ou poligono) de um KML/KMZ/GPX.
 *
 * O tracado e guardado em `geometria` (GeoJSON) + `geometriaOrigem` +
 * `geometriaMetricas`. Comprimento e ponto do tracado sao oferecidos como
 * sugestao (botoes), nunca aplicados sem o usuario pedir.
 */
export default function ErosionGeometryImport({
  geometria,
  geometriaOrigem,
  geometriaMetricas,
  towerPoint,
  towerLabel,
  showExtensionAction,
  onChange,
  onUsePoint,
  onUseExtension,
  onImported,
}) {
  const toast = useOptionalToast();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(false);

  function notify(message, type) {
    toast?.show?.(message, type);
  }

  function applyFeature(parsed, feature) {
    const metricas = computeGeometryMetrics(feature.geometry);
    onChange({
      geometria: feature.geometry,
      geometriaOrigem: {
        arquivo: parsed.fileName,
        formato: parsed.format,
        feicao: feature.name,
        importadoEm: new Date().toISOString(),
      },
      geometriaMetricas: metricas,
    });
    setPending(null);
    onImported?.(feature.geometry);
    notify(`Traçado importado: ${feature.name}.`, 'success');
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLoading(true);
    try {
      const result = await parseGeometryFile(file);
      const parsed = { ...result, fileName: file.name };
      if (parsed.features.length === 1) {
        applyFeature(parsed, parsed.features[0]);
      } else {
        // Arquivos com muitos elementos (ex.: MAPS.ME com centenas de acessos de
        // nome generico): ordena pela distancia a torre selecionada.
        const features = towerPoint
          ? parsed.features
            .map((feature) => ({
              ...feature,
              towerDistanceM: nearestPointOnGeometry(feature.geometry, [towerPoint[1], towerPoint[0]])?.distanceM,
            }))
            .sort((a, b) => (a.towerDistanceM ?? Infinity) - (b.towerDistanceM ?? Infinity))
          : parsed.features;
        setPending({ ...parsed, features, selectedId: features[0].id });
      }
    } catch (error) {
      notify(error?.message || 'Não foi possível ler o arquivo.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const nearest = geometria && towerPoint
    ? nearestPointOnGeometry(geometria, [towerPoint[1], towerPoint[0]])
    : null;
  const center = geometria ? representativePoint(geometria) : null;
  const length = geometriaMetricas?.comprimentoMetros;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-3" data-testid="erosion-geometry-import">
      <input
        ref={inputRef}
        type="file"
        accept={GEOMETRY_FILE_ACCEPT}
        className="hidden"
        onChange={handleFile}
        data-testid="erosion-geometry-file"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-700">
          <span className="font-semibold">Traçado da erosão</span>
          {geometria ? (
            <span className="text-slate-500" data-testid="erosion-geometry-summary">
              {' · '}
              {describeMetrics(geometria, geometriaMetricas)}
              {geometriaOrigem?.arquivo ? ` · ${geometriaOrigem.arquivo}` : ''}
              {geometriaOrigem?.feicao ? ` (${geometriaOrigem.feicao})` : ''}
            </span>
          ) : (
            <span className="text-slate-500"> · opcional: linha ou polígono do trecho erodido (KML, KMZ ou GPX do Google Earth, MAPS.ME etc.)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
            <AppIcon name="upload" />
            {geometria ? 'Trocar arquivo' : 'Importar KML/KMZ/GPX'}
          </Button>
          {geometria ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ geometria: null, geometriaOrigem: null, geometriaMetricas: null })}
            >
              <AppIcon name="close" />
              Remover traçado
            </Button>
          ) : null}
        </div>
      </div>

      {pending ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-0">
            <Select
              id="erosion-geometry-feature"
              label={`O arquivo tem ${pending.features.length} elementos — qual é o traçado da erosão?${towerPoint ? ' (mais perto da torre primeiro)' : ''}`}
              value={pending.selectedId}
              onChange={(e) => setPending((prev) => ({ ...prev, selectedId: e.target.value }))}
            >
              {pending.features.map((feature) => (
                <option key={feature.id} value={feature.id}>
                  {`${feature.name} — ${describeMetrics(feature.geometry, computeGeometryMetrics(feature.geometry))}`}
                  {Number.isFinite(feature.towerDistanceM) ? ` — a ${formatMeters(feature.towerDistanceM)} da torre` : ''}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => applyFeature(pending, pending.features.find((f) => f.id === pending.selectedId))}
          >
            <AppIcon name="check" />
            Usar este
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
            Cancelar
          </Button>
        </div>
      ) : null}

      {geometria ? (
        <div className="flex flex-wrap items-center gap-2">
          {nearest ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUsePoint(nearest.point[1], nearest.point[0])}
              title={`Ponto do traçado mais próximo da ${towerLabel || 'torre'} (${formatMeters(nearest.distanceM)} da torre).`}
            >
              <AppIcon name="map-pin" />
              {`Ponto do traçado mais perto da torre (${formatMeters(nearest.distanceM)})`}
            </Button>
          ) : null}
          {center && geometria.type !== 'Point' ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onUsePoint(center[1], center[0])}>
              <AppIcon name="map-pin" />
              Centro do traçado
            </Button>
          ) : null}
          {showExtensionAction && Number.isFinite(length) && length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onUseExtension(Math.round(length))}>
              <AppIcon name="route" />
              {`Usar ${formatMeters(length)} como extensão afetada`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

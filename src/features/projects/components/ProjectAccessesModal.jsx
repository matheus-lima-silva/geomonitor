import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import AppIcon from '../../../components/AppIcon';
import {
  Badge, Button, Checkbox, ConfirmDeleteModal, EmptyState, IconButton, Modal, Select,
} from '../../../components/ui';
import { useOptionalToast } from '../../../context/ToastContext';
import { GEOMETRY_FILE_ACCEPT, parseGeometryFile } from '../../erosions/utils/geometryFile';
import { compareTowerNumbers, formatTowerLabel } from '../utils/kmlUtils';
import {
  ACTION_LABELS,
  FLAG_LABELS,
  SEGMENT_STYLE,
  SEGMENT_TYPES,
  describeSegments,
  formatLength,
  repaintSegment,
  toLatLng,
} from '../utils/accessSegments';
import {
  createTowerAccesses,
  deleteTowerAccess,
  listTowerAccesses,
  previewTowerAccesses,
  updateTowerAccess,
} from '../services/towerAccessService';

const REVIEW_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'acesso', label: 'Acessos' },
  { value: 'rota_guia', label: 'Rotas-guia' },
  { value: 'ignorar', label: 'Ignorados' },
  { value: 'alertas', label: 'Com alerta' },
];
const MAX_LIST_ROWS = 300;

function FitToLines({ lines, fitKey }) {
  const map = useMap();
  const lastKey = useRef(null);
  useEffect(() => {
    if (!map || fitKey === lastKey.current) return;
    lastKey.current = fitKey;
    const points = lines.flat();
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24], maxZoom: 17, animate: false });
  }, [map, lines, fitKey]);
  return null;
}

function SegmentLines({ segments, selected, faded, onSegmentClick }) {
  return segments.map((segment, index) => (
    <Polyline
      // eslint-disable-next-line react/no-array-index-key
      key={index}
      positions={toLatLng(segment.coordinates)}
      pathOptions={{
        color: SEGMENT_STYLE[segment.tipo]?.color || SEGMENT_STYLE.acesso.color,
        weight: selected ? 7 : 4,
        opacity: faded ? 0.35 : 0.95,
        dashArray: segment.inferido ? '8 6' : undefined,
      }}
      eventHandlers={onSegmentClick ? { click: () => onSegmentClick(index) } : undefined}
    />
  ));
}

/**
 * Acessos por torre do empreendimento: importacao de KML/KMZ/GPX com previa
 * (torre sugerida + trechos asfalto/terra/acesso pelo OSM), revisao em lote e
 * repintura manual de trechos.
 */
export default function ProjectAccessesModal({ project, onClose }) {
  const toast = useOptionalToast();
  const notify = (message, type) => toast?.show?.(message, type);
  const inputRef = useRef(null);
  const [saved, setSaved] = useState([]);
  const [links, setLinks] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null); // { fileName, format, items, decisions, meta }
  const [filter, setFilter] = useState('todos');
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState({}); // accessId -> segments repintados
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fitKey, setFitKey] = useState(0);

  const projectId = project?.id;
  const towers = useMemo(() => (Array.isArray(project?.torresCoordenadas) ? project.torresCoordenadas : [])
    .map((t) => ({ numero: String(t?.numero ?? '').trim(), lat: Number(t?.latitude), lng: Number(t?.longitude) }))
    .filter((t) => t.numero && Number.isFinite(t.lat) && Number.isFinite(t.lng))
    .sort((a, b) => compareTowerNumbers(a.numero, b.numero)), [project]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setReview(null);
    setDirty({});
    listTowerAccesses(projectId)
      .then((result) => {
        if (cancelled) return;
        setSaved(result.items);
        setLinks(result.links);
        setFitKey((k) => k + 1);
      })
      .catch((error) => notify(error?.message || 'Erro ao carregar acessos.', 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!project) return null;

  const savedByTower = saved.reduce((acc, access) => {
    if (access.kind === 'acesso' && access.towerNumber) (acc[access.towerNumber] ||= []).push(access);
    return acc;
  }, {});

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseGeometryFile(file);
      const lines = parsed.features.filter((f) => f.geometry.type === 'LineString');
      if (lines.length === 0) throw new Error('O arquivo não tem linhas (só pontos ou polígonos).');
      const preview = await previewTowerAccesses(links, lines.map((f) => ({ id: f.id, name: f.name, geometry: f.geometry })), {
        arquivo: file.name, formato: parsed.format,
      });
      const decisions = {};
      preview.items.forEach((item) => {
        decisions[item.featureId] = {
          include: item.action !== 'ignorar',
          action: item.action,
          towerNumber: item.towerNumber,
          mode: 'add',
          segments: item.segments,
        };
      });
      setReview({ fileName: file.name, format: parsed.format, items: preview.items, decisions, meta: preview.meta || {} });
      setFilter('todos');
      setSelectedId(null);
      setFitKey((k) => k + 1);
      if (preview.meta && preview.meta.osmLoaded === false) {
        notify('As vias do OSM ainda não foram carregadas para esta área: todos os trechos aparecem como acesso.', 'info');
      }
    } catch (error) {
      notify(error?.message || 'Não foi possível ler o arquivo.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function patchDecision(featureId, patch) {
    setReview((prev) => ({ ...prev, decisions: { ...prev.decisions, [featureId]: { ...prev.decisions[featureId], ...patch } } }));
  }

  async function handleSaveReview() {
    const chosen = review.items.filter((item) => {
      const d = review.decisions[item.featureId];
      return d.include && d.action !== 'ignorar' && (d.action === 'rota_guia' || d.towerNumber);
    });
    if (chosen.length === 0) {
      notify('Nenhum traçado selecionado para gravar.', 'info');
      return;
    }
    const replaceIds = [];
    const items = chosen.map((item) => {
      const d = review.decisions[item.featureId];
      if (d.action === 'acesso' && d.mode === 'replace') {
        (savedByTower[d.towerNumber] || []).forEach((a) => replaceIds.push(a.id));
      }
      return {
        towerNumber: d.towerNumber || null,
        kind: d.action,
        name: item.name,
        geometry: item.geometry,
        segments: d.segments,
        source: { tipo: 'arquivo', arquivo: review.fileName, formato: review.format, feicao: item.name },
      };
    });
    setBusy(true);
    try {
      await createTowerAccesses(links, items, [...new Set(replaceIds)]);
      const result = await listTowerAccesses(projectId);
      setSaved(result.items);
      setReview(null);
      setSelectedId(null);
      setFitKey((k) => k + 1);
      notify(`${items.length} traçado(s) gravado(s).`, 'success');
    } catch (error) {
      notify(error?.message || 'Erro ao gravar os acessos.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSegments(access) {
    setBusy(true);
    try {
      const updated = await updateTowerAccess(access, { segments: dirty[access.id] });
      setSaved((prev) => prev.map((a) => (a.id === access.id ? updated : a)));
      setDirty((prev) => { const next = { ...prev }; delete next[access.id]; return next; });
      notify('Trechos atualizados.', 'success');
    } catch (error) {
      notify(error?.message || 'Erro ao salvar os trechos.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const access = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteTowerAccess(access);
      setSaved((prev) => prev.filter((a) => a.id !== access.id));
      notify('Acesso removido.', 'success');
    } catch (error) {
      notify(error?.message || 'Erro ao remover o acesso.', 'error');
    }
  }

  // ---- linhas exibidas no mapa
  const reviewRows = review
    ? review.items.filter((item) => {
      const d = review.decisions[item.featureId];
      if (filter === 'alertas') return item.flags.length > 0;
      if (filter === 'todos') return true;
      return d.action === filter;
    })
    : [];
  const mapLines = review
    ? review.items.map((item) => ({
      id: item.featureId,
      segments: review.decisions[item.featureId].segments,
      faded: !review.decisions[item.featureId].include || review.decisions[item.featureId].action === 'ignorar',
    }))
    : saved.map((access) => ({ id: access.id, segments: dirty[access.id] || access.segments, faded: false }));
  const fitLines = (selectedId ? mapLines.filter((l) => l.id === selectedId) : mapLines)
    .map((l) => l.segments.flatMap((s) => toLatLng(s.coordinates)));

  function handleSegmentClick(lineId, index) {
    if (lineId !== selectedId) {
      setSelectedId(lineId);
      return;
    }
    if (review) {
      patchDecision(lineId, { segments: repaintSegment(review.decisions[lineId].segments, index) });
    } else {
      const access = saved.find((a) => a.id === lineId);
      setDirty((prev) => ({ ...prev, [lineId]: repaintSegment(prev[lineId] || access.segments, index) }));
    }
  }

  // Linha da lista selecionavel por clique ou teclado (sem <button> cru).
  function selectableRowProps(id) {
    const select = () => { setSelectedId(id); setFitKey((k) => k + 1); };
    return {
      role: 'button',
      tabIndex: 0,
      className: 'flex-1 min-w-0 text-left cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      onClick: select,
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } },
      'aria-pressed': id === selectedId,
    };
  }

  const selectedReview = review && selectedId ? review.items.find((i) => i.featureId === selectedId) : null;
  const selectedDecision = selectedReview ? review.decisions[selectedReview.featureId] : null;
  const includedCount = review ? review.items.filter((i) => {
    const d = review.decisions[i.featureId];
    return d.include && d.action !== 'ignorar';
  }).length : 0;

  const footer = review ? (
    <>
      <Button variant="outline" onClick={() => { setReview(null); setSelectedId(null); setFitKey((k) => k + 1); }} disabled={busy}>
        Cancelar importação
      </Button>
      <Button variant="primary" onClick={handleSaveReview} disabled={busy || includedCount === 0}>
        <AppIcon name="save" />
        {`Gravar ${includedCount} selecionado(s)`}
      </Button>
    </>
  ) : (
    <Button variant="outline" onClick={onClose}>Fechar</Button>
  );

  return (
    <Modal
      open={Boolean(project)}
      onClose={onClose}
      title={`Acessos — ${project.nome || projectId}`}
      subtitle="Traçados de acesso por torre, pintados por trecho: asfalto, estrada de terra e acesso (vias públicas do OpenStreetMap)."
      icon="route"
      size="2xl"
      footer={footer}
    >
      <input ref={inputRef} type="file" accept={GEOMETRY_FILE_ACCEPT} className="hidden" onChange={handleFile} data-testid="project-accesses-file" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-3 min-w-0">
          {!review ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-600">
                {`${saved.filter((a) => a.kind === 'acesso').length} acesso(s) · ${saved.filter((a) => a.kind === 'rota_guia').length} rota(s)-guia`}
              </span>
              <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy || loading}>
                <AppIcon name="upload" />
                {busy ? 'Processando...' : 'Importar KML/KMZ/GPX'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-sm text-slate-700">
                <strong>{review.fileName}</strong>
                {` · ${review.items.length} linha(s): `}
                {Object.entries(review.meta.totals || {}).map(([action, count]) => `${count} ${ACTION_LABELS[action]?.toLowerCase() || action}`).join(', ')}
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar traçados">
                {REVIEW_FILTERS.map((f) => (
                  <Button key={f.value} size="sm" variant={filter === f.value ? 'primary' : 'ghost'} onClick={() => setFilter(f.value)}>
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedReview && selectedDecision ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 flex flex-col gap-2" data-testid="access-review-detail">
              <div className="text-sm font-semibold text-slate-800">{selectedReview.name || selectedReview.featureId}</div>
              <div className="text-xs text-slate-600">{`${formatLength(selectedReview.lengthM)} · ${describeSegments(selectedDecision.segments)}`}</div>
              <div className="grid grid-cols-2 gap-2">
                <Select id="access-review-action" label="Destino" value={selectedDecision.action} onChange={(e) => patchDecision(selectedReview.featureId, { action: e.target.value, include: e.target.value !== 'ignorar' })}>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Select id="access-review-tower" label="Torre" value={selectedDecision.towerNumber || ''} onChange={(e) => patchDecision(selectedReview.featureId, { towerNumber: e.target.value || null })}>
                  <option value="">—</option>
                  {towers.map((t) => <option key={t.numero} value={t.numero}>{formatTowerLabel(t.numero)}</option>)}
                </Select>
              </div>
              {selectedDecision.action === 'acesso' && savedByTower[selectedDecision.towerNumber]?.length ? (
                <Select id="access-review-mode" label="A torre já tem acesso cadastrado" value={selectedDecision.mode} onChange={(e) => patchDecision(selectedReview.featureId, { mode: e.target.value })}>
                  <option value="add">Adicionar como outro acesso</option>
                  <option value="replace">Substituir o existente</option>
                </Select>
              ) : null}
              <p className="text-xs text-slate-500 m-0">Clique num trecho da linha selecionada no mapa para trocar o tipo.</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1 max-h-[26rem] overflow-y-auto pr-1" data-testid="access-list">
            {loading ? <p className="text-sm text-slate-500 m-0">Carregando...</p> : null}
            {!loading && !review && saved.length === 0 ? (
              <EmptyState
                icon="route"
                title="Nenhum acesso cadastrado"
                description="Importe um KML, KMZ ou GPX (Google Earth, MAPS.ME, trilha gravada). Cada linha é ligada à torre mais próxima da ponta e pintada por trecho."
                action={<Button size="sm" variant="primary" onClick={() => inputRef.current?.click()}><AppIcon name="upload" />Importar arquivo</Button>}
              />
            ) : null}

            {review ? reviewRows.slice(0, MAX_LIST_ROWS).map((item) => {
              const d = review.decisions[item.featureId];
              const isSelected = item.featureId === selectedId;
              return (
                <div
                  key={item.featureId}
                  className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-sm ${isSelected ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <Checkbox
                    className="mt-1"
                    aria-label={`Incluir ${item.name || item.featureId}`}
                    checked={d.include && d.action !== 'ignorar'}
                    disabled={d.action === 'ignorar'}
                    onChange={(e) => patchDecision(item.featureId, { include: e.target.checked })}
                  />
                  <div {...selectableRowProps(item.featureId)}>
                    <div className="truncate font-medium text-slate-800">
                      {d.action === 'acesso' && d.towerNumber ? `${formatTowerLabel(d.towerNumber)} · ` : ''}
                      {item.name || item.featureId}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {`${ACTION_LABELS[d.action]} · ${formatLength(item.lengthM)} · ${describeSegments(d.segments)}`}
                    </div>
                    {item.flags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.flags.map((flag) => <Badge key={flag} tone="warning">{FLAG_LABELS[flag] || flag}</Badge>)}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }) : null}
            {review && reviewRows.length > MAX_LIST_ROWS ? (
              <p className="text-xs text-slate-500 m-0">{`Mostrando ${MAX_LIST_ROWS} de ${reviewRows.length}. Use os filtros para ver os demais.`}</p>
            ) : null}

            {!review ? saved.map((access) => (
              <div key={access.id} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-sm ${access.id === selectedId ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                <div {...selectableRowProps(access.id)}>
                  <div className="truncate font-medium text-slate-800">
                    {access.kind === 'acesso' ? `${formatTowerLabel(access.towerNumber)} · ` : 'Rota-guia · '}
                    {access.name || access.id}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{`${formatLength(access.lengthM)} · ${describeSegments(dirty[access.id] || access.segments)}`}</div>
                </div>
                {dirty[access.id] ? (
                  <Button size="sm" variant="primary" onClick={() => handleSaveSegments(access)} disabled={busy}>Salvar trechos</Button>
                ) : null}
                <IconButton variant="dangerGhost" size="sm" aria-label={`Remover ${access.name || access.id}`} onClick={() => setConfirmDelete(access)}>
                  <AppIcon name="trash" />
                </IconButton>
              </div>
            )) : null}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-2">
          <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ height: 460 }}>
            <MapContainer center={towers[0] ? [towers[0].lat, towers[0].lng] : [-15.79, -47.88]} zoom={12} maxZoom={19} preferCanvas scrollWheelZoom style={{ width: '100%', height: '100%' }}>
              <FitToLines lines={fitLines} fitKey={`${fitKey}-${selectedId || ''}`} />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satélite">
                  <TileLayer attribution="Imagens: Esri, Maxar, Earthstar Geographics | Vias: &copy; OpenStreetMap contributors" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} maxNativeZoom={18} />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Mapa (OSM)">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
                </LayersControl.BaseLayer>
              </LayersControl>
              {towers.map((t) => (
                <CircleMarker key={t.numero} center={[t.lat, t.lng]} radius={3} pathOptions={{ color: '#0f172a', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 1 }}>
                  <Popup>{formatTowerLabel(t.numero)}</Popup>
                </CircleMarker>
              ))}
              {mapLines.map((line) => (
                <SegmentLines
                  key={line.id}
                  segments={line.segments}
                  selected={line.id === selectedId}
                  faded={line.faded || (selectedId && line.id !== selectedId)}
                  onSegmentClick={(index) => handleSegmentClick(line.id, index)}
                />
              ))}
            </MapContainer>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {SEGMENT_TYPES.map((tipo) => (
              <span key={tipo} className="flex items-center gap-1.5">
                <span className={`inline-block w-5 h-1.5 rounded ${SEGMENT_STYLE[tipo].swatch}`} />
                {SEGMENT_STYLE[tipo].label}
              </span>
            ))}
            <span>Tracejado = tipo inferido</span>
            <span>Clique numa linha para selecionar; de novo num trecho para trocar o tipo.</span>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        open={Boolean(confirmDelete)}
        itemName="o acesso"
        itemId={confirmDelete?.name || confirmDelete?.id}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Modal>
  );
}

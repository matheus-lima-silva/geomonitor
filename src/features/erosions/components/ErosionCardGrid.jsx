import AppIcon from '../../../components/AppIcon';
import { Badge, IconButton } from '../../../components/ui';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import {
  getLocalContextLabel,
  isHistoricalErosionRecord,
  normalizeErosionTechnicalFields,
} from '../../shared/viewUtils';
import {
  getCriticalityClass,
  resolveErosionCriticality,
} from '../../../../shared/erosionHelpers';

function getImpactTone(impact) {
  if (impact === 'Muito Alto') return 'critical';
  if (impact === 'Alto') return 'danger';
  if (impact === 'Medio' || impact === 'Médio') return 'warning';
  return 'ok';
}

function ErosionCardGrid({
  erosions = [],
  projects = [],
  onOpenDetails,
  onOpenEdit,
  onRequestDelete,
  onOpenMaps,
  hasCoordinates,
}) {
  const projectsById = new Map((projects || []).map((item) => [String(item?.id || '').trim(), item]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {erosions.map((erosion) => {
        const projectId = String(erosion?.projetoId || '').trim();
        const project = projectsById.get(projectId);
        const normalizedStatus = normalizeErosionStatus(erosion.status);
        const isHistoricalRecord = isHistoricalErosionRecord(erosion);
        const technical = normalizeErosionTechnicalFields(erosion || {});
        const localContexto = technical.localContexto || {};
        const localLabel = getLocalContextLabel(localContexto.localTipo) || '-';
        return (
          <article
            key={erosion.id}
            className="group flex flex-col bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden cursor-pointer transition-all hover:border-brand-400 hover:shadow-modal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            role="button"
            tabIndex={0}
            aria-label={`Abrir detalhes de ${erosion.id || 'erosao'}`}
            onClick={() => onOpenDetails(erosion)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenDetails(erosion); } }}
          >
            <div className="flex flex-col gap-3 p-5 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800 m-0 truncate group-hover:text-brand-700 transition-colors">{erosion.id || '-'}</h3>
                <span className={erosionStatusClass(erosion.status)}>
                  {normalizedStatus}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral" size="sm">{projectId || '-'}</Badge>
                {String(erosion?.torreRef || '').trim() ? (
                  <Badge tone="neutral" size="sm">{`Torre ${erosion.torreRef}`}</Badge>
                ) : null}
                {isHistoricalRecord ? (
                  <Badge tone="warning" size="sm">Histórico</Badge>
                ) : null}
                <Badge tone={getImpactTone(getCriticalityClass(resolveErosionCriticality(erosion), erosion.impacto))} size="sm">
                  {getCriticalityClass(resolveErosionCriticality(erosion), erosion.impacto) || 'Não calculado'}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 p-5 pt-4 flex-1">
              {project?.nome ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Empreendimento</span>
                  <strong className="font-medium text-slate-800 text-right">{project.nome}</strong>
                </div>
              ) : null}
              <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                <span>Tipo</span>
                <strong className="font-medium text-slate-800 text-right">{erosion.tipo || '-'}</strong>
              </div>
              <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                <span>Grau erosivo</span>
                <strong className="font-medium text-slate-800 text-right">{erosion.estagio || '-'}</strong>
              </div>
              <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                <span>Local</span>
                <strong className="font-medium text-slate-800 text-right">{localLabel}</strong>
              </div>
              {isHistoricalRecord ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Registro</span>
                  <strong className="font-medium text-amber-700 text-right">Histórico de acompanhamento</strong>
                </div>
              ) : null}
              {isHistoricalRecord ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Intervenção</span>
                  <strong className="font-medium text-slate-800 text-right">{erosion.intervencaoRealizada || erosion.intervencao || '-'}</strong>
                </div>
              ) : null}
              {localContexto.localTipo === 'outros' ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Detalhe local</span>
                  <strong className="font-medium text-slate-800 text-right">{localContexto.localDescricao || '-'}</strong>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50 mt-auto">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                Ver detalhes
                <AppIcon name="chevron-right" className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                {hasCoordinates(erosion) ? (
                  <IconButton variant="ghost" size="sm" aria-label={`Navegar ate ${erosion.id || 'erosao'}`} onClick={() => onOpenMaps(erosion)}>
                    <AppIcon name="map" />
                  </IconButton>
                ) : null}
                <IconButton variant="ghost" size="sm" aria-label={`Editar ${erosion.id || 'erosao'}`} onClick={() => onOpenEdit(erosion)}>
                  <AppIcon name="edit" />
                </IconButton>
                <IconButton variant="dangerGhost" size="sm" aria-label={`Excluir ${erosion.id || 'erosao'}`} onClick={() => onRequestDelete(erosion)}>
                  <AppIcon name="trash" />
                </IconButton>
              </div>
            </div>
          </article>
        );
      })}

      {erosions.length === 0 ? (
        <article className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center">
          <p className="text-slate-500 italic m-0">Nenhuma erosão encontrada.</p>
        </article>
      ) : null}
    </div>
  );
}

export default ErosionCardGrid;

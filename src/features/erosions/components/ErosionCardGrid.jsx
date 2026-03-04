import AppIcon from '../../../components/AppIcon';
import { Badge, Button } from '../../../components/ui';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import { getLocalContextLabel, normalizeErosionTechnicalFields } from '../../shared/viewUtils';

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
    <div className="erosions-card-grid">
      {erosions.map((erosion) => {
        const projectId = String(erosion?.projetoId || '').trim();
        const project = projectsById.get(projectId);
        const normalizedStatus = normalizeErosionStatus(erosion.status);
        const technical = normalizeErosionTechnicalFields(erosion || {});
        const localContexto = technical.localContexto || {};
        const localLabel = getLocalContextLabel(localContexto.localTipo) || '-';
        return (
          <article key={erosion.id} className="erosions-card">
            <div className="erosions-card-head">
              <div className="erosions-card-id-row">
                <h3>{erosion.id || '-'}</h3>
                <span className={erosionStatusClass(erosion.status)}>
                  {normalizedStatus}
                </span>
              </div>
              <div className="erosions-card-chips">
                <Badge tone="neutral" size="sm">{projectId || '-'}</Badge>
                {String(erosion?.torreRef || '').trim() ? (
                  <Badge tone="neutral" size="sm">{`Torre ${erosion.torreRef}`}</Badge>
                ) : null}
                <Badge tone={getImpactTone(erosion.impacto)} size="sm">
                  {erosion.impacto || 'Não informado'}
                </Badge>
              </div>
            </div>

            <div className="erosions-card-meta">
              {project?.nome ? (
                <div className="erosions-card-meta-row">
                  <span>Empreendimento</span>
                  <strong>{project.nome}</strong>
                </div>
              ) : null}
              <div className="erosions-card-meta-row">
                <span>Tipo</span>
                <strong>{erosion.tipo || '-'}</strong>
              </div>
              <div className="erosions-card-meta-row">
                <span>Estágio</span>
                <strong>{erosion.estagio || '-'}</strong>
              </div>
              <div className="erosions-card-meta-row">
                <span>Local</span>
                <strong>{localLabel}</strong>
              </div>
              {localContexto.localTipo === 'outros' ? (
                <div className="erosions-card-meta-row">
                  <span>Detalhe local</span>
                  <strong>{localContexto.localDescricao || '-'}</strong>
                </div>
              ) : null}
            </div>

            <div className="erosions-card-actions">
              <Button variant="outline" size="sm" onClick={() => onOpenDetails(erosion)}>
                <AppIcon name="details" />
                Detalhes
              </Button>
              {hasCoordinates(erosion) ? (
                <Button variant="primary" size="sm" onClick={() => onOpenMaps(erosion)}>
                  <AppIcon name="map" />
                  Navegar
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => onOpenEdit(erosion)}>
                <AppIcon name="edit" />
                Editar
              </Button>
              <Button variant="danger" size="sm" onClick={() => onRequestDelete(erosion)}>
                <AppIcon name="trash" />
                Excluir
              </Button>
            </div>
          </article>
        );
      })}

      {erosions.length === 0 ? (
        <article className="erosions-card erosions-card-empty">
          <p className="muted">Nenhuma erosão encontrada.</p>
        </article>
      ) : null}
    </div>
  );
}

export default ErosionCardGrid;

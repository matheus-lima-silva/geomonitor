import AppIcon from '@app/components/AppIcon';
import { Badge, Button, Card } from '@app/components/ui';

const TYPE_LABELS = {
  UHE: 'UHE',
  PCH: 'PCH',
  CGH: 'CGH',
  Subestacao: 'Subestação',
};

/**
 * Card de usina na lista do modulo PAEC: tipo, completude de campos de texto
 * (fieldsFilled/fieldsTotal do manifest — os blocos de tabela/anexo, sempre
 * pendentes nesta fase, nao entram nessa conta) e acao de abrir a ficha.
 */
export default function PlantCard({ plant, onOpen }) {
  const { fieldsFilled = 0, fieldsTotal = 0 } = plant.completeness || {};
  const complete = fieldsTotal > 0 && fieldsFilled >= fieldsTotal;
  const pendingCount = Math.max(fieldsTotal - fieldsFilled, 0);
  const percent = fieldsTotal > 0 ? Math.round((fieldsFilled / fieldsTotal) * 100) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2">
        {plant.plantType ? (
          <Badge tone="neutral">{TYPE_LABELS[plant.plantType] || plant.plantType}</Badge>
        ) : <span />}
        {complete ? (
          <Badge tone="ok">
            <AppIcon name="check" className="w-3 h-3 mr-1" />
            Completo
          </Badge>
        ) : (
          <Badge tone="warning" title="Campos de texto pendentes (não conta blocos de tabela/anexo)">
            {pendingCount} {pendingCount === 1 ? 'pendência' : 'pendências'}
          </Badge>
        )}
      </div>

      <h3 className="text-md font-bold text-slate-800 m-0 truncate" title={plant.name}>{plant.name}</h3>
      {plant.installedCapacityMw != null ? (
        <p className="m-0 mt-0.5 text-xs text-slate-500">{plant.installedCapacityMw} MW instalados</p>
      ) : null}

      <div className="mt-3">
        <p className="m-0 mb-1 text-xs text-slate-500">{fieldsFilled} / {fieldsTotal} campos preenchidos</p>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${complete ? 'bg-success' : 'bg-brand-600'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {plant.templateRevisionLabel ? (
        <p className="m-0 mt-2 text-2xs text-slate-400">Modelo: {plant.templateRevisionLabel}</p>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3"
        onClick={() => onOpen(plant.id)}
      >
        Abrir ficha
      </Button>
    </Card>
  );
}

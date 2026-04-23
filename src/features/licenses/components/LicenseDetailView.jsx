import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Tabs } from '../../../components/ui';
import {
  buildLicenseChips,
  buildLicenseSubtitle,
  buildLicenseTitle,
} from '../utils/licenseCardFormat';
import LicenseConditionsSection from './LicenseConditionsSection';
import LicenseFilesSection from './LicenseFilesSection';
import { MONTH_OPTIONS_PT } from '../../projects/utils/reportSchedule';

function ResumoTab({ license, projectsById }) {
  const cobertura = Array.isArray(license?.cobertura) ? license.cobertura : [];
  const meses = Array.isArray(license?.mesesEntregaRelatorio) ? license.mesesEntregaRelatorio : [];
  const mesesLabel = meses
    .map((m) => MONTH_OPTIONS_PT.find((o) => o.value === Number(m))?.label || String(m))
    .join(', ');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-800 m-0 mb-2">Identificação</h4>
        <dl className="text-sm text-slate-700 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-slate-500">Número</dt><dd>{license.numero || '-'}</dd>
          <dt className="text-slate-500">Órgão</dt><dd>{license.orgaoAmbiental || '-'}</dd>
          <dt className="text-slate-500">Esfera</dt><dd>{license.esfera || '-'}</dd>
          {license.esfera === 'Estadual' && (<><dt className="text-slate-500">UF</dt><dd>{license.uf || '-'}</dd></>)}
          <dt className="text-slate-500">Código interno</dt><dd>{license.id}</dd>
          {license.descricao && (<><dt className="text-slate-500">Descrição</dt><dd>{license.descricao}</dd></>)}
        </dl>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-800 m-0 mb-2">Vigência & cronograma</h4>
        <dl className="text-sm text-slate-700 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-slate-500">Início</dt><dd>{license.inicioVigencia || '-'}</dd>
          <dt className="text-slate-500">Fim</dt><dd>{license.fimVigencia || 'Indeterminada'}</dd>
          <dt className="text-slate-500">Status</dt><dd>{license.status || 'ativa'}</dd>
          <dt className="text-slate-500">Periodicidade</dt><dd>{license.periodicidadeRelatorio || '-'}</dd>
          {mesesLabel && (<><dt className="text-slate-500">Meses de entrega</dt><dd>{mesesLabel}</dd></>)}
          {license.anoBaseBienal && (<><dt className="text-slate-500">Ano base (bienal)</dt><dd>{license.anoBaseBienal}</dd></>)}
        </dl>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4 md:col-span-2">
        <h4 className="text-sm font-bold text-slate-800 m-0 mb-2">
          Cobertura ({cobertura.length} escopo{cobertura.length === 1 ? '' : 's'})
        </h4>
        {cobertura.length === 0 ? (
          <p className="text-sm text-slate-500 m-0">Sem coberturas cadastradas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cobertura.map((cob, idx) => {
              const proj = projectsById?.get?.(cob.projetoId);
              const nome = proj ? `${proj.id} — ${proj.nome}` : cob.projetoId;
              const torreCount = (cob.torres || []).length;
              return (
                <li key={idx} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-b-0">
                  <span className="text-sm text-slate-800 truncate" title={nome}>{nome}</span>
                  <span className="text-xs text-slate-500 tabular-nums">{torreCount} torres</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {license.observacoes && (
        <section className="bg-white rounded-lg border border-slate-200 p-4 md:col-span-2">
          <h4 className="text-sm font-bold text-slate-800 m-0 mb-2">Observações</h4>
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans m-0">{license.observacoes}</pre>
        </section>
      )}
    </div>
  );
}

function HistoricoTab({ license }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <dl className="text-sm text-slate-700 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-500">Criada em</dt><dd>{license.createdAt || '-'}</dd>
        <dt className="text-slate-500">Última atualização</dt><dd>{license.updatedAt || '-'}</dd>
        <dt className="text-slate-500">Atualizada por</dt><dd>{license.updatedBy || '-'}</dd>
      </dl>
      <p className="text-xs text-slate-500 mt-3 m-0">
        Histórico detalhado de alterações virá em iteração futura.
      </p>
    </div>
  );
}

export default function LicenseDetailView({
  license,
  projectsById,
  onBack,
  onEdit,
  onDelete,
  showToast,
}) {
  const [tab, setTab] = useState('resumo');

  const title = buildLicenseTitle(license);
  const subtitle = buildLicenseSubtitle(license);
  const chips = buildLicenseChips(license);

  const tabs = useMemo(() => [
    { key: 'resumo', label: 'Resumo' },
    { key: 'condicionantes', label: 'Condicionantes' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'historico', label: 'Histórico' },
  ], []);

  return (
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-screen-2xl w-full">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
            <AppIcon name="chevron-left" />
            Voltar para a lista
          </Button>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 m-0 truncate" title={title}>{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 m-0">{subtitle}</p>}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {chips.map((c, i) => <Badge key={i} tone={c.tone}>{c.label}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onEdit?.(license)}>
            <AppIcon name="edit" />
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete?.(license)}>
            <AppIcon name="trash" />
            Excluir
          </Button>
        </div>
      </header>

      <Tabs items={tabs} activeKey={tab} onChange={setTab} ariaLabel="Seções do detalhe da licença" />

      <div>
        {tab === 'resumo' && <ResumoTab license={license} projectsById={projectsById} />}
        {tab === 'condicionantes' && (
          <LicenseConditionsSection licenseId={license.id} showToast={showToast} />
        )}
        {tab === 'documentos' && (
          <LicenseFilesSection licenseId={license.id} showToast={showToast} />
        )}
        {tab === 'historico' && <HistoricoTab license={license} />}
      </div>
    </section>
  );
}

import { useMemo } from 'react';
import {
  EROSION_TECHNICAL_OPTIONS,
  LOCAL_CONTEXTO_TIPO_OPTIONS,
  deriveErosionTypeFromTechnicalFields,
  deriveCriticalityDimensionClasses,
  normalizeLocalContexto,
} from '../../shared/viewUtils';

import HintText from '../../../components/ui/HintText';

function FieldLabel({ label, hint }) {
  return (
    <span className="flex items-start gap-2 text-sm font-semibold leading-snug text-slate-700">
      <span className="min-w-0">{label}</span>
      {hint ? <HintText label={label}>{hint}</HintText> : null}
    </span>
  );
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

const RANGE_TO_VALUE = {
  profundidade: {
    P1: 0.75,
    P2: 5.5,
    P3: 20,
    P4: 40,
  },
  declividade: {
    D1: 5,
    D2: 17.5,
    D3: 35,
    D4: 50,
  },
  exposicao: {
    E1: 60,
    E2: 35,
    E3: 12,
    E4: 3,
  },
};

const FIELD_HINTS = {
  localTipo: 'Identifique onde a erosao esta em relacao a linha de transmissao.',
  tipoFeicao: 'Selecione o tipo predominante. Para multiplas erosoes na mesma torre, cadastre cada uma separadamente.',
  profundidade: 'Medir da borda superior ate o fundo da erosao. Para laminar, usar <= 1 m.',
  declividade: 'Inclinacao do terreno no local da erosao em graus. Usar clinometro ou app de celular.',
  tipoSolo: 'Lateritico: solo avermelhado resistente. Argiloso: pegajoso quando umido. Solos rasos: pouca espessura sobre rocha. Arenoso: granular, sem coesao.',
  distanciaPadrao: 'Medir da borda mais proxima da erosao ate a estrutura (torre, fundacao).',
  distanciaViaTalude: 'Medir da borda da erosao ate a borda da plataforma da via.',
  distanciaViaLeito: 'Erosao no leito da via: distancia zero.',
  presencaAguaFundo: 'Verificar se ha acumulo de agua ou nascente no fundo da erosao.',
  saturacaoPorAgua: 'Solo encharcado ao redor da erosao, indicando lencol freatico alto ou drenagem deficiente.',
  sinaisAvanco: 'Trincas de tensao na borda, material solto recente, ausencia de vegetacao nas paredes e marcas de escorrimento.',
  vegetacaoInterior: 'Presenca de vegetacao estabelecida dentro da erosao indica tendencia de estabilizacao.',
  posicaoRelativaVia: 'Leito: erosao na superficie da via. Talude montante: encosta acima. Talude jusante: encosta abaixo. Margem lateral: borda da plataforma.',
  tipoImpactoVia: 'Descreva como a erosao afeta a via: soterramento, cedimento, ruptura da plataforma ou obstrucao de drenagem.',
  grauObstrucao: 'Sem obstrucao: via livre. Parcial: passagem reduzida. Total: via intransitavel.',
  estadoVia: 'Pavimentada: asfalto ou concreto. Cascalho: revestimento primario. Terra: sem revestimento.',
  extensaoAfetadaMetros: 'Comprimento da via afetado pela erosao, em metros.',
  larguraComprometidaMetros: 'Largura da plataforma da via comprometida, em metros.',
  possibilidadeDesvio: 'Se ha espaco para desviar do trecho afetado sem sair da via.',
  rotaAlternativaDisponivel: 'Se existe outra via de acesso ate a torre ou estrutura.',
};

function getDistanceHint(localTipo, posicaoRelativaVia) {
  if (localTipo === 'via_acesso_exclusiva' && posicaoRelativaVia === 'leito') {
    return FIELD_HINTS.distanciaViaLeito;
  }
  if (localTipo === 'via_acesso_exclusiva') {
    return FIELD_HINTS.distanciaViaTalude;
  }
  return FIELD_HINTS.distanciaPadrao;
}

function ErosionTechnicalFields({
  formData = {},
  onPatch,
  readOnlyClasses,
  validationErrors = {},
  isHistoricalRecord = false,
}) {
  const tiposFeicao = normalizeArray(formData.tiposFeicao);
  const usosSolo = normalizeArray(formData.usosSolo);
  const impactoVia = formData.impactoVia && typeof formData.impactoVia === 'object' ? formData.impactoVia : {};

  const classes = useMemo(
    () => readOnlyClasses || deriveCriticalityDimensionClasses(formData),
    [formData, readOnlyClasses],
  );

  const localContexto = useMemo(
    () => normalizeLocalContexto(formData),
    [formData],
  );

  function patch(nextPatch) {
    if (!onPatch || typeof onPatch !== 'function') return;
    onPatch(nextPatch);
  }

  function updateField(field, value) {
    patch({ [field]: value });
  }

  function updateSingleSelectArrayField(field, value) {
    patch({ [field]: value ? [value] : [] });
  }

  function updateLocalContext(nextPatch) {
    const merged = normalizeLocalContexto({
      ...(formData || {}),
      localContexto: {
        ...(localContexto || {}),
        ...(nextPatch || {}),
      },
    });
    patch({ localContexto: merged });
  }

  function updateDepthRange(rangeCode) {
    const numeric = RANGE_TO_VALUE.profundidade[rangeCode];
    updateField('profundidadeMetros', Number.isFinite(numeric) ? numeric : '');
  }

  function updateSlopeRange(rangeCode) {
    const numeric = RANGE_TO_VALUE.declividade[rangeCode];
    updateField('declividadeGraus', Number.isFinite(numeric) ? numeric : '');
  }

  function updateImpactoVia(field, value) {
    patch({ impactoVia: { ...impactoVia, [field]: value } });
  }

  function updateExposureRange(rangeCode) {
    const numeric = RANGE_TO_VALUE.exposicao[rangeCode];
    updateField('distanciaEstruturaMetros', Number.isFinite(numeric) ? numeric : '');
  }

  function parseNumeric(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim().replace(',', '.');
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function deriveDepthRange(value) {
    if (!Number.isFinite(value)) return '';
    if (value <= 1) return 'P1';
    if (value <= 10) return 'P2';
    if (value <= 30) return 'P3';
    return 'P4';
  }

  function deriveSlopeRange(value) {
    if (!Number.isFinite(value)) return '';
    if (value < 10) return 'D1';
    if (value <= 25) return 'D2';
    if (value <= 45) return 'D3';
    return 'D4';
  }

  function deriveExposureRange(value) {
    if (!Number.isFinite(value)) return '';
    if (value > 50) return 'E1';
    if (value >= 20) return 'E2';
    if (value >= 5) return 'E3';
    return 'E4';
  }

  const selectedDepthRange = deriveDepthRange(parseNumeric(formData.profundidadeMetros)) || classes.profundidadeClasse || '';
  const selectedSlopeRange = deriveSlopeRange(parseNumeric(formData.declividadeGraus))
    || classes.declividadeClasse || '';
  const selectedExposureRange = deriveExposureRange(parseNumeric(formData.distanciaEstruturaMetros)) || classes.exposicaoClasse || '';

  const localTipo = localContexto.localTipo || '';
  const showLocalDescricao = localTipo === 'outros';
  const showExposicaoSelect = localTipo === 'outros';
  const showEstruturaSelect = ['faixa_servidao', 'fora_faixa_servidao', 'outros'].includes(localTipo);
  const lockEstruturaValue = localTipo === 'via_acesso_exclusiva' || localTipo === 'base_torre';
  const selectedTipoFeicao = tiposFeicao.length <= 1
    ? (tiposFeicao[0] || '')
    : deriveErosionTypeFromTechnicalFields({ tiposFeicao });
  const tipoFeicaoLegacyHint = tiposFeicao.length > 1
    ? 'Registro legado com multiplas feicoes detectadas. Para edicao, o formulario exibe o tipo predominante.'
    : '';
  const tipoFeicaoHint = [FIELD_HINTS.tipoFeicao, tipoFeicaoLegacyHint].filter(Boolean).join(' ');
  const distanceHint = getDistanceHint(localTipo, impactoVia.posicaoRelativaVia);

  function toggleMultiField(field, optionValue, checked) {
    const source = normalizeArray(formData[field]);
    const nextSet = new Set(source.map((item) => String(item || '').trim()).filter(Boolean));
    if (checked) {
      nextSet.add(optionValue);
    } else {
      nextSet.delete(optionValue);
    }
    const nextPatch = {
      [field]: [...nextSet],
    };
    if (field === 'usosSolo' && !nextSet.has('outro')) {
      nextPatch.usoSoloOutro = '';
    }
    patch(nextPatch);
  }

  function fieldClass(errorKey) {
    return `w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${validationErrors[errorKey] ? 'border-danger ring-1 ring-danger' : 'border-slate-300'}`;
  }

  function readOnlyFieldClass(errorKey) {
    return `w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm disabled:text-slate-500 ${validationErrors[errorKey] ? 'border-danger ring-1 ring-danger text-danger' : 'border-slate-300 text-slate-500'}`;
  }

  return (
    <>
      <div className={`rounded-xl border px-4 py-3 text-sm ${isHistoricalRecord ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        {isHistoricalRecord
          ? 'Registro historico ativo: a caracterizacao tecnica e a criticidade ficam opcionais. Use este modo quando a intervencao ja foi executada e o cadastro serve apenas para acompanhamento do empreendimento.'
          : 'Caracterizacao tecnica obrigatoria para calcular criticidade e orientar a frequencia de acompanhamento.'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <label className="flex flex-col gap-1.5">
          <FieldLabel
            label={`Local da erosão${isHistoricalRecord ? '' : ' *'}`}
            hint={FIELD_HINTS.localTipo}
          />
          <select
            className={fieldClass('localContexto.localTipo')}
            value={localTipo}
            onChange={(e) => updateLocalContext({ localTipo: e.target.value })}
          >
            <option value="">Selecione...</option>
            {LOCAL_CONTEXTO_TIPO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {validationErrors['localContexto.localTipo'] ? (
            <span className="text-2xs font-medium text-danger">{validationErrors['localContexto.localTipo']}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Detalhe do local{showLocalDescricao && !isHistoricalRecord ? ' *' : ''}</span>
          <input
            className={fieldClass('localContexto.localDescricao')}
            value={showLocalDescricao ? (localContexto.localDescricao || '') : '-'}
            onChange={(e) => updateLocalContext({ localDescricao: e.target.value })}
            disabled={!showLocalDescricao}
            placeholder={showLocalDescricao ? 'Obrigatório para Outros' : 'Não se aplica'}
          />
          {validationErrors['localContexto.localDescricao'] ? (
            <span className="text-2xs font-medium text-danger">{validationErrors['localContexto.localDescricao']}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Localização de exposição{showExposicaoSelect && !isHistoricalRecord ? ' *' : ''}</span>
          {showExposicaoSelect ? (
            <select
              className={fieldClass('localContexto.exposicao')}
              value={localContexto.exposicao || ''}
              onChange={(e) => updateLocalContext({ exposicao: e.target.value })}
            >
              <option value="">Selecione...</option>
              {EROSION_TECHNICAL_OPTIONS.localizacaoExposicao.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input className={readOnlyFieldClass('localContexto.exposicao')} value={localContexto.exposicao || '-'} readOnly disabled />
          )}
          {validationErrors['localContexto.exposicao'] ? (
            <span className="text-2xs font-medium text-danger">{validationErrors['localContexto.exposicao']}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Estrutura próxima{(showEstruturaSelect || lockEstruturaValue) && !isHistoricalRecord ? ' *' : ''}</span>
          {(showEstruturaSelect || lockEstruturaValue) ? (
            <select
              className={fieldClass('localContexto.estruturaProxima')}
              value={localContexto.estruturaProxima || ''}
              onChange={(e) => updateLocalContext({ estruturaProxima: e.target.value })}
              disabled={lockEstruturaValue}
            >
              <option value="">Selecione...</option>
              {EROSION_TECHNICAL_OPTIONS.estruturaProxima.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input className={readOnlyFieldClass('localContexto.estruturaProxima')} value={localContexto.estruturaProxima || '-'} readOnly disabled />
          )}
          {validationErrors['localContexto.estruturaProxima'] ? (
            <span className="text-2xs font-medium text-danger">{validationErrors['localContexto.estruturaProxima']}</span>
          ) : null}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Profundidade" hint={FIELD_HINTS.profundidade} />
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={selectedDepthRange} onChange={(e) => updateDepthRange(e.target.value)}>
            <option value="">Não informado</option>
            <option value="P1">&lt;= 1 m</option>
            <option value="P2">1 a 10 m</option>
            <option value="P3">10 a 30 m</option>
            <option value="P4">&gt; 30 m</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Declividade" hint={FIELD_HINTS.declividade} />
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={selectedSlopeRange} onChange={(e) => updateSlopeRange(e.target.value)}>
            <option value="">Não informado</option>
            <option value="D1">&lt; 10 graus</option>
            <option value="D2">10 a 25 graus</option>
            <option value="D3">25 a 45 graus</option>
            <option value="D4">&gt; 45 graus</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel
            label={localTipo === 'via_acesso_exclusiva' ? 'Distância até a borda da via' : 'Distância da estrutura'}
            hint={distanceHint}
          />
          {localTipo === 'via_acesso_exclusiva' && impactoVia.posicaoRelativaVia === 'leito' ? (
            <input
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500"
              value="0 m (no leito da via)"
              readOnly
              disabled
            />
          ) : (
            <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={selectedExposureRange} onChange={(e) => updateExposureRange(e.target.value)}>
              <option value="">Não informado</option>
              <option value="E1">&gt; 50 m</option>
              <option value="E2">20 a 50 m</option>
              <option value="E3">5 a &lt; 20 m</option>
              <option value="E4">&lt; 5 m</option>
            </select>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Tipo de solo" hint={FIELD_HINTS.tipoSolo} />
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.tipoSolo || ''} onChange={(e) => updateField('tipoSolo', e.target.value)}>
            <option value="">Não informado</option>
            {EROSION_TECHNICAL_OPTIONS.tipoSolo.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {localTipo === 'via_acesso_exclusiva' && (
        <fieldset className="flex flex-col gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl relative mt-6 pt-6">
          <legend className="absolute -top-3 left-3 px-2 bg-amber-50 text-sm font-bold text-slate-800 rounded-md">Impacto na via de acesso</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Posição relativa à via" hint={FIELD_HINTS.posicaoRelativaVia} />
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.posicaoRelativaVia || ''} onChange={(e) => updateImpactoVia('posicaoRelativaVia', e.target.value)}>
                <option value="">Selecione...</option>
                {EROSION_TECHNICAL_OPTIONS.posicaoRelativaVia.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Tipo de impacto" hint={FIELD_HINTS.tipoImpactoVia} />
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.tipoImpactoVia || ''} onChange={(e) => updateImpactoVia('tipoImpactoVia', e.target.value)}>
                <option value="">Selecione...</option>
                {EROSION_TECHNICAL_OPTIONS.tipoImpactoVia.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Grau de obstrução" hint={FIELD_HINTS.grauObstrucao} />
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.grauObstrucao || ''} onChange={(e) => updateImpactoVia('grauObstrucao', e.target.value)}>
                <option value="">Selecione...</option>
                {EROSION_TECHNICAL_OPTIONS.grauObstrucao.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Estado da via" hint={FIELD_HINTS.estadoVia} />
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.estadoVia || ''} onChange={(e) => updateImpactoVia('estadoVia', e.target.value)}>
                <option value="">Selecione...</option>
                {EROSION_TECHNICAL_OPTIONS.estadoVia.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Extensão afetada (m)" hint={FIELD_HINTS.extensaoAfetadaMetros} />
              <input type="number" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.extensaoAfetadaMetros ?? ''} onChange={(e) => updateImpactoVia('extensaoAfetadaMetros', e.target.value)} min="0" step="1" />
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Largura comprometida (m)" hint={FIELD_HINTS.larguraComprometidaMetros} />
              <input type="number" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.larguraComprometidaMetros ?? ''} onChange={(e) => updateImpactoVia('larguraComprometidaMetros', e.target.value)} min="0" step="0.1" />
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Possibilidade de desvio" hint={FIELD_HINTS.possibilidadeDesvio} />
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.possibilidadeDesvio === true ? 'sim' : impactoVia.possibilidadeDesvio === false ? 'nao' : ''} onChange={(e) => updateImpactoVia('possibilidadeDesvio', e.target.value === 'sim' ? true : e.target.value === 'nao' ? false : null)}>
                <option value="">Não informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel label="Rota alternativa" hint={FIELD_HINTS.rotaAlternativaDisponivel} />
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={impactoVia.rotaAlternativaDisponivel === true ? 'sim' : impactoVia.rotaAlternativaDisponivel === false ? 'nao' : ''} onChange={(e) => updateImpactoVia('rotaAlternativaDisponivel', e.target.value === 'sim' ? true : e.target.value === 'nao' ? false : null)}>
                <option value="">Não informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Classe P (derivada)</span>
          <input className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500" value={classes.profundidadeClasse || '-'} readOnly disabled />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Classe D (derivada)</span>
          <input className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500" value={classes.declividadeClasse || '-'} readOnly disabled />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Classe E (derivada)</span>
          <input className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500" value={classes.exposicaoClasse || '-'} readOnly disabled />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Presença de água no fundo" hint={FIELD_HINTS.presencaAguaFundo} />
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.presencaAguaFundo || ''} onChange={(e) => updateField('presencaAguaFundo', e.target.value)}>
            <option value="">Não informado</option>
            {EROSION_TECHNICAL_OPTIONS.presencaAguaFundo.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Saturação por água" hint={FIELD_HINTS.saturacaoPorAgua} />
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.saturacaoPorAgua || ''} onChange={(e) => updateField('saturacaoPorAgua', e.target.value)}>
            <option value="">Não informado</option>
            {EROSION_TECHNICAL_OPTIONS.saturacaoPorAgua.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Sinais de avanço" hint={FIELD_HINTS.sinaisAvanco} />
          <select
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={formData.sinaisAvanco ? 'sim' : 'nao'}
            onChange={(e) => updateField('sinaisAvanco', e.target.value === 'sim')}
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Vegetação no interior" hint={FIELD_HINTS.vegetacaoInterior} />
          <select
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={formData.vegetacaoInterior ? 'sim' : 'nao'}
            onChange={(e) => updateField('vegetacaoInterior', e.target.value === 'sim')}
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl relative mt-8 pt-6">
        <legend className="absolute -top-3 left-3 px-2 bg-slate-50 text-sm font-bold text-slate-800 rounded-md">Tipo predominante da feicao</legend>
        <label className="flex flex-col gap-1.5">
          <FieldLabel label="Tipo de erosao observado" hint={tipoFeicaoHint} />
          <select
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={selectedTipoFeicao}
            onChange={(e) => updateSingleSelectArrayField('tiposFeicao', e.target.value)}
          >
            <option value="">Selecione...</option>
            {EROSION_TECHNICAL_OPTIONS.tiposFeicao.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl relative mt-6 pt-6">
        <legend className="absolute -top-3 left-3 px-2 bg-slate-50 text-sm font-bold text-slate-800 rounded-md">Usos do solo</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {EROSION_TECHNICAL_OPTIONS.usosSolo.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer hover:text-brand-600 transition-colors">
              <input
                type="checkbox"
                className="mt-1"
                checked={usosSolo.includes(option.value)}
                onChange={(e) => toggleMultiField('usosSolo', option.value, e.target.checked)}
              />
              <span className="leading-tight pt-0.5">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {usosSolo.includes('outro') ? (
        <label className="flex flex-col gap-1.5 mt-4">
          <span className="text-sm font-semibold text-slate-700">Uso do solo - outro *</span>
          <input className={fieldClass('usoSoloOutro')} value={formData.usoSoloOutro || ''} onChange={(e) => updateField('usoSoloOutro', e.target.value)} />
          {validationErrors.usoSoloOutro ? (
            <span className="text-2xs font-medium text-danger">{validationErrors.usoSoloOutro}</span>
          ) : null}
        </label>
      ) : null}
    </>
  );
}

export default ErosionTechnicalFields;

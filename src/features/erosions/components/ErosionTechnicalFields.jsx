import { useMemo } from 'react';
import {
  EROSION_TECHNICAL_OPTIONS,
  LOCAL_CONTEXTO_TIPO_OPTIONS,
  deriveCriticalityDimensionClasses,
  normalizeLocalContexto,
} from '../../shared/viewUtils';

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

function ErosionTechnicalFields({
  formData = {},
  onPatch,
  readOnlyClasses,
}) {
  const tiposFeicao = normalizeArray(formData.tiposFeicao);
  const caracteristicasFeicao = normalizeArray(formData.caracteristicasFeicao);
  const usosSolo = normalizeArray(formData.usosSolo);

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
    || (classes.declividadeClasse === 'D3' ? 'D3' : classes.declividadeClasse || '');
  const selectedExposureRange = deriveExposureRange(parseNumeric(formData.distanciaEstruturaMetros)) || classes.exposicaoClasse || '';

  const localTipo = localContexto.localTipo || '';
  const showLocalDescricao = localTipo === 'outros';
  const showExposicaoSelect = localTipo === 'outros';
  const showEstruturaSelect = ['faixa_servidao', 'fora_faixa_servidao', 'outros'].includes(localTipo);
  const lockEstruturaValue = localTipo === 'via_acesso_exclusiva' || localTipo === 'base_torre';

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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Local da erosão</span>
          <select
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={localTipo}
            onChange={(e) => updateLocalContext({ localTipo: e.target.value })}
          >
            <option value="">Selecione...</option>
            {LOCAL_CONTEXTO_TIPO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Detalhe do local</span>
          <input
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            value={showLocalDescricao ? (localContexto.localDescricao || '') : '-'}
            onChange={(e) => updateLocalContext({ localDescricao: e.target.value })}
            disabled={!showLocalDescricao}
            placeholder={showLocalDescricao ? 'Obrigatório para Outros' : 'Não se aplica'}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Localização de exposição</span>
          {showExposicaoSelect ? (
            <select
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              value={localContexto.exposicao || ''}
              onChange={(e) => updateLocalContext({ exposicao: e.target.value })}
            >
              <option value="">Selecione...</option>
              {EROSION_TECHNICAL_OPTIONS.localizacaoExposicao.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500" value={localContexto.exposicao || '-'} readOnly disabled />
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Estrutura próxima</span>
          {(showEstruturaSelect || lockEstruturaValue) ? (
            <select
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
            <input className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500" value={localContexto.estruturaProxima || '-'} readOnly disabled />
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Profundidade</span>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={selectedDepthRange} onChange={(e) => updateDepthRange(e.target.value)}>
            <option value="">Não informado</option>
            <option value="P1">&lt;= 1 m</option>
            <option value="P2">1 a 10 m</option>
            <option value="P3">10 a 30 m</option>
            <option value="P4">&gt; 30 m</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Declividade</span>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={selectedSlopeRange} onChange={(e) => updateSlopeRange(e.target.value)}>
            <option value="">Não informado</option>
            <option value="D1">&lt; 10 graus</option>
            <option value="D2">10 a 25 graus</option>
            <option value="D3">25 a 45 graus</option>
            <option value="D4">&gt; 45 graus</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Distância da estrutura</span>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={selectedExposureRange} onChange={(e) => updateExposureRange(e.target.value)}>
            <option value="">Não informado</option>
            <option value="E1">&gt; 50 m</option>
            <option value="E2">20 a 50 m</option>
            <option value="E3">5 a &lt; 20 m</option>
            <option value="E4">&lt; 5 m</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Tipo de solo</span>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.tipoSolo || ''} onChange={(e) => updateField('tipoSolo', e.target.value)}>
            <option value="">Não informado</option>
            {EROSION_TECHNICAL_OPTIONS.tipoSolo.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

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
          <span className="text-sm font-semibold text-slate-700">Presença de água no fundo</span>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.presencaAguaFundo || ''} onChange={(e) => updateField('presencaAguaFundo', e.target.value)}>
            <option value="">Não informado</option>
            {EROSION_TECHNICAL_OPTIONS.presencaAguaFundo.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Saturação por água</span>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.saturacaoPorAgua || ''} onChange={(e) => updateField('saturacaoPorAgua', e.target.value)}>
            <option value="">Não informado</option>
            {EROSION_TECHNICAL_OPTIONS.saturacaoPorAgua.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Sinais de avanço</span>
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
          <span className="text-sm font-semibold text-slate-700">Vegetação no interior</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <fieldset className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl relative mt-2 pt-6">
          <legend className="absolute -top-3 left-3 px-2 bg-slate-50 text-sm font-bold text-slate-800 rounded-md">Tipos de feição adicionais</legend>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {EROSION_TECHNICAL_OPTIONS.tiposFeicao.map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer hover:text-brand-600 transition-colors">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={tiposFeicao.includes(option.value)}
                  onChange={(e) => toggleMultiField('tiposFeicao', option.value, e.target.checked)}
                />
                <span className="leading-tight pt-0.5">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl relative mt-2 pt-6">
          <legend className="absolute -top-3 left-3 px-2 bg-slate-50 text-sm font-bold text-slate-800 rounded-md">Características da feição</legend>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {EROSION_TECHNICAL_OPTIONS.caracteristicasFeicao.map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer hover:text-brand-600 transition-colors">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={caracteristicasFeicao.includes(option.value)}
                  onChange={(e) => toggleMultiField('caracteristicasFeicao', option.value, e.target.checked)}
                />
                <span className="leading-tight pt-0.5">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

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
          <input className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" value={formData.usoSoloOutro || ''} onChange={(e) => updateField('usoSoloOutro', e.target.value)} />
        </label>
      ) : null}
    </>
  );
}

export default ErosionTechnicalFields;

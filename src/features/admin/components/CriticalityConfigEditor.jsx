/**
 * Editor estruturado da configuracao de criticidade (V3).
 *
 * Substitui o textarea de JSON cru por: (1) faixas C1-C4 com limites encadeados
 * (so o limite superior e editavel; o inicio da proxima acompanha) + barra visual,
 * e (2) matriz de pontos dos 6 fatores T/P/D/S/E/A. O JSON completo continua sendo
 * a fonte de verdade salva: o componente e controlado por `value` (string JSON) e
 * emite `onChange(jsonString)` no mesmo formato canonico, preservando os campos que
 * a UI nao edita (descricoes, tipos, modificador de via, solucoes por criticidade).
 * Um "Editor avancado (JSON)" continua disponivel como modo de escape.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Card, Input, Textarea } from '../../../components/ui';
import { mergeCriticalityConfig } from '../../shared/rulesConfig';
import { CRITICALITY_COLOR_BY_CODE } from '../../monitoring/utils/monitoringColors';

const FACTOR_ROWS = [
  { key: 'tipo_erosao', rotulo: 'Tipo de erosao', levels: ['T1', 'T2', 'T3', 'T4'] },
  { key: 'profundidade', rotulo: 'Profundidade', levels: ['P1', 'P2', 'P3', 'P4'] },
  { key: 'declividade', rotulo: 'Declividade', levels: ['D1', 'D2', 'D3', 'D4'] },
  { key: 'solo', rotulo: 'Solo', levels: ['S1', 'S2', 'S3', 'S4'] },
  { key: 'atividade', rotulo: 'Atividade', levels: ['A1', 'A2', 'A3', 'A4'] },
  { key: 'exposicao', rotulo: 'Exposicao', levels: ['E1', 'E2', 'E3', 'E4'] },
];

const BADGE_TONE_BY_CODE = { C1: 'ok', C2: 'warning', C3: 'danger', C4: 'critical' };

function parseConfig(text) {
  try {
    const parsed = JSON.parse(String(text || '{}'));
    return mergeCriticalityConfig(parsed);
  } catch {
    return null;
  }
}

function num(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Copia serializavel: '' -> 0 nos pontos/limites; max nao-finito (C4) vira null no JSON. */
function toSerializable(config) {
  const out = { ...config };
  out.faixas = (Array.isArray(config.faixas) ? config.faixas : []).map((band) => ({
    ...band,
    min: num(band.min),
    max: Number.isFinite(Number(band.max)) ? num(band.max) : band.max,
  }));
  const pontos = { ...(config.pontos || {}) };
  FACTOR_ROWS.forEach(({ key, levels }) => {
    const factor = pontos[key];
    if (!factor) return;
    const nextFactor = { ...factor };
    levels.forEach((level) => {
      if (nextFactor[level]) nextFactor[level] = { ...nextFactor[level], pontos: num(nextFactor[level].pontos) };
    });
    pontos[key] = nextFactor;
  });
  out.pontos = pontos;
  return out;
}

function serialize(config) {
  return JSON.stringify(toSerializable(config), null, 2);
}

function CriticalityConfigEditor({ value, onChange, onValidityChange }) {
  const [config, setConfig] = useState(() => parseConfig(value) || mergeCriticalityConfig({}));
  const [advOpen, setAdvOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const lastEmitted = useRef(value);

  // Re-sincroniza quando `value` muda por fora (ex.: botao "Restaurar padrao"),
  // ignorando o eco do proprio onChange para nao atropelar edicoes em curso.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const parsed = parseConfig(value);
    if (parsed) setConfig(parsed);
    lastEmitted.current = value;
  }, [value]);

  const faixas = Array.isArray(config.faixas) ? config.faixas : [];

  const errors = useMemo(() => {
    const list = [];
    for (let i = 0; i < faixas.length - 1; i += 1) {
      if (!(Number(faixas[i].max) < Number(faixas[i + 1].max))) {
        list.push(`O limite de ${faixas[i].codigo} deve ser menor que o de ${faixas[i + 1].codigo}.`);
      }
    }
    if (faixas[0] && Number(faixas[0].max) < 0) list.push('O limite de C1 nao pode ser negativo.');
    return list;
  }, [faixas]);

  useEffect(() => {
    onValidityChange?.(errors.length === 0);
  }, [errors, onValidityChange]);

  function emit(nextConfig) {
    setConfig(nextConfig);
    const text = serialize(nextConfig);
    lastEmitted.current = text;
    onChange?.(text);
  }

  function handleBandMax(idx, raw) {
    const nextFaixas = faixas.map((band) => ({ ...band }));
    nextFaixas[idx].max = raw === '' ? '' : Number(raw);
    for (let i = 1; i < nextFaixas.length; i += 1) {
      nextFaixas[i].min = Number(nextFaixas[i - 1].max) + 1;
    }
    emit({ ...config, faixas: nextFaixas });
  }

  function handlePoint(factorKey, level, raw) {
    const factor = config.pontos?.[factorKey] || {};
    const nextFactor = {
      ...factor,
      [level]: { ...(factor[level] || {}), pontos: raw === '' ? '' : Number(raw) },
    };
    emit({ ...config, pontos: { ...config.pontos, [factorKey]: nextFactor } });
  }

  function handleAdvancedToggle(event) {
    if (event.target.open) {
      setJsonText(serialize(config));
      setJsonError('');
    }
    setAdvOpen(event.target.open);
  }

  function applyJson() {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      setJsonError(error?.message || 'JSON invalido.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.faixas) || !parsed.pontos) {
      setJsonError('Estrutura esperada: objeto com "faixas" (array) e "pontos".');
      return;
    }
    setJsonError('');
    emit(mergeCriticalityConfig(parsed));
  }

  // Larguras da barra visual (C4 e aberta: usa um intervalo nocional para exibir).
  const effectiveBands = faixas.map((band) => {
    const min = Number(band.min);
    const max = Number.isFinite(Number(band.max)) ? Number(band.max) : min + 9;
    return { ...band, effMin: min, effMax: max, span: Math.max(max - min + 1, 1) };
  });
  const totalSpan = effectiveBands.reduce((acc, band) => acc + band.span, 0) || 1;

  return (
    <div className="flex flex-col gap-5">
      <Card variant="flat" className="p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 m-0">Faixas de classificacao (C1-C4)</h3>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Edite apenas o limite superior de cada faixa — o inicio da seguinte acompanha automaticamente.
          </p>
        </div>

        <div className="flex h-9 rounded-lg overflow-hidden border border-slate-200" aria-hidden="true">
          {effectiveBands.map((band) => (
            <div
              key={band.codigo}
              className="flex items-center justify-center gap-1.5 text-white text-2xs font-bold"
              style={{ width: `${Math.max((band.span / totalSpan) * 100, 6)}%`, backgroundColor: CRITICALITY_COLOR_BY_CODE[band.codigo] }}
            >
              {band.codigo}
              <span className="font-medium opacity-90 hidden sm:inline">
                {band.min}{Number.isFinite(Number(band.max)) ? `-${band.max}` : '+'}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {faixas.map((band, idx) => (
            <div key={band.codigo} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Badge tone={BADGE_TONE_BY_CODE[band.codigo] || 'neutral'} size="md">{band.codigo}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 m-0">{band.classe}</p>
                <p className="text-2xs text-slate-400 m-0">a partir de {band.min} pts</p>
              </div>
              <label className="block">
                <span className="block text-2xs font-bold uppercase tracking-wide text-slate-500 mb-1 text-center">ate</span>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  fullWidth={false}
                  className="w-20 text-center"
                  value={Number.isFinite(Number(band.max)) ? band.max : ''}
                  placeholder={Number.isFinite(Number(band.max)) ? undefined : '∞'}
                  disabled={idx === faixas.length - 1}
                  aria-label={`Limite superior de ${band.codigo}`}
                  onChange={(event) => handleBandMax(idx, event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>

        {errors.length > 0 ? (
          <div className="rounded-lg border border-danger-border bg-danger-light px-3 py-2 text-xs text-red-700">
            {errors.map((error) => <p key={error} className="m-0">{error}</p>)}
          </div>
        ) : null}
      </Card>

      <Card variant="flat" className="p-5 flex flex-col gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 m-0">Pontos por fator</h3>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            O escore e a soma dos pontos dos 6 fatores + modificador de via de acesso (max. 4).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fator</th>
                {[1, 2, 3, 4].map((classe) => (
                  <th key={classe} className="px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Classe {classe}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FACTOR_ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">{row.levels[0][0]}</span>
                      <span className="text-sm text-slate-700">{row.rotulo}</span>
                    </div>
                  </td>
                  {row.levels.map((level, classIdx) => (
                    <td key={level} className="px-3 py-2 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        fullWidth={false}
                        className="w-16 text-center mx-auto"
                        value={config.pontos?.[row.key]?.[level]?.pontos ?? ''}
                        aria-label={`Pontos de ${row.rotulo}, classe ${classIdx + 1}`}
                        onChange={(event) => handlePoint(row.key, level, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card variant="flat" className="!p-0 overflow-hidden">
        <details onToggle={handleAdvancedToggle}>
          <summary className="flex items-center gap-2 px-5 py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors list-none">
            <AppIcon name="database" className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-700 flex-1">Editor avancado (JSON)</span>
            <AppIcon name="chevron-down" className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${advOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </summary>
          <div className="border-t border-slate-100 px-5 py-4 flex flex-col gap-3">
            <Textarea
              rows={12}
              value={jsonText}
              onChange={(event) => { setJsonText(event.target.value); setJsonError(''); }}
              className="font-mono min-h-[240px]"
              aria-label="Configuracao de criticidade em JSON"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {jsonError
                ? <p className="text-xs text-danger font-medium m-0">{jsonError}</p>
                : <p className="text-xs text-slate-500 m-0">Estrutura: `faixas`, `pontos` e `solucoes_por_criticidade` — mesmo formato canonico.</p>}
              <Button variant="outline" size="sm" onClick={applyJson}>
                <AppIcon name="check" /> Aplicar JSON ao editor
              </Button>
            </div>
          </div>
        </details>
      </Card>
    </div>
  );
}

export default CriticalityConfigEditor;

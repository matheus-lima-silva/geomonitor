import { useState } from 'react';
import {
  Button, Card, Input, Select, Textarea, PageHeader,
} from '@app/components/ui';
import { useToast } from '@app/context/ToastContext';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';

import {
  buildFichaXlsx, buildFichaFileName, CRITICIDADE_SOLUCOES, ROTULOS,
} from './utils/fichaXlsxBuilder';

const CRITICIDADE_OPCOES = [
  { value: 'C1', label: 'C1 — Baixo (0–9)' },
  { value: 'C2', label: 'C2 — Médio (10–18)' },
  { value: 'C3', label: 'C3 — Alto (19–27)' },
  { value: 'C4', label: 'C4 — Muito Alto (28+)' },
];

const ESTADO_INICIAL = {
  empreendimento: '',
  ficha_num: '',
  data: '',
  profissional: '',
  utm_e: '',
  utm_fuso: '',
  utm_s: '',
  altitude: '',
  fotos: '',
  referencia: '',
  tipo_area: '',
  criticidade: '',
  estagio: '',
  feicoes: [],
  presenca_agua: '',
  declividade: '',
  largura: '',
  altura: '',
  relevo: '',
  tipo_solo: '',
  usos_solo: [],
  obstaculos: [],
  outros: '',
  medida_preventiva: '',
};

/** Converte 'aaaa-mm-dd' (input date) em 'dd/mm/aaaa'. */
function formatarData(valorIso) {
  if (!valorIso) return '';
  const [ano, mes, dia] = valorIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function chavesDe(grupo) {
  return Object.keys(ROTULOS[grupo]);
}

function GrupoOpcoes({
  legenda, grupo, multiplo = false, valor, onChange,
}) {
  const selecionados = multiplo ? valor : [valor];

  function alternar(chave) {
    if (!multiplo) {
      onChange(valor === chave ? '' : chave);
      return;
    }
    onChange(valor.includes(chave) ? valor.filter((v) => v !== chave) : [...valor, chave]);
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-2xs font-bold uppercase tracking-wide text-slate-500">
        {legenda}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {chavesDe(grupo).map((chave) => (
          <label key={chave} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
            <input
              type={multiplo ? 'checkbox' : 'radio'}
              name={`ficha-${grupo}-${legenda}`}
              value={chave}
              checked={selecionados.includes(chave)}
              onChange={() => alternar(chave)}
              className="cursor-pointer"
            />
            {ROTULOS[grupo][chave]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Modulo "Ficha de Erosao Avulsa" do Portal de Relatorios.
 *
 * Ferramenta standalone: os dados de um foco erosivo sao digitados aqui e viram
 * a ficha simplificada em .xlsx (mesmo layout da ficha do worker), montada no
 * proprio navegador. Nao toca backend/worker/MinIO — nada e enviado nem
 * persistido, e a ficha nao precisa de erosao cadastrada nem de empreendimento.
 */
export default function FichaErosaoPage({ onExit }) {
  const toast = useToast();
  const [dados, setDados] = useState(ESTADO_INICIAL);

  const definir = (campo) => (valor) => setDados((atual) => ({ ...atual, [campo]: valor }));
  const doInput = (campo) => (event) => definir(campo)(event.target.value);

  function usarTextoPadrao() {
    if (!dados.criticidade) {
      toast.show('Selecione um grau de criticidade primeiro.', 'info');
      return;
    }
    definir('medida_preventiva')(CRITICIDADE_SOLUCOES[dados.criticidade]);
  }

  function gerar() {
    try {
      const payload = { ...dados, data: formatarData(dados.data) };
      const blob = buildFichaXlsx(payload);
      const baixou = triggerBlobDownload(buildFichaFileName(payload), blob);
      if (baixou === false) {
        toast.show('Nao foi possivel iniciar o download neste navegador.', 'error');
        return;
      }
      toast.show('Ficha gerada.', 'success');
    } catch (err) {
      toast.show(err?.message || 'Falha ao gerar a ficha.', 'error');
    }
  }

  function limpar() {
    setDados(ESTADO_INICIAL);
    toast.show('Formulario limpo.', 'info');
  }

  return (
    <main className="min-h-screen bg-app-bg">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <PageHeader
          title="Ficha de Erosão Avulsa"
          subtitle="Cadastro de focos erosivos — gera a ficha .xlsx pronta para impressão em A4"
          action={(
            <Button variant="outline" size="sm" onClick={onExit}>
              Voltar
            </Button>
          )}
        />

        <div className="mt-6 flex flex-col gap-4">
          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0 mb-3">Identificação</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  id="ficha-empreendimento"
                  label="Empreendimento (LT)"
                  value={dados.empreendimento}
                  onChange={doInput('empreendimento')}
                  placeholder="Ex: 230 kV Exemplo C1"
                />
              </div>
              <Input id="ficha-num" label="Ficha nº" value={dados.ficha_num} onChange={doInput('ficha_num')} />
              <Input id="ficha-data" label="Data" type="date" value={dados.data} onChange={doInput('data')} />
              <div className="sm:col-span-2">
                <Input
                  id="ficha-profissional"
                  label="Profissional"
                  value={dados.profissional}
                  onChange={doInput('profissional')}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0 mb-3">Localização</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="ficha-utm-e" label="UTM E" value={dados.utm_e} onChange={doInput('utm_e')} />
              <Input id="ficha-fuso" label="Fuso" value={dados.utm_fuso} onChange={doInput('utm_fuso')} placeholder="Ex: 23K" />
              <Input id="ficha-utm-s" label="UTM S" value={dados.utm_s} onChange={doInput('utm_s')} />
              <Input id="ficha-altitude" label="Altitude" value={dados.altitude} onChange={doInput('altitude')} placeholder="Ex: 540 m" />
              <Input id="ficha-fotos" label="Fotos" value={dados.fotos} onChange={doInput('fotos')} placeholder="Ex: 01, 02, 03" />
              <Input id="ficha-referencia" label="Referência" value={dados.referencia} onChange={doInput('referencia')} />
              <div className="sm:col-span-2">
                <GrupoOpcoes legenda="Tipo de área" grupo="area" valor={dados.tipo_area} onChange={definir('tipo_area')} />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0 mb-3">Criticidade e situação atual</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                id="ficha-criticidade"
                label="Classificação de criticidade"
                value={dados.criticidade}
                onChange={doInput('criticidade')}
              >
                <option value="">Não informado</option>
                {CRITICIDADE_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <GrupoOpcoes legenda="Estágio erosivo" grupo="estagio" valor={dados.estagio} onChange={definir('estagio')} />
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0 mb-3">Tipo / características da feição</h3>
            <div className="flex flex-col gap-3">
              <GrupoOpcoes legenda="Tipos de feição" grupo="feicao" multiplo valor={dados.feicoes} onChange={definir('feicoes')} />
              <GrupoOpcoes
                legenda="Presença de água no fundo"
                grupo="presenca_agua"
                valor={dados.presenca_agua}
                onChange={definir('presenca_agua')}
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0 mb-3">Declividade e dimensões</h3>
            <div className="flex flex-col gap-3">
              <GrupoOpcoes legenda="Declividade" grupo="declividade" valor={dados.declividade} onChange={definir('declividade')} />
              <GrupoOpcoes legenda="Largura máxima" grupo="dimensao" valor={dados.largura} onChange={definir('largura')} />
              <GrupoOpcoes legenda="Altura máxima" grupo="dimensao" valor={dados.altura} onChange={definir('altura')} />
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0 mb-3">Caracterização</h3>
            <div className="flex flex-col gap-3">
              <GrupoOpcoes legenda="Relevo" grupo="relevo" valor={dados.relevo} onChange={definir('relevo')} />
              <GrupoOpcoes legenda="Tipo de solo" grupo="tipo_solo" valor={dados.tipo_solo} onChange={definir('tipo_solo')} />
              <GrupoOpcoes legenda="Usos do solo" grupo="usos_solo" multiplo valor={dados.usos_solo} onChange={definir('usos_solo')} />
              <GrupoOpcoes legenda="Obstáculos" grupo="obstaculos" multiplo valor={dados.obstaculos} onChange={definir('obstaculos')} />
              <Input id="ficha-outros" label="Outros" value={dados.outros} onChange={doInput('outros')} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-base font-semibold text-slate-800 m-0">Medida preventiva</h3>
              <Button variant="outline" size="sm" onClick={usarTextoPadrao}>
                Usar texto padrão da criticidade
              </Button>
            </div>
            <Textarea
              id="ficha-medida"
              rows={3}
              value={dados.medida_preventiva}
              onChange={doInput('medida_preventiva')}
              placeholder="Em branco, usa o texto padrão do grau de criticidade selecionado."
            />
          </Card>

          <div className="flex items-center justify-end gap-2 pb-4">
            <Button variant="outline" onClick={limpar}>Limpar</Button>
            <Button variant="primary" onClick={gerar}>Gerar ficha .xlsx</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

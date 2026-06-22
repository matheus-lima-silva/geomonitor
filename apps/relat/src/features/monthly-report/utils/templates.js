// Textos-modelo e leads fixos do Relatorio Mensal de Acompanhamento dos
// Servicos. Portados do design handoff (js/estado.js); o renderer Python e a
// preview usam as mesmas strings de lead — manter em sincronia com
// worker/monthly_report_renderer.py.

import { MONTHS } from './constants';
import { getDateRange } from './calendar';

export const SECTION2_LEAD = 'As atividades são realizadas conforme solicitação da contratante a cada um dos engenheiros, conforme demonstrado a seguir.';
export const ENG_LEAD = 'As atividades realizadas no período deste relatório foram distribuídas na seguinte disposição:';
export const RESUMO_DESC = 'Descrição das atividades desenvolvidas em cada empreendimento ao longo do período, com destaque para entregas e marcos relevantes.';

export function listEngineerNames(engineers = []) {
  const names = engineers.map((e) => (e && e.name ? e.name.trim() : '')).filter(Boolean);
  if (names.length === 0) return 'da equipe';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

export function introTemplate({ refYear, refMonth, engineers = [], contrato = {} }) {
  const { start, end } = getDateRange(refYear, refMonth);
  const numero = contrato.numero || '';
  const objeto = contrato.objeto || '';
  const contratante = contrato.contratante || '';
  const contratada = contrato.contratada || '';

  return `O presente relatório apresenta de forma resumida as atividades realizadas no período de ${start.getDate()} de ${MONTHS[start.getMonth()].toLowerCase()} a ${end.getDate()} de ${MONTHS[end.getMonth()].toLowerCase()} de ${end.getFullYear()}, realizadas pelos engenheiros ${listEngineerNames(engineers)}.

Os profissionais estão vinculados ao contrato nº ${numero} — ${objeto}, firmado entre a contratante ${contratante} e a contratada ${contratada}.

Ao longo deste período foram realizadas vistorias em linhas de transmissão (LT), subestações (SE), usinas hidrelétricas (UHE) e parques nacionais (PARNA), conforme solicitação da contratante.`;
}

export function conclusaoTemplate() {
  return 'No período avaliado foram realizadas campanhas de vistoria e diversas atividades de apoio técnico, contemplando inspeções de campo, elaboração de relatórios, desenvolvimento documental, articulações institucionais e suporte a processos de licenciamento ambiental. As atividades ocorreram conforme o cronograma previsto, sem impactos relevantes ao escopo contratual, resultando na entrega de produtos técnicos e no avanço das demandas sob responsabilidade da equipe.';
}

// Estrutura dos steps do wizard de criacao/edicao do relatorio final.
// Ordem: Cabecalho -> Textos -> Workspaces -> Assinaturas -> Revisao.
export const WIZARD_STEPS = [
  { id: 'cabecalho', label: 'Cabeçalho' },
  { id: 'textos', label: 'Textos' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'revisao', label: 'Revisão' },
];

export const DEFAULT_DRAFT = Object.freeze({
  nome: '',
  revisao: '00',
  nome_lt: '',
  titulo_programa: '',
  codigo_documento: '',
  introducao: '',
  geologia: '',
  geotecnia: '',
  geomorfologia: '',
  descricao_atividades: '',
  conclusoes: '',
  analise_evolucao: '',
  observacoes: '',
  elaboradores: [],
  revisores: [],
  includeTowerCoordinates: false,
  towerCoordinateFormat: 'decimal',
});

// Campos do draft considerados obrigatorios. Hoje so 'nome' (alinhado com a
// validacao atual de handleCreateCompound em ReportsView.jsx).
export const REQUIRED_FIELDS = [
  { key: 'nome', label: 'Nome do relatório', stepId: 'cabecalho' },
];

export function getMissingRequired(draft) {
  return REQUIRED_FIELDS.filter((field) => !String(draft?.[field.key] || '').trim());
}

export function isStepComplete(stepId, draft) {
  return REQUIRED_FIELDS
    .filter((field) => field.stepId === stepId)
    .every((field) => Boolean(String(draft?.[field.key] || '').trim()));
}

export function hasStepBeenVisited(stepId, visitedSteps) {
  return Boolean(visitedSteps?.[stepId]);
}

// Exemplos concretos para ajudar o usuário a escrever cada seção do relatório.
// Placeholders reais (não jargão genérico) reduzem a fricção da página em
// branco e deixam claro o nível de detalhe esperado.
export const SECTION_EXAMPLES = {
  introducao: {
    label: '1. Introdução',
    hint: 'Contexto, motivo do relatório, referência à licença/condicionante, período da vistoria, comparação com relatório anterior. 3 a 8 parágrafos.',
    placeholder: 'Ex.: Desde a emissão da Licença de Operação N.º XX pelo órgão Y em DD/MM/AAAA, a empresa Z é responsável por apresentar relatórios anuais em atendimento à Condicionante Específica N.º...',
  },
  geologia: {
    label: 'Geologia',
    hint: 'Complexos geológicos atravessados, tipos de rochas, feições estruturais relevantes.',
    placeholder: 'Ex.: A LT atravessa o Complexo Granulítico de Juiz de Fora na porção sul, com predominância de gnaisses migmatíticos e intrusões graníticas...',
  },
  geotecnia: {
    label: 'Geotecnia',
    hint: 'Características dos solos residuais/sedimentares, espessuras típicas, ocorrências notáveis por trecho.',
    placeholder: 'Ex.: Entre as torres 145 e 180 predominam solos residuais profundos com espessura até 8m. Nos trechos baixos há depósitos coluvionares...',
  },
  geomorfologia: {
    label: 'Geomorfologia',
    hint: 'Formas de relevo, declividade típica, processos morfodinâmicos observados.',
    placeholder: 'Ex.: O traçado cruza unidades de relevo de colinas dissecadas com declividades entre 20% e 45%, sujeitas a processos de escoamento superficial concentrado...',
  },
  descricao_atividades: {
    label: '3. Descrição das Atividades',
    hint: 'Metodologia de campo, equipe, cobertura por amostragem ou integral, registro fotográfico, critérios de classificação usados.',
    placeholder: 'Ex.: A vistoria foi realizada ao longo da LT em atendimento às Condições de Validade da licença. A campanha de campo ocorreu em DD/MM/AAAA e contou com equipe técnica composta por...',
  },
  conclusoes: {
    label: '5. Conclusões e Recomendações',
    hint: 'Diagnóstico agregado, torres críticas, recomendações de intervenção priorizadas.',
    placeholder: 'Ex.: Das N torres inspecionadas, X apresentam processos erosivos classificados como alto ou muito alto, concentrados entre as torres Y e Z. Recomenda-se priorizar ações de drenagem superficial nos vãos...',
  },
  analise_evolucao: {
    label: '6. Análise da Evolução dos Processos Erosivos',
    hint: 'Comparativo com relatórios anteriores, torres com piora ou melhoria, efetividade das intervenções.',
    placeholder: 'Ex.: Em comparação ao 14.º Relatório Anual (2020), observa-se estabilização das feições nas torres 012 a 034, enquanto as torres 087 e 091 registraram avanço dos processos erosivos...',
  },
  observacoes: {
    label: '7. Considerações Finais',
    hint: 'Fechamento, próximos passos, cronograma sugerido.',
    placeholder: 'Ex.: As condições ambientais gerais mostram-se compatíveis com a operação segura da LT, desde que mantidas as rotinas de monitoramento. Sugere-se nova vistoria no período chuvoso seguinte...',
  },
};

export const PRE_TEXT_SECTION_KEYS = ['introducao'];
export const CARACTERIZACAO_KEYS = ['geologia', 'geotecnia', 'geomorfologia'];
export const POST_TEXT_SECTION_KEYS = [
  'descricao_atividades',
  'conclusoes',
  'analise_evolucao',
  'observacoes',
];

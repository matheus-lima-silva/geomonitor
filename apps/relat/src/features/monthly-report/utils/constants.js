// Constantes do Relatorio Mensal de Acompanhamento dos Servicos. Categorias
// espelham as chaves do design handoff (js/estado.js) e o enum validado no
// backend (backend/schemas/monthlyReportSchemas.js). Cores sao dado de dominio
// (entram no DOCX), por isso hex literal e nao token Tailwind.

export const CATEGORIES = {
  vistoria: { label: 'Vistoria de campo', color: '#166534', light: '#ECFDF3' },
  doc: { label: 'Documentação técnica', color: '#2563EB', light: '#EFF6FF' },
  relatorio: { label: 'Elaboração de relatório', color: '#0369A1', light: '#E4F1F9' },
  geo: { label: 'Geoprocessamento', color: '#B45309', light: '#FFFBEB' },
  reuniao: { label: 'Reuniões / articulação', color: '#475569', light: '#F1F5F9' },
  outro: { label: 'Outros', color: '#7F1D1D', light: '#FEF2F2' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Estilos do quadro semanal no documento Word (selecionavel em Configuracoes).
// 'marcador' e o estilo do relatorio real entregue.
export const QUADRO_STYLES = [
  { key: 'preenchido', label: 'Blocos preenchidos', description: 'Barra com a cor solida da categoria e texto branco; continuação em tom claro.' },
  { key: 'marcador', label: 'Marcadores', description: 'Marcador colorido no primeiro dia e seta de continuação — estilo do modelo atual.' },
  { key: 'barra', label: 'Barra lateral', description: 'Fundo claro da categoria com filete colorido à esquerda.' },
];

export const DEFAULT_QUADRO_STYLE = 'marcador';

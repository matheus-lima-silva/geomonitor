// Constantes do Relatorio Mensal de Atividades. Categorias espelham as chaves
// do prototipo (relatorio_mensal.html) e o enum validado no backend
// (backend/schemas/monthlyReportSchemas.js).

export const CATEGORIES = {
  vistoria: { label: 'Vistoria de campo', shortLabel: 'VISTORIA', color: '#0F6E56' },
  doc: { label: 'Documentação técnica', shortLabel: 'DOCUMENTAÇÃO', color: '#534AB7' },
  relatorio: { label: 'Elaboração de relatório', shortLabel: 'RELATÓRIO', color: '#185FA5' },
  geo: { label: 'Geoprocessamento', shortLabel: 'GEOPROCESSAMENTO', color: '#D85A30' },
  reuniao: { label: 'Reuniões / articulação', shortLabel: 'ARTICULAÇÃO', color: '#5F5E5A' },
  outro: { label: 'Outros', shortLabel: 'OUTROS', color: '#993556' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function commentsToText(comments = []) {
  return comments
    .map((item) => `${item.data || '-'} ${item.inspectionId ? `(${item.inspectionId})` : ''}: ${item.obs || ''}`.trim())
    .join(' | ');
}

export function buildPlanningGuideRows(planningResult, project, year) {
  const projectLabel = `${project?.id || ''}${project?.nome ? ` - ${project.nome}` : ''}`.trim();
  const all = [
    ...(planningResult?.obrigatorias || []),
    ...(planningResult?.amostragemSelecionada || []),
    ...(planningResult?.naoPriorizar || []),
  ];

  return all.map((item) => ({
    empreendimento: projectLabel,
    ano: year,
    torre: item.torre,
    categoria: item.categoria || '',
    motivo: item.motivo || '',
    obrigatoria: item.categoria === 'obrigatoria' ? 'S' : 'N',
    comentarios: commentsToText(item.comentariosAnteriores || []),
    link_maps: item.mapsLink || '',
    hotel_sugerido: item.hotelSugeridoNome || '',
    hotel_municipio: item.hotelSugeridoMunicipio || '',
    hotel_logistica: item.hotelSugeridoLogisticaNota ?? '',
    hotel_reserva: item.hotelSugeridoReservaNota ?? '',
    hotel_estadia: item.hotelSugeridoEstadiaNota ?? '',
    hotel_torre_base: item.hotelSugeridoTorreBase || '',
    distancia_torre_alvo: item.hotelSugeridoDistanciaTorreAlvo ?? '',
  }));
}

export function exportPlanningGuideCsv(rows) {
  const headers = [
    'empreendimento',
    'ano',
    'torre',
    'categoria',
    'motivo',
    'obrigatoria',
    'comentarios',
    'link_maps',
    'hotel_sugerido',
    'hotel_municipio',
    'hotel_logistica',
    'hotel_reserva',
    'hotel_estadia',
    'hotel_torre_base',
    'distancia_torre_alvo',
  ];
  const lines = [headers.join(';')];
  (rows || []).forEach((row) => {
    lines.push(headers.map((key) => escapeCsv(row[key])).join(';'));
  });
  return lines.join('\n');
}

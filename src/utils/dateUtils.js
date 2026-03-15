const toISO = (date) => date.toISOString().slice(0, 10);

const isBusinessDay = (date) => {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

export function gerarPeriodoDias(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return [];

  const start = new Date(`${dataInicio}T00:00:00`);
  const end = new Date(`${dataFim}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dias = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) dias.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export function preservarDetalhesDias(detalhesAnteriores, novasDatas) {
  const mapaAnterior = new Map(detalhesAnteriores.map((dia) => [dia.data, dia]));
  return novasDatas.map((data) => {
    const existente = mapaAnterior.get(data);
    if (existente) return existente;

    return {
      data,
      clima: '',
      torres: [],
      torresDetalhadas: [],
      hotelNome: '',
      hotelMunicipio: '',
      hotelLogisticaNota: '',
      hotelReservaNota: '',
      hotelEstadiaNota: '',
      hotelTorreBase: '',
    };
  });
}

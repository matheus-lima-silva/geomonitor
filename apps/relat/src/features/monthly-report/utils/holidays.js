// Feriados BR/RJ/Rio computados em codigo (sem API externa). Movel via algoritmo
// de Pascoa (Meeus/Jones/Butcher). Fonte: prototipo relatorio_mensal.html.

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(k) {
  const [y, m, d] = String(k).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, days) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feriados nacionais + estaduais (RJ) + municipais (cidade do Rio) de um ano.
export function brazilHolidaysFor(year) {
  const easter = easterDate(year);
  const goodFriday = addDays(easter, -2);
  const carnivalTuesday = addDays(easter, -47);
  const corpusChristi = addDays(easter, 60);

  return [
    // Nacionais
    { date: `${year}-01-01`, name: 'Confraternização Universal' },
    { date: dateKey(goodFriday), name: 'Sexta-feira Santa' },
    { date: `${year}-04-21`, name: 'Tiradentes' },
    { date: `${year}-05-01`, name: 'Dia do Trabalho' },
    { date: dateKey(corpusChristi), name: 'Corpus Christi' },
    { date: `${year}-09-07`, name: 'Independência do Brasil' },
    { date: `${year}-10-12`, name: 'N. Sra. Aparecida' },
    { date: `${year}-11-02`, name: 'Finados' },
    { date: `${year}-11-15`, name: 'Proclamação da República' },
    { date: `${year}-11-20`, name: 'Consciência Negra' },
    { date: `${year}-12-25`, name: 'Natal' },
    // Estaduais (RJ)
    { date: dateKey(carnivalTuesday), name: 'Carnaval' },
    { date: `${year}-04-23`, name: 'São Jorge' },
    // Municipais (cidade do Rio)
    { date: `${year}-01-20`, name: 'São Sebastião' },
    { date: `${year}-03-01`, name: 'Aniversário do Rio' },
  ];
}

// Feriados oficiais BR/RJ/Rio dentro do periodo do relatorio (16 do mes
// anterior -> 15 do mes de referencia, que pode cruzar a virada de ano).
// Motor do botao "Preencher feriados RJ" — o resultado vira entradas da lista
// explicita `holidays` do relatorio, que o usuario pode editar livremente.
export function officialHolidaysForPeriod(refYear, refMonth) {
  const start = new Date(refYear, refMonth - 1, 16);
  const end = new Date(refYear, refMonth, 15);
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const years = new Set([start.getFullYear(), end.getFullYear()]);
  const all = [];
  years.forEach((y) => all.push(...brazilHolidaysFor(y)));
  return all
    .filter((h) => h.date >= startKey && h.date <= endKey)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Set de chaves de data a partir da lista explicita de feriados do relatorio.
// Feriados sao 100% controlados pelo usuario (sem computo implicito): o
// auto-preenchimento oficial e uma acao de UI que adiciona entradas a lista.
export function buildHolidaySet(holidays = []) {
  const set = new Set();
  (Array.isArray(holidays) ? holidays : []).forEach((h) => {
    if (h && h.date) set.add(h.date);
  });
  return set;
}

// Dia util = dia de semana (seg-sex) que nao e feriado no set fornecido.
export function isWorkingDay(date, holidaySet) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  if (holidaySet && holidaySet.has(dateKey(date))) return false;
  return true;
}

const MAX_TORRES = 1200;
const MAX_INTERVALO = 600;

const parseNumero = (value) => Number.parseInt(String(value).trim(), 10);

export function parseTowerInput(rawInput) {
  if (!rawInput) return [];

  const tokens = String(rawInput)
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const torres = new Set();

  for (const token of tokens) {
    if (token.includes('-')) {
      const [inicioBruto, fimBruto] = token.split('-');
      const inicio = parseNumero(inicioBruto);
      const fim = parseNumero(fimBruto);
      if (!Number.isInteger(inicio) || !Number.isInteger(fim)) continue;

      const min = Math.min(inicio, fim);
      const max = Math.max(inicio, fim);
      if (max - min > MAX_INTERVALO) continue;

      for (let i = min; i <= max && torres.size < MAX_TORRES; i += 1) {
        if (i > 0) torres.add(i);
      }
      continue;
    }

    const torre = parseNumero(token);
    if (Number.isInteger(torre) && torre > 0) torres.add(torre);
    if (torres.size >= MAX_TORRES) break;
  }

  return [...torres].sort((a, b) => a - b);
}

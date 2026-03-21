const MAX_TORRES = 1200;
const MAX_INTERVALO = 600;

const parseNumero = (value) => Number.parseInt(String(value).trim(), 10);

/**
 * Checks if a token looks like a valid alphanumeric tower reference (e.g., "1A", "0", "163B").
 * Must start with a digit and contain only alphanumeric characters.
 */
function isAlphanumericTower(token) {
  return /^\d+[A-Za-z]?$/.test(token);
}

export function parseTowerInput(rawInput) {
  if (!rawInput) return [];

  const tokens = String(rawInput)
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const torres = new Set();

  for (const token of tokens) {
    if (torres.size >= MAX_TORRES) break;

    // Range expansion: "1-150" -> "1", "2", ..., "150"
    if (token.includes('-') && /^\d+-\d+$/.test(token)) {
      const [inicioBruto, fimBruto] = token.split('-');
      const inicio = parseNumero(inicioBruto);
      const fim = parseNumero(fimBruto);
      if (!Number.isInteger(inicio) || !Number.isInteger(fim)) continue;

      const min = Math.min(inicio, fim);
      const max = Math.max(inicio, fim);
      if (max - min > MAX_INTERVALO) continue;

      for (let i = min; i <= max && torres.size < MAX_TORRES; i += 1) {
        torres.add(String(i));
      }
      continue;
    }

    // Alphanumeric token with letter suffix (e.g., "1A", "163B") — check before pure numeric
    if (/^\d+[A-Za-z]$/.test(token)) {
      torres.add(token.toUpperCase());
      continue;
    }

    // Pure numeric token (including 0 for portico)
    const torre = parseNumero(token);
    if (Number.isInteger(torre) && torre >= 0) {
      torres.add(String(torre));
    }
  }

  return [...torres].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
}

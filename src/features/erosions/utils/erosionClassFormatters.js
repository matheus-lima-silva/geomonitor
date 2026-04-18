// Rotulos e classificacao de faixas tecnicas de uma erosao.
// Extraido de ErosionDetailsModal para ser reusado tambem pelo gerador de PDF
// (erosionPdfTemplates.js), garantindo que o PDF apresente as mesmas faixas
// formatadas ("P2 (> 1 a 10 m)") em vez de numeros crus.

export const CLASS_RANGE_LABELS = {
  profundidade: {
    P1: '<= 1 m',
    P2: '> 1 a 10 m',
    P3: '> 10 a 30 m',
    P4: '> 30 m',
  },
  declividade: {
    D1: '< 10 graus',
    D2: '10 a 25 graus',
    D3: '25 a 45 graus',
    D4: '> 45 graus',
  },
  exposicao: {
    E1: '> 50 m',
    E2: '20 a 50 m',
    E3: '5 a < 20 m',
    E4: '< 5 m',
  },
};

const LEGACY_CLASS_CODE_ALIASES = {
  '<0.5': 'P1',
  '0.5-1.5': 'P2',
  '1.5-3.0': 'P3',
  '>3.0': 'P4',
  '<15': 'D1',
  '15-30': 'D2',
  '30-45': 'D3',
  '>45': 'D4',
};

export function deriveDepthClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 1) return 'P1';
  if (value <= 10) return 'P2';
  if (value <= 30) return 'P3';
  return 'P4';
}

export function deriveSlopeClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 10) return 'D1';
  if (value <= 25) return 'D2';
  if (value <= 45) return 'D3';
  return 'D4';
}

export function deriveExposureClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value > 50) return 'E1';
  if (value >= 20) return 'E2';
  if (value >= 5) return 'E3';
  return 'E4';
}

export function resolveClassCode(rawClassCode, rangeLabels, fallbackClassCode = '') {
  const raw = String(rawClassCode || '').trim();
  if (raw && rangeLabels[raw]) return raw;
  if (raw && LEGACY_CLASS_CODE_ALIASES[raw]) return LEGACY_CLASS_CODE_ALIASES[raw];
  return fallbackClassCode;
}

export function formatClassWithRange(classCode, rangeLabels = {}) {
  const code = String(classCode || '').trim();
  if (!code) return '-';
  const range = rangeLabels[code];
  return range ? `${code} (${range})` : code;
}

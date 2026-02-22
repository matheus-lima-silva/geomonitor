import { erosionStatusClass, normalizeErosionStatus, normalizeUserStatus } from '../statusUtils';

describe('normalizeUserStatus', () => {
  it('normaliza pendente e inativo', () => {
    expect(normalizeUserStatus('pending')).toBe('Pendente');
    expect(normalizeUserStatus('desativado')).toBe('Inativo');
  });

  it('usa ativo como fallback', () => {
    expect(normalizeUserStatus('')).toBe('Ativo');
    expect(normalizeUserStatus('qualquer')).toBe('Ativo');
  });
});

describe('normalizeErosionStatus', () => {
  it('normaliza monitoramento e estabilizado', () => {
    expect(normalizeErosionStatus('monitoring')).toBe('Monitoramento');
    expect(normalizeErosionStatus('estabilizado')).toBe('Estabilizado');
    expect(normalizeErosionStatus('resolvida')).toBe('Estabilizado');
  });

  it('usa ativo como fallback', () => {
    expect(normalizeErosionStatus(undefined)).toBe('Ativo');
  });
});

describe('erosionStatusClass', () => {
  it('retorna a classe correta por status normalizado', () => {
    expect(erosionStatusClass('resolved')).toBe('status-chip status-ok');
    expect(erosionStatusClass('estabilizado')).toBe('status-chip status-ok');
    expect(erosionStatusClass('monitoramento')).toBe('status-chip status-warn');
    expect(erosionStatusClass('ativo')).toBe('status-chip status-danger');
  });
});

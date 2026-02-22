export function normalizeUserStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['pendente', 'pending', 'aguardando'].includes(normalized)) return 'Pendente';
  if (['inativo', 'inactive', 'desativado', 'off'].includes(normalized)) return 'Inativo';
  return 'Ativo';
}

export function normalizeErosionStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['monitorado', 'monitoramento', 'monitoring'].includes(normalized)) return 'Monitoramento';
  if (['estabilizado', 'stabilized'].includes(normalized)) return 'Estabilizado';
  if (['resolvido', 'resolved', 'resolvida'].includes(normalized)) return 'Estabilizado';
  return 'Ativo';
}

export function erosionStatusClass(status) {
  const normalized = normalizeErosionStatus(status);
  if (normalized === 'Estabilizado') return 'status-chip status-ok';
  if (normalized === 'Monitoramento') return 'status-chip status-warn';
  return 'status-chip status-danger';
}

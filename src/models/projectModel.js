export const createEmptyProject = () => ({
  nome: '',
  codigo: '',
  totalTorres: 0,
  coordenadasPorTorre: '{}',
});

function parseCoordinates(value) {
  if (typeof value === 'object' && value !== null) return value;
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export const normalizeProjectPayload = (project) => ({
  nome: project.nome.trim(),
  codigo: project.codigo.trim(),
  totalTorres: Number(project.totalTorres) || 0,
  coordenadasPorTorre: parseCoordinates(project.coordenadasPorTorre),
});

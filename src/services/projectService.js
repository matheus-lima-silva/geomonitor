import { createCrudService } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'projects',
  itemName: 'Projeto'
});

export function subscribeProjects(onData, onError) {
  return service.subscribe(onData, onError);
}

export async function createProject(project, meta = {}) {
  const result = await service.create(project, meta, (p) => String(p.id || '').trim().toUpperCase());
  // Mantém a compatibilidade com o retorno anterior
  return { id: result?.data?.id || String(project.id).trim().toUpperCase() };
}

export async function updateProject(id, project, meta = {}) {
  const result = await service.update(id, project, meta);
  return { id: result?.data?.id || id };
}

export async function removeProject(projectOrId) {
  return service.remove(projectOrId);
}

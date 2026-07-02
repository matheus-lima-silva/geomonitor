import { createCrudService } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'projects',
  itemName: 'Projeto'
});

export function subscribeProjects(onData, onError) {
  return service.subscribe(onData, onError);
}

// Busca pontual (nao-subscription) — usado por telas que so precisam de uma
// lista para vincular/selecionar (ex.: cadastro de usina do modulo PAEC).
export async function listProjects() {
  const result = await service.list();
  return result?.data || [];
}

export async function createProject(project, meta = {}) {
  const result = await service.create(project, meta, (p) => String(p.id || '').trim().toUpperCase());
  // Mantém a compatibilidade com o retorno anterior
  return { id: result?.data?.id || String(project.id).trim().toUpperCase() };
}

export async function updateProject(id, project, meta = {}, options = {}) {
  const result = await service.update(id, project, meta, options);
  return { id: result?.data?.id || id };
}

export async function removeProject(projectOrId) {
  return service.remove(projectOrId);
}

import { subscribeProjects as subscribeProjectsFeature, saveProject, deleteProject } from '../features/projects/services/projectService';

export function subscribeProjects(onData, onError) {
  return subscribeProjectsFeature(onData, onError);
}

export function createProject(project, meta = {}) {
  const id = String(project.id || '').trim().toUpperCase();
  if (!id) throw new Error('Projeto precisa de ID');
  return saveProject(id, project, meta).then(() => ({ id }));
}

export function updateProject(id, project, meta = {}) {
  return saveProject(id, project, { ...meta, merge: true });
}

export function removeProject(id) {
  return deleteProject(id);
}

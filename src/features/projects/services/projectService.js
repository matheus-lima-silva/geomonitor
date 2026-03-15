import {
  removeProject,
  subscribeProjects as subscribeProjectsApi,
  updateProject,
} from '../../../services/projectService';

export function subscribeProjects(onData, onError) {
  return subscribeProjectsApi(onData, onError);
}

export function saveProject(projectId, payload, meta = {}) {
  return updateProject(projectId, payload, meta);
}

export function deleteProject(projectId) {
  return removeProject(projectId);
}

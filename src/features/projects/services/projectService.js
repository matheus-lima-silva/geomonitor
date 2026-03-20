import {
  removeProject,
  subscribeProjects as subscribeProjectsApi,
  updateProject,
} from '../../../services/projectService';

export function subscribeProjects(onData, onError) {
  return subscribeProjectsApi(onData, onError);
}

export function saveProject(projectId, payload, meta = {}, options = {}) {
  return updateProject(projectId, payload, meta, options);
}

export function deleteProject(projectId) {
  return removeProject(projectId);
}

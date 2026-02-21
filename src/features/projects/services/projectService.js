import { deleteDocById, saveDoc, subscribeCollection } from '../../../services/firestoreClient';

export function subscribeProjects(onData, onError) {
  return subscribeCollection('projects', onData, onError);
}

export function saveProject(projectId, payload, meta = {}) {
  return saveDoc('projects', projectId, payload, meta);
}

export function deleteProject(projectId) {
  return deleteDocById('projects', projectId);
}

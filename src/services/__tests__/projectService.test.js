import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../features/projects/services/projectService', () => ({
  deleteProject: vi.fn(),
  saveProject: vi.fn(),
  subscribeProjects: vi.fn(),
}));

import {
  deleteProject,
  saveProject,
  subscribeProjects as subscribeProjectsFeature,
} from '../../features/projects/services/projectService';
import {
  createProject,
  removeProject,
  subscribeProjects,
  updateProject,
} from '../projectService';

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribeProjects delega para o serviço de feature', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeProjectsFeature).mockReturnValue('UNSUB');

    const unsub = subscribeProjects(onData, onError);

    expect(subscribeProjectsFeature).toHaveBeenCalledWith(onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('createProject normaliza ID e retorna objeto com id', async () => {
    vi.mocked(saveProject).mockResolvedValue(undefined);

    await expect(createProject({ id: ' lt-99 ' }, { updatedBy: 'ops@empresa.com' })).resolves.toEqual({
      id: 'LT-99',
    });

    expect(saveProject).toHaveBeenCalledWith(
      'LT-99',
      { id: ' lt-99 ' },
      { updatedBy: 'ops@empresa.com' },
    );
  });

  it('createProject falha sem ID válido', () => {
    expect(() => createProject({ id: '   ' })).toThrow('Projeto precisa de ID');
    expect(saveProject).not.toHaveBeenCalled();
  });

  it('updateProject força merge true', async () => {
    vi.mocked(saveProject).mockResolvedValue(undefined);

    await updateProject('P-1', { nome: 'P1' }, { merge: false, updatedBy: 'dev@empresa.com' });

    expect(saveProject).toHaveBeenCalledWith(
      'P-1',
      { nome: 'P1' },
      { merge: true, updatedBy: 'dev@empresa.com' },
    );
  });

  it('removeProject delega exclusão', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);

    await removeProject('P-1');

    expect(deleteProject).toHaveBeenCalledWith('P-1');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/projectService', () => ({
  removeProject: vi.fn(),
  subscribeProjects: vi.fn(),
  updateProject: vi.fn(),
}));

import {
  removeProject,
  subscribeProjects as subscribeProjectsApi,
  updateProject,
} from '../../../../services/projectService';
import {
  deleteProject,
  saveProject,
  subscribeProjects,
} from '../projectService';

describe('features/projects/services/projectService', () => {
  it('subscribeProjects delega para serviço API central', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    const unsub = vi.fn();
    vi.mocked(subscribeProjectsApi).mockReturnValue(unsub);

    const result = subscribeProjects(onData, onError);

    expect(subscribeProjectsApi).toHaveBeenCalledWith(onData, onError);
    expect(result).toBe(unsub);
  });

  it('saveProject delega update preservando payload HATEOAS', async () => {
    const payload = {
      id: 'P-1',
      nome: 'Projeto A',
      _links: {
        update: { href: '/api/projects/P-1', method: 'PUT' }
      }
    };
    vi.mocked(updateProject).mockResolvedValue({ id: 'P-1' });

    await expect(saveProject('P-1', payload, { updatedBy: 'qa@empresa.com' })).resolves.toEqual({ id: 'P-1' });

    expect(updateProject).toHaveBeenCalledWith('P-1', payload, { updatedBy: 'qa@empresa.com' }, {});
  });

  it('deleteProject delega remoção com id', async () => {
    vi.mocked(removeProject).mockResolvedValue({});

    await expect(deleteProject('P-1')).resolves.toEqual({});

    expect(removeProject).toHaveBeenCalledWith('P-1');
  });
});
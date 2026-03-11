import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../features/projects/services/projectService', () => ({
  subscribeProjects: vi.fn()
}));

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { subscribeProjects as subscribeProjectsFeature } from '../../features/projects/services/projectService';
import { auth } from '../../firebase/config';
import { createProject, removeProject, subscribeProjects, updateProject } from '../projectService';

describe('projectService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  it('subscribeProjects delega para o service de feature', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeProjectsFeature).mockReturnValue('UNSUB');

    const unsub = subscribeProjects(onData, onError);

    expect(subscribeProjectsFeature).toHaveBeenCalledWith(onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('createProject normaliza id, envia POST e retorna id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(
      createProject({ id: ' lt-99 ' }, { updatedBy: 'ops@empresa.com' })
    ).resolves.toEqual({ id: 'LT-99' });

    expect(auth.currentUser.getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/projects');

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(request.body)).toEqual({
      data: { id: 'LT-99' },
      meta: { updatedBy: 'ops@empresa.com' }
    });
  });

  it('createProject falha sem id valido', async () => {
    await expect(createProject({ id: '   ' })).rejects.toThrow('Projeto precisa de ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createProject falha sem token de autenticacao', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('')
    };

    await expect(createProject({ id: 'P-1' })).rejects.toThrow(/autenticado/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updateProject envia PUT com payload esperado', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(
      updateProject('P-1', { nome: 'Projeto 1' }, { updatedBy: 'dev@empresa.com' })
    ).resolves.toEqual({ id: 'P-1' });

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('PUT');
    expect(JSON.parse(request.body)).toEqual({
      data: { nome: 'Projeto 1' },
      meta: { updatedBy: 'dev@empresa.com' }
    });
  });

  it('removeProject envia DELETE com auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(removeProject('P-1')).resolves.toBeUndefined();

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('DELETE');
    expect(request.headers.Authorization).toBe('Bearer token-123');
  });

  it('propaga erro de API ao criar projeto', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'Falha API' })
    });

    await expect(createProject({ id: 'P-1' })).rejects.toThrow('Falha API');
  });
});

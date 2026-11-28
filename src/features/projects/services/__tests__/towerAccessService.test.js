import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../utils/apiClient', () => ({ fetchWithHateoas: vi.fn() }));
vi.mock('../../../../utils/serviceFactory', () => ({ API_BASE_URL: 'http://api' }));

import { fetchWithHateoas } from '../../../../utils/apiClient';
import {
  createTowerAccesses,
  deleteTowerAccess,
  listTowerAccesses,
  previewTowerAccesses,
  updateTowerAccess,
} from '../towerAccessService';

const links = {
  preview: { href: 'http://api/projects/P1/accesses/preview', method: 'POST' },
  create: { href: 'http://api/projects/P1/accesses', method: 'POST' },
};

describe('towerAccessService', () => {
  beforeEach(() => vi.mocked(fetchWithHateoas).mockReset());

  it('lista pela colecao do projeto e devolve os _links', async () => {
    vi.mocked(fetchWithHateoas).mockResolvedValue({ data: [{ id: 'ACC-1' }], _links: links });
    const result = await listTowerAccesses('P 1');
    expect(fetchWithHateoas).toHaveBeenCalledWith({ href: 'http://api/projects/P%201/accesses', method: 'GET' });
    expect(result).toEqual({ items: [{ id: 'ACC-1' }], links });
  });

  it('previa e gravacao seguem os _links recebidos', async () => {
    vi.mocked(fetchWithHateoas).mockResolvedValue({ data: { items: [], meta: {} } });
    await previewTowerAccesses(links, [{ id: 'f1' }], { arquivo: 'a.kmz' });
    expect(fetchWithHateoas).toHaveBeenLastCalledWith(links.preview, { data: { features: [{ id: 'f1' }], source: { arquivo: 'a.kmz' } } });

    vi.mocked(fetchWithHateoas).mockResolvedValue({ data: [{ id: 'ACC-2' }] });
    const saved = await createTowerAccesses(links, [{ kind: 'rota_guia' }], ['ACC-1']);
    expect(fetchWithHateoas).toHaveBeenLastCalledWith(links.create, { data: { items: [{ kind: 'rota_guia' }], replaceIds: ['ACC-1'] } });
    expect(saved).toEqual([{ id: 'ACC-2' }]);
  });

  it('edicao e remocao usam os _links do proprio acesso', async () => {
    const access = {
      id: 'ACC-1', towerNumber: '104', kind: 'acesso', name: 'A', segments: [],
      _links: { update: { href: 'u', method: 'PUT' }, delete: { href: 'd', method: 'DELETE' } },
    };
    vi.mocked(fetchWithHateoas).mockResolvedValue({ data: { id: 'ACC-1' } });
    await updateTowerAccess(access, { segments: [{ tipo: 'terra' }] });
    expect(fetchWithHateoas).toHaveBeenLastCalledWith(access._links.update, {
      data: { towerNumber: '104', kind: 'acesso', name: 'A', segments: [{ tipo: 'terra' }] },
    });
    await deleteTowerAccess(access);
    expect(fetchWithHateoas).toHaveBeenLastCalledWith(access._links.delete);
  });
});

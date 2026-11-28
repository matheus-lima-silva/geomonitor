import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../utils/apiClient', () => ({ fetchWithHateoas: vi.fn() }));
vi.mock('../../../../utils/serviceFactory', () => ({ API_BASE_URL: 'http://api' }));

import { fetchWithHateoas } from '../../../../utils/apiClient';
import { indexByTower, listTowerEnvironment } from '../towerEnvironmentService';

describe('towerEnvironmentService', () => {
  beforeEach(() => vi.mocked(fetchWithHateoas).mockReset());

  it('busca o meio fisico do projeto e indexa por torre', async () => {
    vi.mocked(fetchWithHateoas).mockResolvedValue({ data: [{ towerNumber: '104', elevacaoM: 659 }, { towerNumber: ' 105 ' }] });
    const items = await listTowerEnvironment('ARAPCA');
    expect(fetchWithHateoas).toHaveBeenCalledWith({ href: 'http://api/projects/ARAPCA/tower-environment', method: 'GET' });
    const index = indexByTower(items);
    expect(index.get('104').elevacaoM).toBe(659);
    expect(index.has('105')).toBe(true);
  });

  it('resposta sem lista vira lista vazia', async () => {
    vi.mocked(fetchWithHateoas).mockResolvedValue({});
    expect(await listTowerEnvironment('X')).toEqual([]);
  });
});

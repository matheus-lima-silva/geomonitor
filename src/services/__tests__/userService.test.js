import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firestoreClient', () => ({
  deleteDocById: vi.fn(),
  saveDoc: vi.fn(),
  subscribeCollection: vi.fn(),
}));

import { deleteDocById, saveDoc, subscribeCollection } from '../firestoreClient';
import { deleteUser, saveUser, subscribeUsers } from '../userService';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribeUsers delega para coleção users', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeCollection).mockReturnValue('UNSUB');

    const unsub = subscribeUsers(onData, onError);

    expect(subscribeCollection).toHaveBeenCalledWith('users', onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('saveUser aplica id no payload e merge true', async () => {
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    await saveUser('U-1', { nome: 'Ana' }, { updatedBy: 'admin@empresa.com', merge: false });

    expect(saveDoc).toHaveBeenCalledWith(
      'users',
      'U-1',
      { nome: 'Ana', id: 'U-1' },
      { updatedBy: 'admin@empresa.com', merge: true },
    );
  });

  it('deleteUser delega exclusão', async () => {
    vi.mocked(deleteDocById).mockResolvedValue(undefined);

    await deleteUser('U-1');

    expect(deleteDocById).toHaveBeenCalledWith('users', 'U-1');
  });
});

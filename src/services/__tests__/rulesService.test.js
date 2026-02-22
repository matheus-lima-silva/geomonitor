import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
}));

vi.mock('../firestoreClient', () => ({
  docRef: vi.fn(),
  saveDoc: vi.fn(),
}));

import { onSnapshot } from 'firebase/firestore';
import { docRef, saveDoc } from '../firestoreClient';
import { saveRulesConfig, subscribeRulesConfig } from '../rulesService';

describe('rulesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribeRulesConfig assina config/rules e envia snapshot existente', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(docRef).mockReturnValue('RULES_DOC_REF');
    vi.mocked(onSnapshot).mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({ regra: 'ok' }),
      });
      return 'UNSUB';
    });

    const unsub = subscribeRulesConfig(onData, onError);

    expect(docRef).toHaveBeenCalledWith('config', 'rules');
    expect(onSnapshot).toHaveBeenCalledWith('RULES_DOC_REF', expect.any(Function), onError);
    expect(onData).toHaveBeenCalledWith({ regra: 'ok' });
    expect(unsub).toBe('UNSUB');
  });

  it('subscribeRulesConfig envia null quando snapshot não existe', () => {
    const onData = vi.fn();
    vi.mocked(docRef).mockReturnValue('RULES_DOC_REF');
    vi.mocked(onSnapshot).mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => false,
      });
      return 'UNSUB';
    });

    subscribeRulesConfig(onData, vi.fn());

    expect(onData).toHaveBeenCalledWith(null);
  });

  it('saveRulesConfig salva sempre com merge true', async () => {
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    await saveRulesConfig({ a: 1 }, { merge: false, updatedBy: 'ops@empresa.com' });

    expect(saveDoc).toHaveBeenCalledWith(
      'config',
      'rules',
      { a: 1 },
      { merge: true, updatedBy: 'ops@empresa.com' },
    );
  });
});

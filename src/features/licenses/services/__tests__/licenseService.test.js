import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/licenseService', () => ({
  deleteOperatingLicense: vi.fn(),
  saveOperatingLicense: vi.fn(),
  subscribeOperatingLicenses: vi.fn(),
}));

import {
  deleteOperatingLicense as removeOperatingLicense,
  saveOperatingLicense as saveOperatingLicenseApi,
  subscribeOperatingLicenses as subscribeOperatingLicensesApi,
} from '../../../../services/licenseService';
import {
  deleteOperatingLicense,
  saveOperatingLicense,
  subscribeOperatingLicenses,
} from '../licenseService';

describe('features/licenses/services/licenseService', () => {
  it('subscribeOperatingLicenses delega para serviço API central', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    const unsub = vi.fn();
    vi.mocked(subscribeOperatingLicensesApi).mockReturnValue(unsub);

    const result = subscribeOperatingLicenses(onData, onError);

    expect(subscribeOperatingLicensesApi).toHaveBeenCalledWith(onData, onError);
    expect(result).toBe(unsub);
  });

  it('saveOperatingLicense delega update preservando payload HATEOAS', async () => {
    const payload = {
      id: 'LO-1',
      _links: {
        update: { href: '/api/licenses/LO-1', method: 'PUT' }
      }
    };
    vi.mocked(saveOperatingLicenseApi).mockResolvedValue({ id: 'LO-1' });

    await expect(saveOperatingLicense('LO-1', payload, { updatedBy: 'qa@empresa.com' })).resolves.toEqual({ id: 'LO-1' });

    expect(saveOperatingLicenseApi).toHaveBeenCalledWith('LO-1', payload, { updatedBy: 'qa@empresa.com' });
  });

  it('deleteOperatingLicense delega remoção com id', async () => {
    vi.mocked(removeOperatingLicense).mockResolvedValue({});

    await expect(deleteOperatingLicense('LO-1')).resolves.toEqual({});

    expect(removeOperatingLicense).toHaveBeenCalledWith('LO-1');
  });
});
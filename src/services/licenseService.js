import { createCrudService } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'licenses',
  itemName: 'Licença'
});

export function subscribeOperatingLicenses(onData, onError) {
  return service.subscribe(onData, onError);
}

export async function saveOperatingLicense(id, payload, meta = {}) {
  return service.save(id, payload, meta);
}

export async function deleteOperatingLicense(licenseOrId) {
  return service.remove(licenseOrId);
}

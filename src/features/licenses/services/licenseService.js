import { deleteDocById, saveDoc, subscribeCollection } from '../../../services/firestoreClient';

export function subscribeOperatingLicenses(onData, onError) {
  return subscribeCollection('operatingLicenses', onData, onError);
}

export function saveOperatingLicense(licenseId, payload, meta = {}) {
  return saveDoc('operatingLicenses', licenseId, payload, meta);
}

export function deleteOperatingLicense(licenseId) {
  return deleteDocById('operatingLicenses', licenseId);
}

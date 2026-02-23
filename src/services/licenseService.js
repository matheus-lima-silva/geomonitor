import {
  deleteOperatingLicense as deleteOperatingLicenseFeature,
  saveOperatingLicense as saveOperatingLicenseFeature,
  subscribeOperatingLicenses as subscribeOperatingLicensesFeature,
} from '../features/licenses/services/licenseService';

export function subscribeOperatingLicenses(onData, onError) {
  return subscribeOperatingLicensesFeature(onData, onError);
}

export function saveOperatingLicense(id, payload, meta = {}) {
  return saveOperatingLicenseFeature(id, payload, meta);
}

export function deleteOperatingLicense(id) {
  return deleteOperatingLicenseFeature(id);
}

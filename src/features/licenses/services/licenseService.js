import {
  deleteOperatingLicense as removeOperatingLicense,
  saveOperatingLicense as saveOperatingLicenseApi,
  subscribeOperatingLicenses as subscribeOperatingLicensesApi,
} from '../../../services/licenseService';

export function subscribeOperatingLicenses(onData, onError) {
  return subscribeOperatingLicensesApi(onData, onError);
}

export function saveOperatingLicense(licenseId, payload, meta = {}) {
  return saveOperatingLicenseApi(licenseId, payload, meta);
}

export function deleteOperatingLicense(licenseId) {
  return removeOperatingLicense(licenseId);
}

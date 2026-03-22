const createCrudRouter = require('../utils/crudFactory');
const { operatingLicenseRepository } = require('../repositories');

const router = createCrudRouter('operatingLicenses', {
    repository: operatingLicenseRepository,
    routerName: 'licenses',
    generateId: (data) => data.id ? String(data.id).trim() : ''
});

module.exports = router;

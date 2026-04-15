const createCrudRouter = require('../utils/crudFactory');
const { operatingLicenseRepository } = require('../repositories');
const { licenseCreateSchema, licenseUpdateSchema } = require('../schemas/licenseSchemas');

const router = createCrudRouter('operatingLicenses', {
    repository: operatingLicenseRepository,
    routerName: 'licenses',
    generateId: (data) => data.id ? String(data.id).trim() : '',
    createSchema: licenseCreateSchema,
    updateSchema: licenseUpdateSchema,
});

module.exports = router;

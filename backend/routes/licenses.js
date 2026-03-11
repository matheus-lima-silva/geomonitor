const createCrudRouter = require('../utils/crudFactory');

const router = createCrudRouter('operatingLicenses', {
    routerName: 'licenses',
    generateId: (data) => data.id ? String(data.id).trim() : ''
});

module.exports = router;

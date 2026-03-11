const createCrudRouter = require('../utils/crudFactory');

const router = createCrudRouter('projects', {
    generateId: (data) => data.id ? String(data.id).trim().toUpperCase() : ''
});

module.exports = router;

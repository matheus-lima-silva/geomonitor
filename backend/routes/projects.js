const createCrudRouter = require('../utils/crudFactory');
const { projectRepository } = require('../repositories');

const router = createCrudRouter('projects', {
    repository: projectRepository,
    generateId: (data) => data.id ? String(data.id).trim().toUpperCase() : ''
});

module.exports = router;

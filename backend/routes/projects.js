const createCrudRouter = require('../utils/crudFactory');
const { projectRepository } = require('../repositories');
const { projectCreateSchema, projectUpdateSchema } = require('../schemas/projectSchemas');

const router = createCrudRouter('projects', {
    repository: projectRepository,
    generateId: (data) => data.id ? String(data.id).trim().toUpperCase() : '',
    createSchema: projectCreateSchema,
    updateSchema: projectUpdateSchema,
});

module.exports = router;

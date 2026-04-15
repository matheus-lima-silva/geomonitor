const crypto = require('crypto');
const createCrudRouter = require('../utils/crudFactory');
const { inspectionRepository } = require('../repositories');
const { inspectionCreateSchema, inspectionUpdateSchema } = require('../schemas/inspectionSchemas');

const router = createCrudRouter('inspections', {
    repository: inspectionRepository,
    generateId: (data) => String(data.id || '').trim() || `VS-${crypto.randomUUID()}`,
    prepareData: (data) => ({
        ...data,
        dataFim: data.dataFim || data.dataInicio,
        detalhesDias: Array.isArray(data.detalhesDias) ? data.detalhesDias : [],
    }),
    createSchema: inspectionCreateSchema,
    updateSchema: inspectionUpdateSchema,
});

module.exports = router;

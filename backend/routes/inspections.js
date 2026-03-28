const createCrudRouter = require('../utils/crudFactory');
const { inspectionRepository } = require('../repositories');

const router = createCrudRouter('inspections', {
    repository: inspectionRepository,
    generateId: (data) => String(data.id || '').trim() || `VS-${Date.now()}`,
    prepareData: (data) => ({
        ...data,
        dataFim: data.dataFim || data.dataInicio,
        detalhesDias: Array.isArray(data.detalhesDias) ? data.detalhesDias : [],
    })
});

module.exports = router;

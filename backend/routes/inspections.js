const createCrudRouter = require('../utils/crudFactory');

const router = createCrudRouter('inspections', {
    generateId: (data) => String(data.id || '').trim() || `VS-${Date.now()}`,
    prepareData: (data) => ({
        ...data,
        dataFim: data.dataFim || data.dataInicio,
        detalhesDias: Array.isArray(data.detalhesDias) ? data.detalhesDias : [],
    })
});

module.exports = router;

const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    tableName: 'inspections',
    projectIdFields: ['projectId', 'projetoId'],
});

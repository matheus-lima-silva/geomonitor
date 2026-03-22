const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    firestoreCollection: 'inspections',
    tableName: 'inspections',
    projectIdFields: ['projectId', 'projetoId'],
});

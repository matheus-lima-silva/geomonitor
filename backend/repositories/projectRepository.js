const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    firestoreCollection: 'projects',
    tableName: 'projects',
    projectIdFields: ['id', 'projectId', 'projetoId'],
});

const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    firestoreCollection: 'users',
    tableName: 'users',
    projectIdFields: ['projectId', 'projetoId'],
});

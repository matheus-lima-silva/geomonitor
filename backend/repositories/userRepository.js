const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    tableName: 'users',
    projectIdFields: ['projectId', 'projetoId'],
});

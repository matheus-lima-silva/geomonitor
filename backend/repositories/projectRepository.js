const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    tableName: 'projects',
    projectIdFields: ['id', 'projectId', 'projetoId'],
});

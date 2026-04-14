const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    tableName: 'operating_licenses',
    projectIdFields: ['projectId', 'projetoId'],
});

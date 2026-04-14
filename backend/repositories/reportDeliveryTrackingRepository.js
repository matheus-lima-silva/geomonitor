const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    tableName: 'report_delivery_tracking',
    projectIdFields: ['projectId', 'projetoId'],
});

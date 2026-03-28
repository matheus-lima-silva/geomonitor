const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    firestoreCollection: 'reportDeliveryTracking',
    tableName: 'report_delivery_tracking',
    projectIdFields: ['projectId', 'projetoId'],
});

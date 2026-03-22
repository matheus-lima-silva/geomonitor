const createDocumentTableRepository = require('./createDocumentTableRepository');

module.exports = createDocumentTableRepository({
    firestoreCollection: 'operatingLicenses',
    tableName: 'operating_licenses',
    projectIdFields: ['projectId', 'projetoId'],
});

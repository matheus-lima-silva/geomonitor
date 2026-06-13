const createDocumentTableRepository = require('./createDocumentTableRepository');
const projectGeometryRepository = require('./projectGeometryRepository');
const { normalizeText } = require('./common');

const base = createDocumentTableRepository({
    tableName: 'projects',
    projectIdFields: ['id', 'projectId', 'projetoId'],
});

// Apos salvar o projeto, reconstroi a geometria materializada (eixo + torres) a
// partir do payload (project_geometries). Falha na geometria NAO quebra o save —
// e uma projecao derivada, secundaria ao dado canonico.
async function save(payload, options = {}) {
    const saved = await base.save(payload, options);
    try {
        const projectId = normalizeText(saved?.id) || normalizeText(payload?.id);
        if (projectId) await projectGeometryRepository.upsertFromProject(projectId);
    } catch (error) {
        console.error('[projects] falha ao reconstruir project_geometries:', error);
    }
    return saved;
}

module.exports = {
    ...base,
    save,
};

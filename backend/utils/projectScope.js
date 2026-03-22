function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeKey(value) {
    return normalizeText(value).toUpperCase();
}

function matchesProject(data = {}, projectId) {
    const expected = normalizeKey(projectId);
    if (!expected) return false;

    const candidates = [
        data.projectId,
        data.project_id,
        data.empreendimentoId,
        data.empreendimento_id,
        data.projetoId,
        data.projeto_id,
        data.project?.id,
    ];

    return candidates.some((candidate) => normalizeKey(candidate) === expected);
}

module.exports = {
    normalizeText,
    normalizeKey,
    matchesProject,
};

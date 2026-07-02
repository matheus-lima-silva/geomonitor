// Pendencias de uma ficha PAEC: manifest do template x valores preenchidos.
// Funcao pura — fonte unica usada por GET /api/paec/plants/:id, pelo
// buildPaecContext (worker) e refletida no resultMeta do job.
//
// Fase 1: campo requerido sem valor + todos os blocos do manifest (tabelas de
// brigadistas etc. ainda nao editaveis — pendencia manual fixa ate a fase 2).

function normalizeValue(value) {
    return value == null ? '' : String(value).trim();
}

function computePendencies(manifest, fieldsMap) {
    const fields = Array.isArray(manifest?.fields) ? manifest.fields : [];
    const blocks = Array.isArray(manifest?.blocks) ? manifest.blocks : [];
    const values = fieldsMap && typeof fieldsMap === 'object' ? fieldsMap : {};

    const pendencies = [];
    for (const field of fields) {
        if (field.required === false) continue;
        if (normalizeValue(values[field.key]) === '') {
            pendencies.push({
                kind: 'field',
                key: field.key,
                label: field.label || field.key,
                section: field.section || null,
            });
        }
    }
    for (const block of blocks) {
        pendencies.push({
            kind: block.kind === 'manual' ? 'manual_block' : 'list',
            key: block.key,
            label: block.label || block.key,
            section: null,
        });
    }
    return pendencies;
}

function computeStats(manifest, fieldsMap) {
    const fields = Array.isArray(manifest?.fields) ? manifest.fields : [];
    const values = fieldsMap && typeof fieldsMap === 'object' ? fieldsMap : {};
    const total = fields.length;
    const filled = fields.filter((f) => normalizeValue(values[f.key]) !== '').length;
    return { fieldsFilled: filled, fieldsTotal: total };
}

module.exports = {
    computePendencies,
    computeStats,
};

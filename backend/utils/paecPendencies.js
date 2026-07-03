// Pendencias de uma ficha PAEC: manifest do template x valores preenchidos.
// Funcao pura — fonte unica usada por GET /api/paec/plants/:id, pelo
// buildPaecContext (worker) e refletida no resultMeta do job.
//
// Fase 1: campo requerido sem valor + blocos manual do manifest (anexos que
// ainda sao "copiar do anterior", sem edicao estruturada — pendencia fixa).
// Fase 2: blocos kind=list viram pendencia so quando NAO tem nenhuma linha
// salva em paec_plant_list_items — com pelo menos 1 item, o bloco conta como
// preenchido (a ficha nao exige um numero minimo de linhas).
// Fase 4: imageSlots viram pendencia so quando NAO tem nenhuma imagem salva
// em paec_plant_assets — mesma regra dos blocos list (1 imagem ja conta,
// maxImages e teto de UI, nao minimo).

function normalizeValue(value) {
    return value == null ? '' : String(value).trim();
}

function computePendencies(manifest, fieldsMap, listItemsMap, assetsMap) {
    const fields = Array.isArray(manifest?.fields) ? manifest.fields : [];
    const blocks = Array.isArray(manifest?.blocks) ? manifest.blocks : [];
    const imageSlots = Array.isArray(manifest?.imageSlots) ? manifest.imageSlots : [];
    const values = fieldsMap && typeof fieldsMap === 'object' ? fieldsMap : {};
    const listItems = listItemsMap && typeof listItemsMap === 'object' ? listItemsMap : {};
    const assets = assetsMap && typeof assetsMap === 'object' ? assetsMap : {};

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
        if (block.kind === 'list') {
            const rows = Array.isArray(listItems[block.key]) ? listItems[block.key] : [];
            if (rows.length > 0) continue;
            pendencies.push({ kind: 'list', key: block.key, label: block.label || block.key, section: null });
            continue;
        }
        pendencies.push({
            kind: 'manual_block',
            key: block.key,
            label: block.label || block.key,
            section: null,
        });
    }
    for (const slot of imageSlots) {
        const mediaIds = Array.isArray(assets[slot.assetKey]) ? assets[slot.assetKey] : [];
        if (mediaIds.length > 0) continue;
        pendencies.push({
            kind: 'image',
            key: slot.assetKey,
            label: slot.label || slot.assetKey,
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

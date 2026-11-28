// Validacao do indice RUSLE contra torres vistoriadas (Fase 6,
// docs/plans/erosao-acessos-geodados.md). Funcoes puras: a consulta fica em
// towerEnvironmentRepository.listForRusleValidation.
//
// AUC (Mann-Whitney): chance de uma torre com erosao ter valor maior que uma sem
// erosao. 0,5 = acaso, 1,0 = separacao perfeita. Empates contam meio.

/** rows: [{ erosao: 0|1, valor }] -> { auc, positivos, negativos } (auc null se faltar um grupo) */
function computeAuc(rows) {
    const pos = [];
    const neg = [];
    rows.forEach((r) => {
        if (!Number.isFinite(r.valor)) return;
        (r.erosao ? pos : neg).push(r.valor);
    });
    if (pos.length === 0 || neg.length === 0) return { auc: null, positivos: pos.length, negativos: neg.length };
    let score = 0;
    pos.forEach((a) => neg.forEach((b) => { score += a > b ? 1 : a === b ? 0.5 : 0; }));
    return { auc: score / (pos.length * neg.length), positivos: pos.length, negativos: neg.length };
}

/**
 * AUC so com pares do mesmo grupo (ex.: empreendimento), para tirar o efeito de
 * comparar regioes diferentes. rows: [{ grupo, erosao, valor }]
 */
function computeAucWithinGroups(rows) {
    const groups = new Map();
    rows.forEach((r) => {
        if (!Number.isFinite(r.valor)) return;
        if (!groups.has(r.grupo)) groups.set(r.grupo, { pos: [], neg: [] });
        groups.get(r.grupo)[r.erosao ? 'pos' : 'neg'].push(r.valor);
    });
    let score = 0;
    let pares = 0;
    groups.forEach(({ pos, neg }) => {
        pos.forEach((a) => neg.forEach((b) => { score += a > b ? 1 : a === b ? 0.5 : 0; pares += 1; }));
    });
    return { auc: pares ? score / pares : null, pares };
}

/** Taxa de erosao por classe. rows: [{ erosao, classe }] -> [{ classe, comErosao, total, taxa }] */
function erosionRateByClass(rows, classes = ['baixa', 'moderada', 'alta', 'muito_alta']) {
    return classes.map((classe) => {
        const subset = rows.filter((r) => r.classe === classe);
        const comErosao = subset.filter((r) => r.erosao).length;
        return { classe, comErosao, total: subset.length, taxa: subset.length ? comErosao / subset.length : null };
    });
}

module.exports = {
    computeAuc,
    computeAucWithinGroups,
    erosionRateByClass,
};

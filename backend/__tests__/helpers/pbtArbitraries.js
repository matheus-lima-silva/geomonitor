const fc = require('fast-check');

const roleArb = fc.constantFrom('owner', 'editor', 'viewer');

// 2-4 owners cobre o caso minimo de race (2) e casos maiores sem explodir a
// duracao dos testes. 1 owner nao gera race; >4 so aumenta custo sem achar
// novos contraexemplos.
const ownerCountArb = fc.integer({ min: 2, max: 4 });

function deleteMaskArb(n) {
    return fc.array(fc.boolean(), { minLength: n, maxLength: n });
}

// 2-6 operacoes concorrentes: o minimo da race e 2; >6 so encarece sem novos
// contraexemplos (mesma logica do ownerCountArb).
const concurrentCountArb = fc.integer({ min: 2, max: 6 });

// Estado inicial de uma foto no modelo de lixeira/archive.
const photoStateArb = fc.constantFrom('active', 'trash', 'archived');

// Transicoes disparaveis sobre uma foto (mapeiam 1:1 as rotas/repo functions).
const photoTransitionArb = fc.constantFrom('trash', 'restore', 'archive', 'unarchive');

function photoTransitionsArb(min = 2, max = 4) {
    return fc.array(photoTransitionArb, { minLength: min, maxLength: max });
}

module.exports = {
    roleArb,
    ownerCountArb,
    deleteMaskArb,
    concurrentCountArb,
    photoStateArb,
    photoTransitionArb,
    photoTransitionsArb,
};

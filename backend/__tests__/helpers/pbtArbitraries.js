const fc = require('fast-check');

const roleArb = fc.constantFrom('owner', 'editor', 'viewer');

// 2-4 owners cobre o caso minimo de race (2) e casos maiores sem explodir a
// duracao dos testes. 1 owner nao gera race; >4 so aumenta custo sem achar
// novos contraexemplos.
const ownerCountArb = fc.integer({ min: 2, max: 4 });

function deleteMaskArb(n) {
    return fc.array(fc.boolean(), { minLength: n, maxLength: n });
}

module.exports = {
    roleArb,
    ownerCountArb,
    deleteMaskArb,
};

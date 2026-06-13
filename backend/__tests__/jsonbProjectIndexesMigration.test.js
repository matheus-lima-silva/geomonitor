// Guarda estrutural da Fase 5a (migrations/0022_jsonb_project_indexes.sql): os
// indices de expressao precisam casar EXATAMENTE a expressao do WHERE de
// listByProject/countByProject em createDocumentTableRepository.js, senao o
// planner nao os usa. Se a expressao do repo mudar, este teste denuncia.
const fs = require('fs');
const path = require('path');

const MIGRATION = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '0022_jsonb_project_indexes.sql'),
    'utf8',
);
const REPO = fs.readFileSync(
    path.join(__dirname, '..', 'repositories', 'createDocumentTableRepository.js'),
    'utf8',
);

// A expressao canonica usada pelo factory quando projectIdFields = [projectId, projetoId].
const EXPR = "UPPER(COALESCE(payload->>'projectId', payload->>'projetoId', ''))";

const INDEXED_TABLES = ['inspections', 'operating_licenses', 'report_delivery_tracking'];

describe('0022_jsonb_project_indexes migration', () => {
    it('o factory ainda monta o WHERE com COALESCE/UPPER (premissa do indice)', () => {
        // se o repo deixar de usar COALESCE/UPPER, os indices de expressao param de
        // casar e este teste sinaliza que a migracao precisa ser revista.
        expect(REPO).toContain("payload->>'");
        expect(REPO).toMatch(/UPPER\(COALESCE\(/);
    });

    it.each(INDEXED_TABLES)('cria indice de expressao casando o WHERE em %s', (table) => {
        expect(MIGRATION).toContain(`ON ${table} ((${EXPR}))`);
        expect(MIGRATION).toContain('CREATE INDEX IF NOT EXISTS');
    });

    it('nao adiciona indices especulativos para campos filtrados so no frontend', () => {
        // numero/orgaoAmbiental/nome/tipo sao filtrados em JS hoje; indexa-los seria
        // custo de escrita sem query que os use (terreno da Fase 5c).
        expect(MIGRATION).not.toContain("payload->>'numero'");
        expect(MIGRATION).not.toContain("payload->>'orgaoAmbiental'");
        expect(MIGRATION).not.toContain("payload->>'nome'");
    });
});

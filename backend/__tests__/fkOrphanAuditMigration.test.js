// Guarda de completude da auditoria pre-FK (migrations/0018_fk_orphan_audit.sql).
// A migracao roda contra Postgres real (so verificavel com DB), mas a lista de
// relacoes auditadas tem que acompanhar as FKs virtuais do schema — este teste
// falha se alguma relacao esperada sair da migracao.
const fs = require('fs');
const path = require('path');

const SQL = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '0018_fk_orphan_audit.sql'),
    'utf8',
);

// (child, column, parent, pkCol) que a auditoria DEVE cobrir. pkCol e a coluna
// usada no marcador md5/entity_id (id na maioria; token/project_id em tabelas
// cuja PK nao e `id`).
const EXPECTED_RELATIONS = [
    ['report_workspaces', 'project_id', 'projects', 'id'],
    ['report_workspaces', 'inspection_id', 'inspections', 'id'],
    ['report_photos', 'workspace_id', 'report_workspaces', 'id'],
    ['report_photos', 'project_id', 'projects', 'id'],
    ['report_photos', 'media_asset_id', 'media_assets', 'id'],
    ['report_archives', 'compound_id', 'report_compounds', 'id'],
    ['license_conditions', 'license_id', 'operating_licenses', 'id'],
    ['erosions', 'project_id', 'projects', 'id'],
    ['report_jobs', 'workspace_id', 'report_workspaces', 'id'],
    ['report_jobs', 'project_id', 'projects', 'id'],
    ['report_jobs', 'compound_id', 'report_compounds', 'id'],
    ['report_jobs', 'dossier_id', 'project_dossiers', 'id'],
    ['project_dossiers', 'project_id', 'projects', 'id'],
    ['project_report_defaults', 'project_id', 'projects', 'project_id'],
    ['project_photo_exports', 'project_id', 'projects', 'token'],
    ['workspace_kmz_requests', 'workspace_id', 'report_workspaces', 'token'],
    ['workspace_imports', 'workspace_id', 'report_workspaces', 'id'],
    ['report_jobs', 'template_id', 'report_templates', 'id'],
    ['report_compounds', 'template_id', 'report_templates', 'id'],
];

describe('0018_fk_orphan_audit migration', () => {
    it('limpa fk_orphan antes de reinserir (idempotente)', () => {
        const deleteIdx = SQL.indexOf("DELETE FROM migration_issues WHERE issue_code = 'fk_orphan'");
        const firstInsertIdx = SQL.indexOf('INSERT INTO migration_issues');
        expect(deleteIdx).toBeGreaterThanOrEqual(0);
        expect(firstInsertIdx).toBeGreaterThan(deleteIdx);
    });

    it('tem exatamente um INSERT por relacao esperada', () => {
        const inserts = SQL.match(/INSERT INTO migration_issues/g) || [];
        expect(inserts).toHaveLength(EXPECTED_RELATIONS.length);
    });

    it.each(EXPECTED_RELATIONS)('audita %s.%s -> %s', (child, column, parent, pkCol) => {
        // marcador md5 unico por relacao (child.column), com a PK correta
        expect(SQL).toContain(`md5('${child}.${column}|' || c.${pkCol})`);
        // join contra o parent amarrado a coluna certa + filtro de orfao
        expect(SQL).toContain(`LEFT JOIN ${parent} p ON p.id = c.${column}`);
        expect(SQL).toContain(`WHERE c.${column} IS NOT NULL AND p.id IS NULL`);
    });
});

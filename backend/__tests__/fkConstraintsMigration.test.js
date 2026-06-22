// Guarda estrutural das FKs reais da Fase 4 (0019/0020). O comportamento foi
// verificado contra Postgres real; aqui travamos a definicao (tabela, coluna,
// parent, acao ON DELETE e o par NOT VALID + VALIDATE) contra edicoes acidentais.
const fs = require('fs');
const path = require('path');

function readMigration(name) {
    return fs.readFileSync(path.join(__dirname, '..', 'migrations', name), 'utf8');
}

const SQL_0019 = readMigration('0019_fk_constraints.sql');
const SQL_0020 = readMigration('0020_fk_projects.sql');
const SQL_0021 = readMigration('0021_fk_constraints_extra.sql');

// [sql, constraint, child, column, parent, action]
const EXPECTED_FKS = [
    [SQL_0019, 'fk_report_photos_workspace', 'report_photos', 'workspace_id', 'report_workspaces', 'CASCADE'],
    [SQL_0019, 'fk_license_conditions_license', 'license_conditions', 'license_id', 'operating_licenses', 'CASCADE'],
    [SQL_0019, 'fk_report_archives_compound', 'report_archives', 'compound_id', 'report_compounds', 'CASCADE'],
    [SQL_0019, 'fk_report_photos_media_asset', 'report_photos', 'media_asset_id', 'media_assets', 'SET NULL'],
    [SQL_0020, 'fk_report_workspaces_project', 'report_workspaces', 'project_id', 'projects', 'RESTRICT'],
    [SQL_0020, 'fk_report_photos_project', 'report_photos', 'project_id', 'projects', 'RESTRICT'],
    [SQL_0020, 'fk_erosions_project', 'erosions', 'project_id', 'projects', 'RESTRICT'],
    [SQL_0020, 'fk_report_jobs_workspace', 'report_jobs', 'workspace_id', 'report_workspaces', 'SET NULL'],
    [SQL_0020, 'fk_report_jobs_project', 'report_jobs', 'project_id', 'projects', 'SET NULL'],
    [SQL_0020, 'fk_report_jobs_compound', 'report_jobs', 'compound_id', 'report_compounds', 'SET NULL'],
    [SQL_0020, 'fk_report_jobs_dossier', 'report_jobs', 'dossier_id', 'project_dossiers', 'SET NULL'],
    // 0021 (Fase 4b)
    [SQL_0021, 'fk_project_dossiers_project', 'project_dossiers', 'project_id', 'projects', 'RESTRICT'],
    [SQL_0021, 'fk_project_report_defaults_project', 'project_report_defaults', 'project_id', 'projects', 'CASCADE'],
    [SQL_0021, 'fk_project_photo_exports_project', 'project_photo_exports', 'project_id', 'projects', 'CASCADE'],
    [SQL_0021, 'fk_workspace_kmz_requests_workspace', 'workspace_kmz_requests', 'workspace_id', 'report_workspaces', 'CASCADE'],
    [SQL_0021, 'fk_workspace_imports_workspace', 'workspace_imports', 'workspace_id', 'report_workspaces', 'CASCADE'],
    [SQL_0021, 'fk_report_jobs_template', 'report_jobs', 'template_id', 'report_templates', 'SET NULL'],
    [SQL_0021, 'fk_report_compounds_template', 'report_compounds', 'template_id', 'report_templates', 'SET NULL'],
];

describe('Fase 4 FK migrations (0019/0020)', () => {
    it.each(EXPECTED_FKS)('%s define %s.%s -> %s ON DELETE %s', (sql, conname, child, column, parent, action) => {
        // guard de idempotencia
        expect(sql).toContain(`conname = '${conname}'`);
        // definicao da FK com a acao certa, criada como NOT VALID
        const addRe = new RegExp(
            `ADD CONSTRAINT ${conname}\\s+FOREIGN KEY \\(${column}\\) REFERENCES ${parent}\\(id\\) ON DELETE ${action} NOT VALID`,
        );
        expect(sql).toMatch(addRe);
        // e validada na sequencia
        expect(sql).toContain(`ALTER TABLE ${child} VALIDATE CONSTRAINT ${conname}`);
    });

    it('0019 limpa referencias pendentes de media_asset antes de validar (SET NULL nao-destrutivo)', () => {
        expect(SQL_0019).toMatch(/UPDATE report_photos\s+SET media_asset_id = NULL/);
    });

    it('0020 anula referencias pendentes de report_jobs (SET NULL nao-destrutivo)', () => {
        expect(SQL_0020).toContain('UPDATE report_jobs SET workspace_id = NULL');
        expect(SQL_0020).toContain('UPDATE report_jobs SET project_id = NULL');
        expect(SQL_0020).toContain('UPDATE report_jobs SET compound_id = NULL');
        expect(SQL_0020).toContain('UPDATE report_jobs SET dossier_id = NULL');
    });

    it('0021 anula referencias pendentes de template_id (SET NULL nao-destrutivo)', () => {
        expect(SQL_0021).toContain('UPDATE report_jobs SET template_id = NULL');
        expect(SQL_0021).toContain('UPDATE report_compounds SET template_id = NULL');
    });

    it('relacoes CASCADE/RESTRICT NAO apagam orfaos (sem DELETE de dados de negocio)', () => {
        // a unica limpeza permitida e UPDATE ... SET ... = NULL; nenhum DELETE FROM
        // de tabela de negocio deve existir nessas migracoes.
        expect(SQL_0019).not.toMatch(/DELETE FROM/i);
        expect(SQL_0020).not.toMatch(/DELETE FROM/i);
        expect(SQL_0021).not.toMatch(/DELETE FROM/i);
    });
});

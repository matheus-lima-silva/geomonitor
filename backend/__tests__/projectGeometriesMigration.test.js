// Guarda estrutural da Fase 6.2 (migrations/0024_project_geometries.sql).
// Comportamento verificado em PostGIS real; aqui travamos a forma.
const fs = require('fs');
const path = require('path');

const SQL = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '0024_project_geometries.sql'),
    'utf8',
);

describe('0024_project_geometries migration', () => {
    it('cria a tabela com FK CASCADE para projects (projecao derivada)', () => {
        expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS project_geometries/);
        expect(SQL).toMatch(/project_id TEXT PRIMARY KEY REFERENCES projects\(id\) ON DELETE CASCADE/);
    });

    it('axis e LineString e towers e MultiPoint, ambos geography 4326', () => {
        expect(SQL).toMatch(/axis\s+geography\(LineString,4326\)/);
        expect(SQL).toMatch(/towers\s+geography\(MultiPoint,4326\)/);
    });

    it('cria indices GIST espaciais', () => {
        expect(SQL).toContain('USING GIST (axis)');
        expect(SQL).toContain('USING GIST (towers)');
    });

    it('faz backfill construindo eixo (>=2 pts, ordenado) e torres (multi)', () => {
        expect(SQL).toContain('INSERT INTO project_geometries');
        expect(SQL).toContain('ST_MakeLine(ARRAY_AGG(pt ORDER BY ord))');
        expect(SQL).toContain('ST_Multi(ST_Collect(ARRAY_AGG(pt)))');
        expect(SQL).toContain('HAVING COUNT(*) >= 2'); // eixo exige 2 vertices
        expect(SQL).toContain('ON CONFLICT (project_id) DO UPDATE');
    });

    it('guarda regex ignora coordenada nao-numerica', () => {
        expect(SQL).toContain("~ '^-?[0-9]+(\\.[0-9]+)?$'");
    });
});

// Guarda estrutural da Fase 6.1 (migrations/0023_postgis_geom.sql). O
// comportamento (geom do payload/colunas, NULL-safe, GIST, metros) foi verificado
// em PostGIS 3.4 real; aqui travamos a forma da migracao.
const fs = require('fs');
const path = require('path');

const SQL = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '0023_postgis_geom.sql'),
    'utf8',
);

describe('0023_postgis_geom migration', () => {
    it('habilita a extensao postgis de forma idempotente', () => {
        expect(SQL).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
    });

    it('erosions.geom e geography(Point,4326) gerada STORED (Opcao A: do payload)', () => {
        expect(SQL).toMatch(/ALTER TABLE erosions ADD COLUMN IF NOT EXISTS geom geography\(Point,4326\)/);
        expect(SQL).toMatch(/GENERATED ALWAYS AS[\s\S]*STORED/);
        // deriva do payload preferindo locationCoordinates, com fallback flat
        expect(SQL).toContain("payload->'locationCoordinates'->>'longitude'");
        expect(SQL).toContain("payload->'locationCoordinates'->>'latitude'");
        expect(SQL).toContain("payload->>'longitude'");
        expect(SQL).toContain("payload->>'latitude'");
    });

    it('usa guarda regex no cast para nao quebrar com payload sujo', () => {
        expect(SQL).toContain("~ '^-?[0-9]+(\\.[0-9]+)?$'");
    });

    it('report_photos.geom deriva das colunas gps reais', () => {
        expect(SQL).toMatch(/ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS geom geography\(Point,4326\)/);
        expect(SQL).toContain('ST_MakePoint(gps_lon, gps_lat)');
    });

    it('cria indices GIST espaciais', () => {
        expect(SQL).toContain('CREATE INDEX IF NOT EXISTS idx_erosions_geom ON erosions USING GIST (geom)');
        expect(SQL).toContain('CREATE INDEX IF NOT EXISTS idx_report_photos_geom ON report_photos USING GIST (geom)');
    });

    it('nao escreve em coluna gerada nem encadeia geradas (geom vem do payload/colunas, nao de outra gerada)', () => {
        // sanity: a expressao de erosions usa payload, nao a coluna latitude/longitude
        // (que continuam plain e inertes); evita o encadeamento proibido pelo Postgres.
        const erosionsBlock = SQL.slice(SQL.indexOf('ALTER TABLE erosions'), SQL.indexOf('CREATE INDEX IF NOT EXISTS idx_erosions_geom'));
        expect(erosionsBlock).not.toMatch(/ST_MakePoint\(\s*longitude\s*,\s*latitude\s*\)/);
    });
});

const { isReadOnlySql } = require('../utils/sqlReadOnlyGuard');

describe('isReadOnlySql', () => {
    describe('aceita', () => {
        it.each([
            ['SELECT 1'],
            ['select * from projects'],
            ['SELECT id, name FROM projects LIMIT 10'],
            ['WITH t AS (SELECT 1) SELECT * FROM t'],
            ['EXPLAIN SELECT * FROM projects'],
            ['SHOW statement_timeout'],
            ['SELECT 1; '],
            ['  SELECT 1'],
            ['-- comentario\nSELECT 1'],
            ['/* bloco */ SELECT 1'],
            ["SELECT 'delete from users' AS fake"],
        ])('%s', (sql) => {
            expect(isReadOnlySql(sql).ok).toBe(true);
        });
    });

    describe('rejeita', () => {
        it.each([
            ['INSERT INTO users VALUES (1)'],
            ['UPDATE users SET name = \'x\''],
            ['DELETE FROM users'],
            ['DROP TABLE users'],
            ['TRUNCATE users'],
            ['ALTER TABLE users ADD COLUMN x INT'],
            ['CREATE TABLE t (id INT)'],
            ['GRANT SELECT ON users TO public'],
            ['REVOKE ALL ON users FROM public'],
            ['VACUUM ANALYZE'],
            ['COPY users FROM \'/tmp/x\''],
            ['CALL my_proc()'],
            ['DO $$ BEGIN PERFORM 1; END $$'],
            ['MERGE INTO t USING s ON t.id=s.id WHEN MATCHED THEN UPDATE SET x=1'],
            [''],
            ['   '],
            ['SELECT 1; SELECT 2'],
            ['SELECT 1; DROP TABLE users'],
            ['SELECT * FROM users; INSERT INTO logs VALUES (1)'],
            ['-- DROP TABLE users\nDROP TABLE users'],
            ['select 1 /* ; */ ; drop table x'],
        ])('%s', (sql) => {
            expect(isReadOnlySql(sql).ok).toBe(false);
        });

        it('traz motivo legivel', () => {
            const r = isReadOnlySql('INSERT INTO x VALUES (1)');
            expect(r.ok).toBe(false);
            expect(r.reason).toMatch(/INSERT|nao permitido/i);
        });

        it('detecta palavra-chave proibida em query que comeca com SELECT', () => {
            // SELECT ... FOR UPDATE nao faz write, mas rejeitamos por seguranca
            // nao: "UPDATE" aparece como keyword. Confirmamos que bloqueia.
            const r = isReadOnlySql('SELECT * FROM users FOR UPDATE');
            expect(r.ok).toBe(false);
            expect(r.reason).toMatch(/UPDATE/);
        });
    });
});

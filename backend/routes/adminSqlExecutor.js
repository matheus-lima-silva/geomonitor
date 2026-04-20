const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');
const {
    createSingletonHateoasResponse,
    createPaginatedHateoasResponse,
} = require('../utils/hateoas');
const { sqlExecuteSchema } = require('../schemas/adminSqlSchemas');
const { isReadOnlySql } = require('../utils/sqlReadOnlyGuard');
const postgresStore = require('../data/postgresStore');
const { adminSqlAuditRepository } = require('../repositories');

const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

const MAX_ROWS = 1000;
const STATEMENT_TIMEOUT_MS = 5000;

// =============================================================================
// Console SQL administrativo — somente leitura.
//
// Defesa em camadas:
//   1) isReadOnlySql() — parser de keywords + multi-statement.
//   2) Transacao BEGIN READ ONLY + SET LOCAL statement_timeout.
//   3) ROLLBACK sempre (nao comita nada, por garantia).
// =============================================================================

router.post(
    '/execute',
    verifyToken,
    ...adminGuards,
    validateBody(sqlExecuteSchema),
    asyncHandler(async (req, res) => {
        const sql = req.body.data.sql;
        const executedBy = req.user?.email || req.user?.uid || 'unknown';

        const guardResult = isReadOnlySql(sql);
        if (!guardResult.ok) {
            await adminSqlAuditRepository.insert({
                executedBy,
                sqlText: sql,
                rowCount: null,
                durationMs: 0,
                status: 'blocked',
                errorMessage: guardResult.reason,
            });

            return res.status(400).json({
                status: 'error',
                code: 'SQL_NOT_READ_ONLY',
                message: guardResult.reason,
            });
        }

        const pool = postgresStore.__getPool();
        const client = await pool.connect();
        const startedAt = Date.now();

        try {
            await client.query('BEGIN READ ONLY');
            await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

            const result = await client.query(sql);
            const durationMs = Date.now() - startedAt;

            const columns = Array.isArray(result.fields)
                ? result.fields.map((field) => field.name)
                : [];
            const allRows = Array.isArray(result.rows) ? result.rows : [];
            const truncated = allRows.length > MAX_ROWS;
            const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

            await client.query('ROLLBACK');

            await adminSqlAuditRepository.insert({
                executedBy,
                sqlText: sql,
                rowCount: allRows.length,
                durationMs,
                status: 'success',
                errorMessage: null,
            });

            const payload = {
                columns,
                rows,
                rowCount: allRows.length,
                truncated,
                durationMs,
                command: result.command || null,
            };

            return res.status(200).json({
                status: 'success',
                data: createSingletonHateoasResponse(req, payload, 'admin/sql/execute'),
            });
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            try {
                await client.query('ROLLBACK');
            } catch (_rollbackErr) {
                // transacao pode ter sido abortada pelo proprio Postgres
            }

            await adminSqlAuditRepository.insert({
                executedBy,
                sqlText: sql,
                rowCount: null,
                durationMs,
                status: 'error',
                errorMessage: String(error?.message || error),
            });

            return res.status(400).json({
                status: 'error',
                code: 'SQL_EXECUTION_ERROR',
                message: String(error?.message || 'Erro ao executar SQL.'),
            });
        } finally {
            client.release();
        }
    }),
);

router.get(
    '/audit',
    verifyToken,
    ...adminGuards,
    asyncHandler(async (req, res) => {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 20));

        const { items, total } = await adminSqlAuditRepository.list({ page, limit });

        const response = createPaginatedHateoasResponse(req, items, {
            entityType: 'admin/sql/audit',
            page,
            limit,
            total,
        });

        return res.status(200).json({
            status: 'success',
            ...response,
        });
    }),
);

module.exports = router;

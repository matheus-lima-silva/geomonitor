const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/authMiddleware');
const { createSingletonHateoasResponse } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const postgresStore = require('../data/postgresStore');

const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

// ============================================================================
// Rotas de metricas administrativas
//
// Convencao HATEOAS: cada endpoint envolve a resposta em
// createSingletonHateoasResponse(req, data, 'admin/metrics/<name>') — mesmo
// padrao que backend/routes/rules.js usa para configs read-only. Nao ha
// update/delete pois sao dados computados.
//
// Nenhuma tabela nova: todas as metricas sao computadas on-demand sobre
// tabelas existentes (users, report_workspaces, report_jobs, erosions).
// ============================================================================

router.get('/totals', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    const [activeUsersRes, workspacesRes, compoundsRes, erosionsRes] = await Promise.all([
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM users WHERE payload->>'status' = 'Ativo'`),
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM report_workspaces WHERE COALESCE(status, '') <> 'deleted'`),
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM report_jobs WHERE kind = 'report_compound' AND status_execucao = 'completed'`),
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM erosions`),
    ]);

    const data = {
        activeUsers: activeUsersRes.rows[0]?.n || 0,
        workspaces: workspacesRes.rows[0]?.n || 0,
        compoundsGenerated: compoundsRes.rows[0]?.n || 0,
        erosions: erosionsRes.rows[0]?.n || 0,
    };

    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, data, 'admin/metrics/totals'),
    });
}));

router.get('/activity', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    const [recentReportsRes, recentWorkspacesRes] = await Promise.all([
        postgresStore.query(
            `SELECT id, kind, status_execucao, compound_id, workspace_id, created_at, updated_at
             FROM report_jobs
             ORDER BY created_at DESC
             LIMIT 10`,
        ),
        postgresStore.query(
            `SELECT id, project_id, status, payload->>'nome' AS nome, created_at
             FROM report_workspaces
             ORDER BY created_at DESC
             LIMIT 10`,
        ),
    ]);

    const data = {
        recentReports: recentReportsRes.rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            status: row.status_execucao,
            compoundId: row.compound_id,
            workspaceId: row.workspace_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })),
        recentWorkspaces: recentWorkspacesRes.rows.map((row) => ({
            id: row.id,
            projectId: row.project_id,
            status: row.status,
            nome: row.nome,
            createdAt: row.created_at,
        })),
    };

    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, data, 'admin/metrics/activity'),
    });
}));

router.get('/top-users', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    // Agrupamos por updated_by do report_jobs — e a coluna que identifica quem
    // enfileirou/executou o job. Depois fazemos LEFT JOIN em users buscando
    // pelo email no payload JSONB.
    const result = await postgresStore.query(
        `SELECT rj.updated_by AS email, COUNT(*)::int AS report_count,
                u.id AS user_id, u.payload->>'nome' AS nome
         FROM report_jobs rj
         LEFT JOIN users u ON u.payload->>'email' = rj.updated_by
         WHERE rj.kind = 'report_compound' AND rj.status_execucao = 'completed'
           AND rj.updated_by IS NOT NULL AND rj.updated_by <> ''
         GROUP BY rj.updated_by, u.id, u.payload->>'nome'
         ORDER BY report_count DESC
         LIMIT $1`,
        [limit],
    );

    const data = {
        topUsers: result.rows.map((row) => ({
            userId: row.user_id,
            email: row.email,
            nome: row.nome,
            reportCount: row.report_count,
        })),
    };

    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, data, 'admin/metrics/top-users'),
    });
}));

router.get('/recent-logins', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    // Ordena por payload->>'lastLoginAt' como texto; ISO 8601 e lexicograficamente
    // ordenavel, entao nao precisa cast para timestamp. Usuarios que nunca
    // logaram (lastLoginAt IS NULL) sao filtrados.
    const result = await postgresStore.query(
        `SELECT id,
                payload->>'nome' AS nome,
                payload->>'email' AS email,
                payload->>'perfil' AS perfil,
                payload->>'lastLoginAt' AS last_login_at
         FROM users
         WHERE payload->>'lastLoginAt' IS NOT NULL
           AND payload->>'lastLoginAt' <> ''
         ORDER BY payload->>'lastLoginAt' DESC
         LIMIT $1`,
        [limit],
    );

    const data = {
        recentLogins: result.rows.map((row) => ({
            userId: row.id,
            nome: row.nome,
            email: row.email,
            perfil: row.perfil,
            lastLoginAt: row.last_login_at,
        })),
    };

    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, data, 'admin/metrics/recent-logins'),
    });
}));

router.get('/health', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    const [queuedRes, processingRes, failedRes] = await Promise.all([
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM report_jobs WHERE status_execucao = 'queued'`),
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM report_jobs WHERE status_execucao IN ('processing', 'running')`),
        postgresStore.query(
            `SELECT COUNT(*)::int AS n FROM report_jobs
             WHERE status_execucao = 'failed' AND created_at > NOW() - INTERVAL '24 hours'`,
        ),
    ]);

    const data = {
        queued: queuedRes.rows[0]?.n || 0,
        processing: processingRes.rows[0]?.n || 0,
        failedLast24h: failedRes.rows[0]?.n || 0,
    };

    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, data, 'admin/metrics/health'),
    });
}));

module.exports = router;

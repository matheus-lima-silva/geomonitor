const { workspaceMemberRepository } = require('../repositories');

// Perfis globais que enxergam todos os workspaces, independentemente de
// estarem cadastrados em workspace_members. Worker interno tambem cai aqui
// porque authMiddleware.attachWorkerIdentity atribui perfil 'Administrador'.
const GLOBAL_SUPERUSER_ROLES = new Set(['Admin', 'Administrador', 'Gerente']);

// Roles locais que permitem escrita no workspace.
const WRITE_ROLES = new Set(['owner', 'editor']);

function normalizeText(value) {
    return String(value || '').trim();
}

function isGlobalSuperuser(profile) {
    if (!profile) return false;
    const perfil = normalizeText(profile.perfil);
    return GLOBAL_SUPERUSER_ROLES.has(perfil);
}

/**
 * Verifica se o usuario da request pode acessar o workspace indicado.
 * Retorna { allowed: true, reason, role } ou { allowed: false, reason }.
 *
 * Nao executa res.json — os middlewares abaixo fazem isso.
 */
async function checkWorkspaceAccess(req, workspaceId, { requireWrite = false } = {}) {
    if (!req?.user?.uid) {
        return { allowed: false, reason: 'unauthenticated' };
    }

    if (isGlobalSuperuser(req.userProfile)) {
        return { allowed: true, reason: 'global-superuser', role: 'owner' };
    }

    const normalizedId = normalizeText(workspaceId);
    if (!normalizedId) {
        return { allowed: false, reason: 'missing-workspace' };
    }

    const member = await workspaceMemberRepository.getMember(normalizedId, req.user.uid);
    if (!member) {
        return { allowed: false, reason: 'not-member' };
    }

    if (requireWrite && !WRITE_ROLES.has(member.role)) {
        return { allowed: false, reason: 'insufficient-role', role: member.role };
    }

    return { allowed: true, reason: 'member', role: member.role };
}

function buildMiddleware({ requireWrite }) {
    return async function workspaceAccessMiddleware(req, res, next) {
        try {
            const workspaceId = req.params?.id;
            const result = await checkWorkspaceAccess(req, workspaceId, { requireWrite });

            if (result.allowed) {
                req.workspaceAccess = result;
                return next();
            }

            if (result.reason === 'unauthenticated') {
                return res.status(401).json({ status: 'error', message: 'Usuario nao autenticado.' });
            }

            if (result.reason === 'missing-workspace') {
                return res.status(400).json({ status: 'error', message: 'Workspace nao informado.' });
            }

            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Voce nao tem permissao para este workspace.',
            });
        } catch (error) {
            console.error('[workspaceAccess] middleware error:', error);
            return res.status(500).json({ status: 'error', message: 'Erro ao verificar permissao do workspace.' });
        }
    };
}

const requireWorkspaceRead = buildMiddleware({ requireWrite: false });
const requireWorkspaceWrite = buildMiddleware({ requireWrite: true });

module.exports = {
    GLOBAL_SUPERUSER_ROLES,
    WRITE_ROLES,
    isGlobalSuperuser,
    checkWorkspaceAccess,
    requireWorkspaceRead,
    requireWorkspaceWrite,
};

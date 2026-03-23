const { getAuth } = require('./firebaseSetup');
const { loadUserProfile } = require('./userProfiles');

// In-memory profile cache: evita 1 leitura Firestore por request
// TTL de 5 minutos por uid — mudancas de status levam ate 5 min para propagar
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map(); // uid -> { profile, expiresAt }
const WORKER_HEADER_NAME = 'x-worker-token';
const EDITOR_ROLES = ['Admin', 'Administrador', 'Editor', 'Gerente'];
const ADMIN_ROLES = ['Admin', 'Administrador'];

function getCachedProfile(uid) {
    const entry = profileCache.get(uid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        profileCache.delete(uid);
        return null;
    }
    return entry.profile;
}

function setCachedProfile(uid, profile) {
    profileCache.set(uid, { profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
}

function invalidateCachedProfile(uid) {
    profileCache.delete(uid);
}

function normalizeText(value) {
    return String(value || '').trim();
}

function getConfiguredWorkerToken() {
    return normalizeText(process.env.WORKER_API_TOKEN);
}

function getRequestWorkerToken(req) {
    return normalizeText(req?.headers?.[WORKER_HEADER_NAME]);
}

function attachWorkerIdentity(req) {
    req.user = {
        uid: 'internal-worker',
        email: 'geomonitor-worker@internal',
        service: 'worker',
    };
    req.userProfile = {
        status: 'Ativo',
        perfil: 'Administrador',
    };
}

function runMiddlewareStack(stack, req, res, next, index = 0) {
    if (index >= stack.length) {
        return next();
    }

    return stack[index](req, res, (error) => {
        if (error) {
            return next(error);
        }
        return runMiddlewareStack(stack, req, res, next, index + 1);
    });
}

/**
 * Express middleware to verify Firebase ID Tokens.
 * Ensures that only authenticated users can access the route.
 */
async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Acesso negado. Token não providenciado.' });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
        return res.status(401).json({ status: 'error', message: 'Acesso negado. Token malformado.' });
    }

    try {
        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(token);

        // Attach the decoded user to the request object
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('[Geomonitor API] Auth Error:', error);
        return res.status(403).json({ status: 'error', message: 'Token de autenticação inválido ou expirado.' });
    }
}

/**
 * Middleware para garantir que o usuário existe na fonte de perfis ativa e está ativo.
 * Necessita que verifyToken seja executado antes.
 */
async function requireActiveUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado.' });
    }

    try {
        if (!req.userProfile) {
            const cached = getCachedProfile(req.user.uid);
            if (cached) {
                req.userProfile = cached;
            } else {
                const userProfile = await loadUserProfile(req.user.uid);
                if (!userProfile) {
                    return res.status(403).json({ status: 'error', message: 'Perfil não encontrado.' });
                }
                req.userProfile = userProfile;
                setCachedProfile(req.user.uid, req.userProfile);
            }
        }

        if (req.userProfile.status !== 'Ativo') {
            return res.status(403).json({ status: 'error', message: 'Conta inativa ou pendente de aprovação.' });
        }

        next();
    } catch (error) {
        invalidateCachedProfile(req.user?.uid);
        console.error('[Geomonitor API] requireActiveUser Error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao verificar perfil do usuário.' });
    }
}

/**
 * Cria middleware de validação de papéis baseado nos perfis permitidos.
 */
function requireRoles(allowedRoles) {
    return [
        requireActiveUser,
        (req, res, next) => {
            if (!req.userProfile || !allowedRoles.includes(req.userProfile.perfil)) {
                return res.status(403).json({ status: 'error', message: 'Acesso negado. Nível de permissão insuficiente.' });
            }
            next();
        }
    ];
}

function createWorkerOrRoleMiddleware(allowedRoles) {
    const roleStack = [verifyToken, ...requireRoles(allowedRoles)];
    return (req, res, next) => {
        const workerToken = getRequestWorkerToken(req);
        if (workerToken) {
            const configuredToken = getConfiguredWorkerToken();
            if (!configuredToken) {
                return res.status(503).json({
                    status: 'error',
                    message: 'Token interno do worker nao configurado.',
                });
            }
            if (workerToken !== configuredToken) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Token interno do worker invalido.',
                });
            }

            attachWorkerIdentity(req);
            return next();
        }

        return runMiddlewareStack(roleStack, req, res, next);
    };
}

const requireEditor = requireRoles(EDITOR_ROLES);
const requireAdmin = requireRoles(ADMIN_ROLES);
const requireEditorOrWorker = createWorkerOrRoleMiddleware(EDITOR_ROLES);

module.exports = {
    verifyToken,
    requireActiveUser,
    requireEditor,
    requireAdmin,
    requireEditorOrWorker,
    getCachedProfile,
    setCachedProfile,
    invalidateCachedProfile,
};

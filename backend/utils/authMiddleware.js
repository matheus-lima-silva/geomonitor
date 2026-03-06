const { getAuth, getDb } = require('./firebaseSetup');

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
 * Middleware para garantir que o usuário existe no Firestore e está ativo.
 * Necessita que verifyToken seja executado antes.
 */
async function requireActiveUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado.' });
    }

    try {
        if (!req.userProfile) {
            const db = getDb();
            const userDoc = await db.collection('shared').doc('geomonitor').collection('users').doc(req.user.uid).get();

            if (!userDoc.exists) {
                return res.status(403).json({ status: 'error', message: 'Perfil não encontrado.' });
            }
            req.userProfile = userDoc.data();
        }

        if (req.userProfile.status !== 'Ativo') {
            return res.status(403).json({ status: 'error', message: 'Conta inativa ou pendente de aprovação.' });
        }

        next();
    } catch (error) {
        console.error('[Geomonitor API] requireActiveUser Error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao verificar perfil do usuário.' });
    }
}

/**
 * Cria middleware de validação de papéis baseado nos perfis permitidos.
 */
function requireRoles(allowedRoles) {
    return async (req, res, next) => {
        // Assegura que o perfil está carregado e ativo
        await requireActiveUser(req, res, (err) => {
            if (err) return next(err); // Se requireActiveUser falhou e chamou next com erro, repassa // wait, requireActiveUser directly sends response if failed. 
            // Actually requireActiveUser already sends response. But we have a callback `next` which is called if successful.

            // Check roles
            if (!req.userProfile || !allowedRoles.includes(req.userProfile.perfil)) {
                return res.status(403).json({ status: 'error', message: 'Acesso negado. Nível de permissão insuficiente.' });
            }

            next();
        });
    };
}

const requireEditor = requireRoles(['Admin', 'Administrador', 'Editor', 'Gerente']);
const requireAdmin = requireRoles(['Admin', 'Administrador']);

module.exports = {
    verifyToken,
    requireActiveUser,
    requireEditor,
    requireAdmin
};

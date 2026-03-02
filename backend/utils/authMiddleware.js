const { getAuth } = require('./firebaseSetup');

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

module.exports = {
    verifyToken
};

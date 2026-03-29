const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function getSecret(envVar, label) {
    const secret = process.env[envVar];
    if (!secret) {
        throw new Error(`${label} não configurado. Defina a variável de ambiente ${envVar}.`);
    }
    return secret;
}

function signAccessToken({ userId, email }) {
    return jwt.sign(
        { sub: userId, email },
        getSecret('JWT_SECRET', 'JWT_SECRET'),
        { expiresIn: ACCESS_TOKEN_EXPIRY },
    );
}

function signRefreshToken({ userId }) {
    return jwt.sign(
        { sub: userId, type: 'refresh' },
        getSecret('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET'),
        { expiresIn: REFRESH_TOKEN_EXPIRY },
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, getSecret('JWT_SECRET', 'JWT_SECRET'));
}

function verifyRefreshToken(token) {
    const decoded = jwt.verify(token, getSecret('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET'));
    if (decoded.type !== 'refresh') {
        throw new Error('Token não é um refresh token válido.');
    }
    return decoded;
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};

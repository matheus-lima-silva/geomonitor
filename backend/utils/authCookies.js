// Cookies de autenticacao para SSO entre subdominios (geo.* e relat.*).
//
// Estrategia: o refresh token vai num cookie httpOnly `gm_refresh` com
// Domain=.lima.rio.br (configuravel via AUTH_COOKIE_DOMAIN), entao e enviado a
// todos os subdominios — login feito no geo vale no relat. Como o httpOnly NAO
// e legivel por JS, um segundo cookie `gm_session` (nao-httpOnly, so um flag)
// sinaliza ao frontend que ha sessao e ele deve tentar /auth/refresh no load.
//
// Mantemos o fluxo via localStorage do frontend como fallback (dev cross-port,
// onde o cookie de dominio nao se aplica). O cookie e aditivo, nao substitui.

const REFRESH_COOKIE_NAME = 'gm_refresh';
const SESSION_HINT_COOKIE_NAME = 'gm_session';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // espelha REFRESH_TOKEN_EXPIRY (7d)

function isProd() {
    return process.env.NODE_ENV === 'production';
}

// Domain do cookie. Vazio em dev (cookie host-only); '.lima.rio.br' em prod para
// compartilhar entre geo.* e relat.*.
function cookieDomain() {
    const domain = String(process.env.AUTH_COOKIE_DOMAIN || '').trim();
    return domain || undefined;
}

function refreshCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd(),
        // So enviado aos endpoints de auth (refresh/logout/login) — reduz exposicao.
        path: '/api/auth',
        domain: cookieDomain(),
    };
}

function hintCookieOptions() {
    return {
        httpOnly: false, // legivel por JS de proposito: e so um sinalizador
        sameSite: 'lax',
        secure: isProd(),
        path: '/',
        domain: cookieDomain(),
    };
}

function setAuthCookies(res, refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...refreshCookieOptions(), maxAge: REFRESH_MAX_AGE_MS });
    res.cookie(SESSION_HINT_COOKIE_NAME, '1', { ...hintCookieOptions(), maxAge: REFRESH_MAX_AGE_MS });
}

function clearAuthCookies(res) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.clearCookie(SESSION_HINT_COOKIE_NAME, hintCookieOptions());
}

// Le o refresh token do header Cookie sem depender de cookie-parser.
function readRefreshCookie(req) {
    const header = req.headers && req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === REFRESH_COOKIE_NAME) {
            return decodeURIComponent(part.slice(idx + 1).trim());
        }
    }
    return null;
}

module.exports = {
    REFRESH_COOKIE_NAME,
    SESSION_HINT_COOKIE_NAME,
    setAuthCookies,
    clearAuthCookies,
    readRefreshCookie,
};

// Whitelist de Content-Types aceitos em uploads (frontend + worker).
// Rejeitar tudo que nao estiver aqui previne upload de executaveis, scripts
// e arquivos que o backend nao sabe processar.

const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);

const DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-earth.kmz',
]);

const ALL_ALLOWED_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]);

function normalizeMime(value) {
    return String(value || '').trim().toLowerCase().split(';')[0].trim();
}

function isAllowedMimeType(contentType, allowed = ALL_ALLOWED_MIME_TYPES) {
    const normalized = normalizeMime(contentType);
    if (!normalized) return false;
    return allowed.has(normalized);
}

/**
 * Middleware que valida Content-Type da requisicao contra a whitelist.
 * Retorna 415 se nao for aceito. Use em endpoints que recebem binario direto.
 */
function enforceAllowedContentType(allowed = ALL_ALLOWED_MIME_TYPES) {
    return (req, res, next) => {
        const contentType = req.headers['content-type'];
        if (!isAllowedMimeType(contentType, allowed)) {
            return res.status(415).json({
                status: 'error',
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message: `Content-Type nao suportado: ${contentType || '(vazio)'}. Permitidos: ${[...allowed].join(', ')}.`,
            });
        }
        return next();
    };
}

module.exports = {
    IMAGE_MIME_TYPES,
    DOCUMENT_MIME_TYPES,
    ALL_ALLOWED_MIME_TYPES,
    isAllowedMimeType,
    normalizeMime,
    enforceAllowedContentType,
};

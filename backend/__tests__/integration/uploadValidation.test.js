// Valida que uploadValidation.enforceAllowedContentType rejeita tipos fora da
// whitelist. Testa a funcao pura sem precisar subir o app inteiro.

const {
    isAllowedMimeType,
    normalizeMime,
    enforceAllowedContentType,
    IMAGE_MIME_TYPES,
    ALL_ALLOWED_MIME_TYPES,
} = require('../../utils/uploadValidation');

describe('uploadValidation', () => {
    describe('normalizeMime', () => {
        it('trim e lowercase', () => {
            expect(normalizeMime('  Image/JPEG  ')).toBe('image/jpeg');
        });

        it('remove parametros apos ;', () => {
            expect(normalizeMime('image/jpeg; charset=utf-8')).toBe('image/jpeg');
        });

        it('retorna string vazia para null/undefined', () => {
            expect(normalizeMime(null)).toBe('');
            expect(normalizeMime(undefined)).toBe('');
        });
    });

    describe('isAllowedMimeType', () => {
        it('aceita JPEG, PNG, WebP, HEIC, HEIF, PDF, DOCX, KMZ', () => {
            expect(isAllowedMimeType('image/jpeg')).toBe(true);
            expect(isAllowedMimeType('image/png')).toBe(true);
            expect(isAllowedMimeType('image/webp')).toBe(true);
            expect(isAllowedMimeType('image/heic')).toBe(true);
            expect(isAllowedMimeType('image/heif')).toBe(true);
            expect(isAllowedMimeType('application/pdf')).toBe(true);
            expect(isAllowedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
            expect(isAllowedMimeType('application/vnd.google-earth.kmz')).toBe(true);
        });

        it('rejeita executaveis e scripts', () => {
            expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
            expect(isAllowedMimeType('application/x-sh')).toBe(false);
            expect(isAllowedMimeType('application/javascript')).toBe(false);
            expect(isAllowedMimeType('text/html')).toBe(false);
            expect(isAllowedMimeType('application/zip')).toBe(false);
        });

        it('rejeita vazio/ausente', () => {
            expect(isAllowedMimeType('')).toBe(false);
            expect(isAllowedMimeType(null)).toBe(false);
            expect(isAllowedMimeType(undefined)).toBe(false);
        });

        it('aceita whitelist customizada (so imagens)', () => {
            expect(isAllowedMimeType('application/pdf', IMAGE_MIME_TYPES)).toBe(false);
            expect(isAllowedMimeType('image/jpeg', IMAGE_MIME_TYPES)).toBe(true);
        });
    });

    describe('enforceAllowedContentType middleware', () => {
        function runMiddleware(contentType, allowed) {
            const middleware = allowed ? enforceAllowedContentType(allowed) : enforceAllowedContentType();
            const req = { headers: { 'content-type': contentType } };
            const res = {
                status: jest.fn(function statusReturn() { return this; }),
                json: jest.fn(function jsonReturn() { return this; }),
            };
            const next = jest.fn();
            middleware(req, res, next);
            return { req, res, next };
        }

        it('chama next() para JPEG', () => {
            const { next, res } = runMiddleware('image/jpeg');
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('retorna 415 para .exe', () => {
            const { next, res } = runMiddleware('application/x-msdownload');
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(415);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'error',
                    code: 'UNSUPPORTED_MEDIA_TYPE',
                }),
            );
        });

        it('retorna 415 para Content-Type vazio', () => {
            const { next, res } = runMiddleware(undefined);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(415);
        });

        it('aceita Content-Type com charset', () => {
            const { next } = runMiddleware('image/png; boundary=xyz');
            expect(next).toHaveBeenCalled();
        });

        it('chama next() para DOCX do worker', () => {
            const { next, res } = runMiddleware('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('chama next() para KMZ do worker', () => {
            const { next, res } = runMiddleware('application/vnd.google-earth.kmz');
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('ALL_ALLOWED_MIME_TYPES', () => {
        it('contem imagens, pdf, docx e kmz', () => {
            expect(ALL_ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
            expect(ALL_ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
            expect(ALL_ALLOWED_MIME_TYPES.has('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
            expect(ALL_ALLOWED_MIME_TYPES.has('application/vnd.google-earth.kmz')).toBe(true);
        });

        it('nao contem tipos perigosos', () => {
            expect(ALL_ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false);
            expect(ALL_ALLOWED_MIME_TYPES.has('text/html')).toBe(false);
        });
    });
});

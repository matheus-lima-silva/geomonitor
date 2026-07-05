// Guard requireAdminOrWorker (novo na fase 1 do PAEC): aceita o header
// x-worker-token (scripts internos, ex. registerPaecTemplate.js) ou cai no
// stack JWT+admin. Testa o middleware real, sem mock do proprio modulo.

const { requireAdminOrWorker, timingSafeStringEqual } = require('../utils/authMiddleware');

function buildRes() {
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
}

describe('requireAdminOrWorker', () => {
    const originalToken = process.env.WORKER_API_TOKEN;

    afterEach(() => {
        process.env.WORKER_API_TOKEN = originalToken;
    });

    it('passa com x-worker-token valido e anexa identidade de worker', () => {
        process.env.WORKER_API_TOKEN = 'segredo';
        const req = { headers: { 'x-worker-token': 'segredo' } };
        const res = buildRes();
        const next = jest.fn();

        requireAdminOrWorker(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.uid).toBe('internal-worker');
        expect(req.userProfile.perfil).toBe('Administrador');
    });

    it('403 com x-worker-token invalido', () => {
        process.env.WORKER_API_TOKEN = 'segredo';
        const req = { headers: { 'x-worker-token': 'errado' } };
        const res = buildRes();
        const next = jest.fn();

        requireAdminOrWorker(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });

    it('503 quando o token do worker nao esta configurado', () => {
        delete process.env.WORKER_API_TOKEN;
        const req = { headers: { 'x-worker-token': 'qualquer' } };
        const res = buildRes();
        const next = jest.fn();

        requireAdminOrWorker(req, res, next);

        expect(res.statusCode).toBe(503);
    });

    it('sem worker token cai no stack JWT (401 sem Bearer)', async () => {
        const req = { headers: {} };
        const res = buildRes();
        const next = jest.fn();

        await requireAdminOrWorker(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('403 com token de mesmo comprimento porem diferente (comparacao timing-safe)', () => {
        process.env.WORKER_API_TOKEN = 'abcdef';
        const req = { headers: { 'x-worker-token': 'abcdeg' } }; // mesmo tamanho, ultimo char difere
        const res = buildRes();
        const next = jest.fn();

        requireAdminOrWorker(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });
});

describe('timingSafeStringEqual', () => {
    it('true para strings iguais', () => {
        expect(timingSafeStringEqual('token-123', 'token-123')).toBe(true);
    });

    it('false para conteudo diferente de mesmo comprimento', () => {
        expect(timingSafeStringEqual('aaaa', 'aaab')).toBe(false);
    });

    it('false para comprimentos diferentes (sem lancar RangeError)', () => {
        expect(timingSafeStringEqual('curto', 'muito-mais-longo')).toBe(false);
    });

    it('trata valores vazios/nulos sem lancar', () => {
        expect(timingSafeStringEqual('', '')).toBe(true);
        expect(timingSafeStringEqual(undefined, 'x')).toBe(false);
        expect(timingSafeStringEqual(null, null)).toBe(true);
    });
});

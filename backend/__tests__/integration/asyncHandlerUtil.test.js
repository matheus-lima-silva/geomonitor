// Testes unitarios de utils/asyncHandler.js:
// - redactObject: garante que headers e body sensitive nao vazam em logs
// - logError: garante formato correto, respeito a NODE_ENV, e chamada a console.error

const {
    asyncHandler,
    logError,
    redactObject,
    SENSITIVE_HEADER_KEYS,
    SENSITIVE_BODY_KEYS,
} = require('../../utils/asyncHandler');

describe('redactObject', () => {
    it('redata authorization header (case-insensitive)', () => {
        const input = {
            authorization: 'Bearer secret-token',
            Authorization: 'Bearer ALSO-SECRET',
            AUTHORIZATION: 'Bearer UPPER',
        };
        const out = redactObject(input, SENSITIVE_HEADER_KEYS);
        expect(out.authorization).toBe('[REDACTED]');
        expect(out.Authorization).toBe('[REDACTED]');
        expect(out.AUTHORIZATION).toBe('[REDACTED]');
    });

    it('redata cookie, x-worker-token, proxy-authorization, x-api-key', () => {
        const input = {
            cookie: 'sid=abc',
            'x-worker-token': 'internal-token',
            'proxy-authorization': 'Bearer proxy',
            'x-api-key': 'ak_1234567890',
        };
        const out = redactObject(input, SENSITIVE_HEADER_KEYS);
        expect(out.cookie).toBe('[REDACTED]');
        expect(out['x-worker-token']).toBe('[REDACTED]');
        expect(out['proxy-authorization']).toBe('[REDACTED]');
        expect(out['x-api-key']).toBe('[REDACTED]');
    });

    it('preserva headers seguros', () => {
        const input = {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0',
            host: 'api.geomonitor.local',
            accept: 'application/json',
        };
        const out = redactObject(input, SENSITIVE_HEADER_KEYS);
        expect(out['content-type']).toBe('application/json');
        expect(out['user-agent']).toBe('Mozilla/5.0');
        expect(out.host).toBe('api.geomonitor.local');
        expect(out.accept).toBe('application/json');
    });

    it('redata password nested em body', () => {
        const input = {
            user: {
                credentials: {
                    password: 'hunter2',
                    username: 'alice',
                },
            },
            other: 'safe',
        };
        const out = redactObject(input, SENSITIVE_BODY_KEYS);
        expect(out.user.credentials.password).toBe('[REDACTED]');
        expect(out.user.credentials.username).toBe('alice');
        expect(out.other).toBe('safe');
    });

    it('redata token, refreshToken, accessToken, resetToken', () => {
        const input = {
            token: 'a',
            refreshtoken: 'b', // lowercase match
            accesstoken: 'c',
            resettoken: 'd',
            secret: 'e',
            normalField: 'ok',
        };
        const out = redactObject(input, SENSITIVE_BODY_KEYS);
        expect(out.token).toBe('[REDACTED]');
        expect(out.refreshtoken).toBe('[REDACTED]');
        expect(out.accesstoken).toBe('[REDACTED]');
        expect(out.resettoken).toBe('[REDACTED]');
        expect(out.secret).toBe('[REDACTED]');
        expect(out.normalField).toBe('ok');
    });

    it('preserva arrays sem recursao', () => {
        const input = {
            items: [1, 2, 3, 'string', { password: 'x' }],
        };
        const out = redactObject(input, SENSITIVE_BODY_KEYS);
        // Arrays sao mantidos intactos — a implementacao so recursa em objetos nao-array
        expect(Array.isArray(out.items)).toBe(true);
        expect(out.items).toEqual([1, 2, 3, 'string', { password: 'x' }]);
    });

    it('retorna input inalterado quando nao e objeto', () => {
        expect(redactObject(null, SENSITIVE_HEADER_KEYS)).toBeNull();
        expect(redactObject(undefined, SENSITIVE_HEADER_KEYS)).toBeUndefined();
        expect(redactObject('string', SENSITIVE_HEADER_KEYS)).toBe('string');
        expect(redactObject(42, SENSITIVE_HEADER_KEYS)).toBe(42);
    });

    it('nao muta o objeto original', () => {
        const input = { authorization: 'Bearer x', safe: 'y' };
        const out = redactObject(input, SENSITIVE_HEADER_KEYS);
        expect(input.authorization).toBe('Bearer x');
        expect(out.authorization).toBe('[REDACTED]');
    });
});

describe('logError', () => {
    let consoleErrorSpy;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
    });

    it('chama console.error com contexto e payload', () => {
        const err = new Error('something broke');
        err.code = 'BROKEN';
        logError('test.context', err);

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const [label, payload] = consoleErrorSpy.mock.calls[0];
        expect(label).toBe('[test.context]');
        expect(payload.context).toBe('test.context');
        expect(payload.message).toBe('something broke');
        expect(payload.code).toBe('BROKEN');
        expect(payload.name).toBe('Error');
    });

    it('em producao, nao inclui stack', () => {
        process.env.NODE_ENV = 'production';
        const err = new Error('prod error');
        logError('prod.ctx', err);

        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.stack).toBeUndefined();
    });

    it('em dev/test, inclui stack', () => {
        process.env.NODE_ENV = 'test';
        const err = new Error('dev error');
        logError('dev.ctx', err);

        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.stack).toBeDefined();
        expect(typeof payload.stack).toBe('string');
    });

    it('aceita extra.headers e redata antes de logar', () => {
        logError('ctx', new Error('e'), {
            headers: {
                authorization: 'Bearer leaked',
                'content-type': 'application/json',
            },
        });

        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.headers.authorization).toBe('[REDACTED]');
        expect(payload.headers['content-type']).toBe('application/json');
    });

    it('aceita extra.body e redata antes de logar', () => {
        logError('ctx', new Error('e'), {
            body: { password: 'hunter2', nome: 'Alice' },
        });

        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.body.password).toBe('[REDACTED]');
        expect(payload.body.nome).toBe('Alice');
    });

    it('aceita extra.userId e extra.route sem redation', () => {
        logError('ctx', new Error('e'), {
            userId: 'U-123',
            route: 'GET /api/users/:id',
        });

        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.userId).toBe('U-123');
        expect(payload.route).toBe('GET /api/users/:id');
    });

    it('aceita error nao-objeto (string)', () => {
        logError('ctx', 'just a string');

        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.message).toBe('just a string');
    });

    it('aceita error null/undefined graciosamente', () => {
        logError('ctx', null);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const [, payload] = consoleErrorSpy.mock.calls[0];
        expect(payload.message).toBe('null');
    });
});

describe('SENSITIVE_HEADER_KEYS e SENSITIVE_BODY_KEYS', () => {
    it('SENSITIVE_HEADER_KEYS contem os principais headers de auth', () => {
        expect(SENSITIVE_HEADER_KEYS.has('authorization')).toBe(true);
        expect(SENSITIVE_HEADER_KEYS.has('cookie')).toBe(true);
        expect(SENSITIVE_HEADER_KEYS.has('x-worker-token')).toBe(true);
        expect(SENSITIVE_HEADER_KEYS.has('x-api-key')).toBe(true);
    });

    it('SENSITIVE_BODY_KEYS contem password e variantes de token', () => {
        expect(SENSITIVE_BODY_KEYS.has('password')).toBe(true);
        expect(SENSITIVE_BODY_KEYS.has('token')).toBe(true);
        expect(SENSITIVE_BODY_KEYS.has('refreshtoken')).toBe(true);
        expect(SENSITIVE_BODY_KEYS.has('accesstoken')).toBe(true);
        expect(SENSITIVE_BODY_KEYS.has('secret')).toBe(true);
    });
});

describe('asyncHandler', () => {
    it('encaminha erro async para next()', async () => {
        const handler = asyncHandler(async () => {
            throw new Error('async fail');
        });

        const req = {};
        const res = {};
        const next = jest.fn();

        await handler(req, res, next);

        // next() pode ser chamado em um microtask, aguarda
        await new Promise((r) => setImmediate(r));

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(next.mock.calls[0][0].message).toBe('async fail');
    });

    it('nao chama next() quando handler completa com sucesso', async () => {
        const handler = asyncHandler(async (req, res) => {
            res.result = 'done';
        });

        const req = {};
        const res = {};
        const next = jest.fn();

        await handler(req, res, next);
        await new Promise((r) => setImmediate(r));

        expect(next).not.toHaveBeenCalled();
        expect(res.result).toBe('done');
    });

    it('aceita handler sincrono que retorna valor', async () => {
        const handler = asyncHandler((req, res) => {
            res.result = 'sync';
        });

        const req = {};
        const res = {};
        const next = jest.fn();

        handler(req, res, next);
        await new Promise((r) => setImmediate(r));

        expect(next).not.toHaveBeenCalled();
        expect(res.result).toBe('sync');
    });
});

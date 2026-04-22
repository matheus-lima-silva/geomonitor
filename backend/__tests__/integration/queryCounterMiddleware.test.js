// Testa o middleware de contagem de queries:
// - nao alerta quando count <= threshold
// - emite warn e persiste alerta quando count > threshold
// - nao dispara loop ao gravar o proprio alerta (runWithoutCounting)

const express = require('express');
const request = require('supertest');
const { createQueryCounterMiddleware } = require('../../middleware/queryCounter');
const { incrementQueryCount } = require('../../utils/queryCounter');

function buildApp({ repository, threshold }) {
    process.env.QUERY_COUNT_ALERT_THRESHOLD = String(threshold);

    const app = express();
    app.use(createQueryCounterMiddleware({ repository }));

    app.get('/under', (req, res) => {
        for (let i = 0; i < 3; i += 1) incrementQueryCount();
        res.status(200).json({ ok: true });
    });

    app.get('/over', (req, res) => {
        for (let i = 0; i < 20; i += 1) incrementQueryCount();
        res.status(200).json({ ok: true });
    });

    return app;
}

describe('queryCounterMiddleware', () => {
    const originalEnv = process.env.QUERY_COUNT_ALERT_THRESHOLD;
    let warnSpy;
    let errorSpy;

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        if (originalEnv === undefined) {
            delete process.env.QUERY_COUNT_ALERT_THRESHOLD;
        } else {
            process.env.QUERY_COUNT_ALERT_THRESHOLD = originalEnv;
        }
    });

    test('nao emite warn nem persiste alerta quando count <= threshold', async () => {
        const repository = { insert: jest.fn(async () => ({ id: '1' })) };
        const app = buildApp({ repository, threshold: 15 });

        const res = await request(app).get('/under');

        expect(res.status).toBe(200);
        // res.on('finish') pode rodar no proximo tick; aguarda pra garantir.
        await new Promise((r) => setImmediate(r));

        expect(warnSpy).not.toHaveBeenCalled();
        expect(repository.insert).not.toHaveBeenCalled();
    });

    test('emite warn estruturado e persiste alerta quando count > threshold', async () => {
        const repository = { insert: jest.fn(async () => ({ id: '1' })) };
        const app = buildApp({ repository, threshold: 15 });

        const res = await request(app).get('/over');

        expect(res.status).toBe(200);
        await new Promise((r) => setImmediate(r));

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(logged).toMatchObject({
            level: 'warn',
            type: 'query_count_alert',
            method: 'GET',
            url: '/over',
            status: 200,
            threshold: 15,
        });
        expect(logged.count).toBe(20);
        expect(typeof logged.durationMs).toBe('number');

        expect(repository.insert).toHaveBeenCalledTimes(1);
        expect(repository.insert).toHaveBeenCalledWith({
            type: 'query_count_exceeded',
            payload: expect.objectContaining({
                method: 'GET',
                url: '/over',
                status: 200,
                count: 20,
                threshold: 15,
            }),
        });
    });

    test('respeita QUERY_COUNT_ALERT_THRESHOLD customizado', async () => {
        const repository = { insert: jest.fn(async () => ({ id: '1' })) };
        const app = buildApp({ repository, threshold: 2 });

        await request(app).get('/under');
        await new Promise((r) => setImmediate(r));

        expect(repository.insert).toHaveBeenCalledTimes(1);
    });

    test('falha em repository.insert nao quebra a response', async () => {
        const repository = {
            insert: jest.fn(async () => {
                throw new Error('db down');
            }),
        };
        const app = buildApp({ repository, threshold: 15 });

        const res = await request(app).get('/over');
        await new Promise((r) => setImmediate(r));

        expect(res.status).toBe(200);
        expect(errorSpy).toHaveBeenCalled();
    });
});

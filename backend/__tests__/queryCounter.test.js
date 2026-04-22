const {
    DEFAULT_THRESHOLD,
    getAlertThreshold,
    runInRequestContext,
    getRequestStore,
    incrementQueryCount,
    runWithoutCounting,
} = require('../utils/queryCounter');

describe('queryCounter util', () => {
    const originalEnv = process.env.QUERY_COUNT_ALERT_THRESHOLD;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.QUERY_COUNT_ALERT_THRESHOLD;
        } else {
            process.env.QUERY_COUNT_ALERT_THRESHOLD = originalEnv;
        }
    });

    describe('getAlertThreshold', () => {
        test('retorna default quando env nao setado', () => {
            delete process.env.QUERY_COUNT_ALERT_THRESHOLD;
            expect(getAlertThreshold()).toBe(DEFAULT_THRESHOLD);
            expect(DEFAULT_THRESHOLD).toBe(15);
        });

        test('respeita env valido', () => {
            process.env.QUERY_COUNT_ALERT_THRESHOLD = '42';
            expect(getAlertThreshold()).toBe(42);
        });

        test('fallback para default quando env nao e inteiro positivo', () => {
            process.env.QUERY_COUNT_ALERT_THRESHOLD = 'abc';
            expect(getAlertThreshold()).toBe(DEFAULT_THRESHOLD);

            process.env.QUERY_COUNT_ALERT_THRESHOLD = '0';
            expect(getAlertThreshold()).toBe(DEFAULT_THRESHOLD);

            process.env.QUERY_COUNT_ALERT_THRESHOLD = '-5';
            expect(getAlertThreshold()).toBe(DEFAULT_THRESHOLD);
        });
    });

    describe('AsyncLocalStorage', () => {
        test('incrementQueryCount fora de contexto e no-op', () => {
            expect(() => incrementQueryCount()).not.toThrow();
            expect(getRequestStore()).toBeUndefined();
        });

        test('cada request isola o proprio contador', async () => {
            const results = await Promise.all([
                runInRequestContext(async () => {
                    incrementQueryCount();
                    incrementQueryCount();
                    incrementQueryCount();
                    return getRequestStore().count;
                }),
                runInRequestContext(async () => {
                    incrementQueryCount();
                    return getRequestStore().count;
                }),
            ]);
            expect(results).toEqual([3, 1]);
        });

        test('store carrega startedAt setado na entrada', () => {
            const before = Date.now();
            runInRequestContext(() => {
                const store = getRequestStore();
                expect(store.count).toBe(0);
                expect(store.startedAt).toBeGreaterThanOrEqual(before);
            });
        });

        test('runWithoutCounting suspende increments e restaura depois', async () => {
            await runInRequestContext(async () => {
                incrementQueryCount();
                await runWithoutCounting(async () => {
                    incrementQueryCount();
                    incrementQueryCount();
                });
                incrementQueryCount();
                expect(getRequestStore().count).toBe(2);
            });
        });
    });
});

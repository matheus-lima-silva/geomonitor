describe('data backend resolution', () => {
    const originalDataBackend = process.env.DATA_BACKEND;

    afterEach(() => {
        jest.resetModules();
        if (originalDataBackend === undefined) {
            delete process.env.DATA_BACKEND;
        } else {
            process.env.DATA_BACKEND = originalDataBackend;
        }
    });

    it('usa firestore por padrao', () => {
        delete process.env.DATA_BACKEND;
        jest.resetModules();

        const { getConfiguredDataBackend, getDataStore } = require('../index');

        expect(getConfiguredDataBackend()).toBe('firestore');
        expect(getDataStore()).toBe(require('../firestoreStore'));
    });

    it('resolve postgres store quando DATA_BACKEND=postgres', () => {
        process.env.DATA_BACKEND = 'postgres';
        jest.resetModules();

        const { getConfiguredDataBackend, getDataStore } = require('../index');
        const store = getDataStore();

        expect(getConfiguredDataBackend()).toBe('postgres');
        expect(store).toEqual(expect.objectContaining({
            listDocs: expect.any(Function),
            getDoc: expect.any(Function),
            setDoc: expect.any(Function),
            deleteDoc: expect.any(Function),
        }));
    });
});

describe('data backend resolution', () => {
    it('resolve postgres store', () => {
        const { getConfiguredDataBackend, getDataStore } = require('../index');

        expect(getConfiguredDataBackend()).toBe('postgres');
        expect(getDataStore()).toBe(require('../postgresStore'));
    });
});

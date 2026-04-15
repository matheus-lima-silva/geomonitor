module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./jest.setup.js'],
    clearMocks: true,
    restoreMocks: true,
    roots: ['<rootDir>'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/helpers/',
        '/__tests__/fixtures/',
    ],
};

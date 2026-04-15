// Mocks antes de carregar o app — garantem que nenhum repo toque postgres.
jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
    getByUserId: jest.fn(async () => null),
    create: jest.fn(async () => {}),
    setResetToken: jest.fn(async () => {}),
    getByResetToken: jest.fn(async () => null),
    updatePassword: jest.fn(async () => {}),
    clearResetToken: jest.fn(async () => {}),
}));

jest.mock('../../repositories', () => ({
    userRepository: {
        list: jest.fn(async () => []),
        getById: jest.fn(async () => null),
        save: jest.fn(async () => {}),
        remove: jest.fn(async () => {}),
        listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })),
    },
    erosionRepository: { list: jest.fn(async () => []) },
    projectRepository: { list: jest.fn(async () => []) },
    inspectionRepository: { list: jest.fn(async () => []) },
    operatingLicenseRepository: { list: jest.fn(async () => []) },
    reportJobRepository: { list: jest.fn(async () => []), save: jest.fn(), getById: jest.fn(async () => null) },
    reportWorkspaceRepository: { list: jest.fn(async () => []), save: jest.fn(), getById: jest.fn(async () => null) },
    reportPhotoRepository: { listByWorkspace: jest.fn(async () => []) },
    reportDeliveryTrackingRepository: { list: jest.fn(async () => []) },
    reportTemplateRepository: { list: jest.fn(async () => []) },
    reportCompoundRepository: { list: jest.fn(async () => []) },
    projectDossierRepository: { list: jest.fn(async () => []) },
    projectPhotoExportRepository: { list: jest.fn(async () => []) },
    reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
    rulesConfigRepository: { get: jest.fn(async () => null), save: jest.fn() },
    mediaAssetRepository: { getById: jest.fn(async () => null) },
    workspaceImportRepository: { save: jest.fn() },
    workspaceKmzRequestRepository: {},
    workspaceMemberRepository: {
        listWorkspaceIdsByUser: jest.fn(async () => []),
        addMember: jest.fn(),
    },
}));

jest.mock('../../utils/mailer', () => ({
    getMailTransport: () => null,
    sendResetEmail: jest.fn(async () => {}),
}));

const request = require('supertest');
const app = require('../../server');

describe('Auth rate limiting', () => {
    it('retorna 429 apos 10 tentativas de login malsucedidas', async () => {
        const payload = { email: 'nonexistent@test.local', password: 'WrongPass1' };
        let last429 = null;

        // A 1a-10a tentativa devem retornar 401 (credenciais invalidas).
        // A 11a deve retornar 429.
        for (let i = 0; i < 11; i += 1) {
            const res = await request(app).post('/api/auth/login').send(payload);
            if (res.status === 429) {
                last429 = res;
                break;
            }
            expect([400, 401]).toContain(res.status);
        }

        expect(last429).not.toBeNull();
        expect(last429.body.code).toBe('RATE_LIMITED');
    });
});

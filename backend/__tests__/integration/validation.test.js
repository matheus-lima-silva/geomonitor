// Testes de validacao Zod: garantem que o middleware validateBody rejeita
// payloads malformados com 400 VALIDATION_ERROR antes de tocar o repositorio.

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
        listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })),
    },
    erosionRepository: { list: jest.fn(async () => []) },
    projectRepository: { list: jest.fn(async () => []) },
    inspectionRepository: { list: jest.fn(async () => []) },
    operatingLicenseRepository: { list: jest.fn(async () => []) },
    reportJobRepository: { list: jest.fn(async () => []), getById: jest.fn(async () => null), save: jest.fn() },
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

describe('Validation (Zod)', () => {
    describe('POST /api/auth/register', () => {
        it('rejeita email invalido com 400 VALIDATION_ERROR', async () => {
            const res = await request(app).post('/api/auth/register').send({
                email: 'not-an-email',
                password: 'StrongPass1',
                nome: 'Teste',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
            expect(Array.isArray(res.body.errors)).toBe(true);
        });

        it('rejeita senha fraca com 400 VALIDATION_ERROR', async () => {
            const res = await request(app).post('/api/auth/register').send({
                email: 'x@y.com',
                password: 'fraca',
                nome: 'Teste',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        it('rejeita nome vazio com 400 VALIDATION_ERROR', async () => {
            const res = await request(app).post('/api/auth/register').send({
                email: 'x@y.com',
                password: 'StrongPass1',
                nome: '   ',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/auth/login', () => {
        it('rejeita email vazio com 400 VALIDATION_ERROR', async () => {
            const res = await request(app).post('/api/auth/login').send({
                email: '',
                password: 'whatever',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        it('rejeita senha vazia com 400 VALIDATION_ERROR', async () => {
            const res = await request(app).post('/api/auth/login').send({
                email: 'x@y.com',
                password: '',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('rejeita body sem refreshToken com 400 VALIDATION_ERROR', async () => {
            const res = await request(app).post('/api/auth/refresh').send({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });
});

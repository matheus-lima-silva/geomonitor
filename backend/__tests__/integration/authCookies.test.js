// SSO por cookie: /auth/refresh le o gm_refresh do cookie (ou body como
// fallback) e seta gm_refresh + gm_session; /auth/logout limpa ambos.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
    getByUserId: jest.fn(async () => ({ user_id: 'U-1', email: 'ana@empresa.com' })),
    create: jest.fn(async () => {}),
    setResetToken: jest.fn(async () => {}),
    getByResetToken: jest.fn(async () => null),
    updatePassword: jest.fn(async () => {}),
    clearResetToken: jest.fn(async () => {}),
}));

jest.mock('../../repositories/refreshTokenRepository', () => ({
    issueFamily: jest.fn(async () => ({ jti: 'J-new', familyId: 'F-new' })),
    rotate: jest.fn(async () => ({ jti: 'J-rot', userId: 'U-1', familyId: 'F-1' })),
    revokeFamilyByJti: jest.fn(async () => {}),
}));

jest.mock('../../repositories', () => ({
    userRepository: {
        list: jest.fn(async () => []),
        getById: jest.fn(async () => null),
        save: jest.fn(async () => {}),
        listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })),
        updateLastLogin: jest.fn(async () => {}),
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

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const refreshTokenRepository = require('../../repositories/refreshTokenRepository');
const { REFRESH_COOKIE_NAME, SESSION_HINT_COOKIE_NAME } = require('../../utils/authCookies');

// Token legado (pre-rotacao): sem jti. O /refresh deve migra-lo via issueFamily.
function signRefresh(userId) {
    return jwt.sign({ sub: userId, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// Token novo (com jti/fam): o /refresh deve rotaciona-lo via rotate.
function signRefreshWithJti(userId, jti) {
    return jwt.sign(
        { sub: userId, type: 'refresh', fam: 'F-1' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d', jwtid: jti },
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    refreshTokenRepository.issueFamily.mockResolvedValue({ jti: 'J-new', familyId: 'F-new' });
    refreshTokenRepository.rotate.mockResolvedValue({ jti: 'J-rot', userId: 'U-1', familyId: 'F-1' });
    refreshTokenRepository.revokeFamilyByJti.mockResolvedValue(undefined);
});

describe('Auth SSO cookies', () => {
    describe('POST /api/auth/refresh', () => {
        it('le o refresh token do cookie gm_refresh e seta novos cookies', async () => {
            const token = signRefresh('U-1');
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token}`])
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.data.accessToken).toBeTruthy();

            const setCookie = (res.headers['set-cookie'] || []).join(' ; ');
            expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
            expect(setCookie).toContain(`${SESSION_HINT_COOKIE_NAME}=`);
            expect(setCookie).toContain('HttpOnly');
        });

        it('aceita refresh token no body (fallback localStorage)', async () => {
            const token = signRefresh('U-1');
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: token });

            expect(res.status).toBe(200);
            expect(res.body.data.accessToken).toBeTruthy();
        });

        it('cookie tem prioridade sobre body invalido', async () => {
            const token = signRefresh('U-1');
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token}`])
                .send({ refreshToken: 'lixo-invalido' });

            expect(res.status).toBe(200);
        });

        it('retorna 401 quando nao ha token no cookie nem no body', async () => {
            const res = await request(app).post('/api/auth/refresh').send({});
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
        });

        it('token legado (sem jti) migra via issueFamily, nao via rotate', async () => {
            const token = signRefresh('U-1');
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: token });

            expect(res.status).toBe(200);
            expect(refreshTokenRepository.issueFamily).toHaveBeenCalledWith('U-1');
            expect(refreshTokenRepository.rotate).not.toHaveBeenCalled();
        });

        it('token com jti rotaciona via rotate e seta novos cookies', async () => {
            const token = signRefreshWithJti('U-1', 'J-1');
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: token });

            expect(res.status).toBe(200);
            expect(refreshTokenRepository.rotate).toHaveBeenCalledWith('J-1');
            expect(refreshTokenRepository.issueFamily).not.toHaveBeenCalled();
            const setCookie = (res.headers['set-cookie'] || []).join(' ; ');
            expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
        });

        it('reuse detectado (rotate => reuse) retorna 401 e limpa cookies', async () => {
            refreshTokenRepository.rotate.mockResolvedValueOnce({ reuse: true, familyId: 'F-1' });
            const token = signRefreshWithJti('U-1', 'J-OLD');
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: token });

            expect(res.status).toBe(401);
            expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
            const setCookie = (res.headers['set-cookie'] || []).join(' ; ');
            // clearCookie expira os cookies (data no passado).
            expect(setCookie.toLowerCase()).toContain('expires=');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('limpa os cookies de sessao', async () => {
            const res = await request(app).post('/api/auth/logout').send();
            expect(res.status).toBe(200);

            const cookies = res.headers['set-cookie'] || [];
            const joined = cookies.join(' ; ');
            expect(joined).toContain(`${REFRESH_COOKIE_NAME}=`);
            expect(joined).toContain(`${SESSION_HINT_COOKIE_NAME}=`);
            // clearCookie expira o cookie (data no passado).
            expect(joined.toLowerCase()).toContain('expires=');
        });

        it('revoga a familia do refresh token apresentado (com jti)', async () => {
            const token = signRefreshWithJti('U-1', 'J-LOGOUT');
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token}`])
                .send();

            expect(res.status).toBe(200);
            expect(refreshTokenRepository.revokeFamilyByJti).toHaveBeenCalledWith('J-LOGOUT');
        });

        it('sem token nao chama revokeFamilyByJti e ainda limpa cookies', async () => {
            const res = await request(app).post('/api/auth/logout').send();
            expect(res.status).toBe(200);
            expect(refreshTokenRepository.revokeFamilyByJti).not.toHaveBeenCalled();
        });
    });
});

jest.unmock('../authMiddleware');

describe('Auth Middleware', () => {
    let req;
    let res;
    let next;
    let getAuth;
    let loadUserProfile;
    let verifyToken;
    let requireActiveUser;
    let requireEditor;
    let requireAdmin;
    let invalidateCachedProfile;

    beforeEach(() => {
        jest.resetModules();

        jest.doMock('../firebaseSetup', () => ({
            getAuth: jest.fn(),
        }));

        jest.doMock('../userProfiles', () => ({
            loadUserProfile: jest.fn(),
        }));

        ({ getAuth } = require('../firebaseSetup'));
        ({ loadUserProfile } = require('../userProfiles'));
        ({
            verifyToken,
            requireActiveUser,
            requireEditor,
            requireAdmin,
            invalidateCachedProfile,
        } = require('../authMiddleware'));

        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        invalidateCachedProfile('user_123');
        jest.clearAllMocks();
    });

    describe('verifyToken', () => {
        it('should return 401 if no authorization header', async () => {
            await verifyToken(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 if token is invalid', async () => {
            req.headers.authorization = 'Bearer invalid_token';
            getAuth.mockReturnValue({ verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token')) });

            await verifyToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should call next if token is valid', async () => {
            req.headers.authorization = 'Bearer valid_token';
            const decodedToken = { uid: 'user_123', email: 'test@test.com' };
            getAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue(decodedToken) });

            await verifyToken(req, res, next);

            expect(req.user).toEqual(decodedToken);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('Authorization Middlewares (requireActiveUser, requireEditor, requireAdmin)', () => {
        beforeEach(async () => {
            req.headers.authorization = 'Bearer valid_token';
            const decodedToken = { uid: 'user_123', email: 'test@test.com' };
            getAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue(decodedToken) });
            await verifyToken(req, res, next);
            next.mockClear();
        });

        it('requireActiveUser should return 403 if user not found', async () => {
            loadUserProfile.mockResolvedValue(null);

            await requireActiveUser(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Perfil não encontrado'),
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('requireActiveUser should return 403 if user status is not Ativo', async () => {
            loadUserProfile.mockResolvedValue({ status: 'Pendente' });

            await requireActiveUser(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Conta inativa'),
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('requireActiveUser should call next if user is Ativo', async () => {
            const userData = { status: 'Ativo', perfil: 'Utilizador' };
            loadUserProfile.mockResolvedValue(userData);

            await requireActiveUser(req, res, next);

            expect(req.userProfile).toEqual(userData);
            expect(next).toHaveBeenCalled();
        });

        it('requireEditor should call next for Admin, Administrador, Editor, Gerente', async () => {
            const roles = ['Admin', 'Administrador', 'Editor', 'Gerente'];

            for (const role of roles) {
                req.userProfile = undefined;
                next.mockClear();
                loadUserProfile.mockResolvedValue({ status: 'Ativo', perfil: role });

                await requireEditor[0](req, res, async () => {
                    await requireEditor[1](req, res, next);
                });

                expect(next).toHaveBeenCalled();
            }
        });

        it('requireEditor should return 403 for Utilizador', async () => {
            loadUserProfile.mockResolvedValue({ status: 'Ativo', perfil: 'Utilizador' });

            await requireEditor[0](req, res, async () => {
                await requireEditor[1](req, res, next);
            });

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('requireAdmin should call next for Admin, Administrador', async () => {
            const roles = ['Admin', 'Administrador'];

            for (const role of roles) {
                req.userProfile = undefined;
                next.mockClear();
                loadUserProfile.mockResolvedValue({ status: 'Ativo', perfil: role });

                await requireAdmin[0](req, res, async () => {
                    await requireAdmin[1](req, res, next);
                });

                expect(next).toHaveBeenCalled();
            }
        });

        it('requireAdmin should return 403 for Editor', async () => {
            loadUserProfile.mockResolvedValue({ status: 'Ativo', perfil: 'Editor' });

            await requireAdmin[0](req, res, async () => {
                await requireAdmin[1](req, res, next);
            });

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });
});

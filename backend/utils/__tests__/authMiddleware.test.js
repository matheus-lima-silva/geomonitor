jest.unmock('../authMiddleware');
const { verifyToken, requireActiveUser, requireEditor, requireAdmin } = require('../authMiddleware');
const { getAuth, getDb } = require('../firebaseSetup');

jest.mock('../firebaseSetup', () => {
    return {
        getAuth: jest.fn(),
        getDb: jest.fn(),
    };
});

describe('Auth Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
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
            const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
            getAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

            await verifyToken(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should call next if token is valid', async () => {
            req.headers.authorization = 'Bearer valid_token';
            const decodedToken = { uid: 'user_123', email: 'test@test.com' };
            const mockVerifyIdToken = jest.fn().mockResolvedValue(decodedToken);
            getAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

            await verifyToken(req, res, next);
            expect(req.user).toEqual(decodedToken);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('Authorization Middlewares (requireActiveUser, requireEditor, requireAdmin)', () => {
        const createMockDb = (userData) => {
            const mockDoc = {
                get: jest.fn().mockResolvedValue({
                    exists: !!userData,
                    data: () => userData,
                }),
            };
            const mockCollection = { doc: jest.fn().mockReturnValue(mockDoc) };
            const mockRootCollection = { doc: jest.fn().mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) }) };

            return {
                collection: jest.fn().mockReturnValue(mockRootCollection),
            };
        };

        beforeEach(async () => {
            // Setup a valid token first
            req.headers.authorization = 'Bearer valid_token';
            const decodedToken = { uid: 'user_123', email: 'test@test.com' };
            getAuth.mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue(decodedToken) });
            await verifyToken(req, res, next);
            next.mockClear();
        });

        it('requireActiveUser should return 403 if user not found in Firestore', async () => {
            getDb.mockReturnValue(createMockDb(null));
            await requireActiveUser(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Perfil não encontrado') }));
            expect(next).not.toHaveBeenCalled();
        });

        it('requireActiveUser should return 403 if user status is not Ativo', async () => {
            getDb.mockReturnValue(createMockDb({ status: 'Pendente' }));
            await requireActiveUser(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Conta inativa') }));
            expect(next).not.toHaveBeenCalled();
        });

        it('requireActiveUser should call next if user is Ativo', async () => {
            const userData = { status: 'Ativo', perfil: 'Utilizador' };
            getDb.mockReturnValue(createMockDb(userData));
            await requireActiveUser(req, res, next);
            expect(req.userProfile).toEqual(userData);
            expect(next).toHaveBeenCalled();
        });

        it('requireEditor should call next for Admin, Administrador, Editor, Gerente', async () => {
            const roles = ['Admin', 'Administrador', 'Editor', 'Gerente'];
            for (const role of roles) {
                req.userProfile = undefined;
                next.mockClear();
                getDb.mockReturnValue(createMockDb({ status: 'Ativo', perfil: role }));
                await requireEditor(req, res, next);
                expect(next).toHaveBeenCalled();
            }
        });

        it('requireEditor should return 403 for Utilizador', async () => {
            getDb.mockReturnValue(createMockDb({ status: 'Ativo', perfil: 'Utilizador' }));
            await requireEditor(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('requireAdmin should call next for Admin, Administrador', async () => {
            const roles = ['Admin', 'Administrador'];
            for (const role of roles) {
                req.userProfile = undefined;
                next.mockClear();
                getDb.mockReturnValue(createMockDb({ status: 'Ativo', perfil: role }));
                await requireAdmin(req, res, next);
                expect(next).toHaveBeenCalled();
            }
        });

        it('requireAdmin should return 403 for Editor', async () => {
            getDb.mockReturnValue(createMockDb({ status: 'Ativo', perfil: 'Editor' }));
            await requireAdmin(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });
});

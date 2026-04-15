describe('workspaceAccess', () => {
    let req;
    let res;
    let next;
    let workspaceMemberRepositoryMock;
    let isGlobalSuperuser;
    let checkWorkspaceAccess;
    let requireWorkspaceRead;
    let requireWorkspaceWrite;

    beforeEach(() => {
        jest.resetModules();

        workspaceMemberRepositoryMock = {
            getMember: jest.fn(),
            listWorkspaceIdsByUser: jest.fn(),
            listByWorkspace: jest.fn(),
            addMember: jest.fn(),
            removeMember: jest.fn(),
            countOwners: jest.fn(),
        };

        jest.doMock('../../repositories', () => ({
            workspaceMemberRepository: workspaceMemberRepositoryMock,
        }));

        ({
            isGlobalSuperuser,
            checkWorkspaceAccess,
            requireWorkspaceRead,
            requireWorkspaceWrite,
        } = require('../workspaceAccess'));

        req = {
            user: { uid: 'user_123', email: 'user@test.com' },
            userProfile: { perfil: 'Editor', status: 'Ativo' },
            params: { id: 'RW-1' },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();

        // silencia console.error do middleware
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('isGlobalSuperuser', () => {
        it('returns true for Admin', () => {
            expect(isGlobalSuperuser({ perfil: 'Admin' })).toBe(true);
        });
        it('returns true for Administrador', () => {
            expect(isGlobalSuperuser({ perfil: 'Administrador' })).toBe(true);
        });
        it('returns true for Gerente', () => {
            expect(isGlobalSuperuser({ perfil: 'Gerente' })).toBe(true);
        });
        it('returns false for Editor', () => {
            expect(isGlobalSuperuser({ perfil: 'Editor' })).toBe(false);
        });
        it('returns false for Utilizador', () => {
            expect(isGlobalSuperuser({ perfil: 'Utilizador' })).toBe(false);
        });
        it('returns false for null profile', () => {
            expect(isGlobalSuperuser(null)).toBe(false);
        });
        it('returns false for empty object', () => {
            expect(isGlobalSuperuser({})).toBe(false);
        });
        it('trims whitespace from perfil', () => {
            expect(isGlobalSuperuser({ perfil: '  Administrador  ' })).toBe(true);
        });
    });

    describe('checkWorkspaceAccess', () => {
        it('returns unauthenticated when req.user.uid is missing', async () => {
            const result = await checkWorkspaceAccess({ user: {} }, 'RW-1');
            expect(result).toEqual({ allowed: false, reason: 'unauthenticated' });
            expect(workspaceMemberRepositoryMock.getMember).not.toHaveBeenCalled();
        });

        it('returns unauthenticated when req.user is missing entirely', async () => {
            const result = await checkWorkspaceAccess({}, 'RW-1');
            expect(result).toEqual({ allowed: false, reason: 'unauthenticated' });
        });

        it('allows global superuser without querying repository', async () => {
            req.userProfile = { perfil: 'Administrador' };
            const result = await checkWorkspaceAccess(req, 'RW-1');
            expect(result).toEqual({ allowed: true, reason: 'global-superuser', role: 'owner' });
            expect(workspaceMemberRepositoryMock.getMember).not.toHaveBeenCalled();
        });

        it('allows worker identity (perfil Administrador atribuido por attachWorkerIdentity)', async () => {
            const workerReq = {
                user: { uid: 'internal-worker', email: 'geomonitor-worker@internal', service: 'worker' },
                userProfile: { perfil: 'Administrador', status: 'Ativo' },
            };
            const result = await checkWorkspaceAccess(workerReq, 'RW-1');
            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('global-superuser');
            expect(workspaceMemberRepositoryMock.getMember).not.toHaveBeenCalled();
        });

        it('returns missing-workspace when workspaceId is empty', async () => {
            const result = await checkWorkspaceAccess(req, '');
            expect(result).toEqual({ allowed: false, reason: 'missing-workspace' });
            expect(workspaceMemberRepositoryMock.getMember).not.toHaveBeenCalled();
        });

        it('returns missing-workspace when workspaceId is undefined', async () => {
            const result = await checkWorkspaceAccess(req, undefined);
            expect(result).toEqual({ allowed: false, reason: 'missing-workspace' });
        });

        it('returns not-member when user has no membership', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue(null);
            const result = await checkWorkspaceAccess(req, 'RW-1');
            expect(result).toEqual({ allowed: false, reason: 'not-member' });
            expect(workspaceMemberRepositoryMock.getMember).toHaveBeenCalledWith('RW-1', 'user_123');
        });

        it('allows viewer for read', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'viewer' });
            const result = await checkWorkspaceAccess(req, 'RW-1', { requireWrite: false });
            expect(result).toEqual({ allowed: true, reason: 'member', role: 'viewer' });
        });

        it('blocks viewer on write', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'viewer' });
            const result = await checkWorkspaceAccess(req, 'RW-1', { requireWrite: true });
            expect(result).toEqual({ allowed: false, reason: 'insufficient-role', role: 'viewer' });
        });

        it('allows editor on write', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'editor' });
            const result = await checkWorkspaceAccess(req, 'RW-1', { requireWrite: true });
            expect(result).toEqual({ allowed: true, reason: 'member', role: 'editor' });
        });

        it('allows owner on write', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'owner' });
            const result = await checkWorkspaceAccess(req, 'RW-1', { requireWrite: true });
            expect(result).toEqual({ allowed: true, reason: 'member', role: 'owner' });
        });
    });

    describe('requireWorkspaceRead middleware', () => {
        it('calls next and attaches workspaceAccess on allow', async () => {
            req.userProfile = { perfil: 'Administrador' };
            await requireWorkspaceRead(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.workspaceAccess).toMatchObject({ allowed: true, role: 'owner' });
            expect(res.status).not.toHaveBeenCalled();
        });

        it('returns 401 when unauthenticated', async () => {
            await requireWorkspaceRead({ params: { id: 'RW-1' } }, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 400 when workspace id is missing', async () => {
            req.params = {};
            await requireWorkspaceRead(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 403 when user is not a member', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue(null);
            await requireWorkspaceRead(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('allows viewer to read', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'viewer' });
            await requireWorkspaceRead(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.workspaceAccess.role).toBe('viewer');
        });

        it('returns 500 when repository throws', async () => {
            workspaceMemberRepositoryMock.getMember.mockRejectedValue(new Error('db down'));
            await requireWorkspaceRead(req, res, next);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('requireWorkspaceWrite middleware', () => {
        it('allows owner to write', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'owner' });
            await requireWorkspaceWrite(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.workspaceAccess.role).toBe('owner');
        });

        it('allows editor to write', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'editor' });
            await requireWorkspaceWrite(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('blocks viewer with 403', async () => {
            workspaceMemberRepositoryMock.getMember.mockResolvedValue({ role: 'viewer' });
            await requireWorkspaceWrite(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('allows global superuser to write without querying repo', async () => {
            req.userProfile = { perfil: 'Gerente' };
            await requireWorkspaceWrite(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(workspaceMemberRepositoryMock.getMember).not.toHaveBeenCalled();
        });
    });
});

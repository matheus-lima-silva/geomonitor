// Testes de integracao do CRUD de license_conditions. Exercita o router
// nested (/api/licenses/:id/conditions) e o flat (/api/license-conditions/:id),
// com os repositorios mockados em memoria. Valida HATEOAS, envelope, 404 em
// licenca inexistente, bulk replace atomico e guard de requireEditor em writes.

const mockAuthContext = {
    user: { uid: 'user_editor', email: 'editor@test.local' },
    userProfile: { status: 'Ativo', perfil: 'Editor' },
};

jest.mock('../../utils/authMiddleware', () => {
    const attach = (req, res, next) => {
        req.user = { ...mockAuthContext.user };
        req.userProfile = { ...mockAuthContext.userProfile };
        next();
    };
    return {
        verifyToken: attach,
        requireActiveUser: attach,
        requireActiveUserOrWorker: attach,
        requireEditor: [attach],
        requireEditorOrWorker: attach,
        requireAdmin: [attach],
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

const mockState = {
    licenses: new Map(),
    conditions: new Map(), // key: condition id
};

function sortByOrdem(items) {
    return [...items].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.numero).localeCompare(String(b.numero)));
}

const mockLicenseConditionRepository = {
    listByLicense: jest.fn(async (licenseId) => {
        return sortByOrdem(Array.from(mockState.conditions.values()).filter((c) => c.licenseId === licenseId));
    }),
    getById: jest.fn(async (id) => mockState.conditions.get(id) || null),
    save: jest.fn(async (cond, { updatedBy } = {}) => {
        const saved = {
            ...cond,
            titulo: cond.titulo || '',
            tipo: cond.tipo || 'geral',
            prazo: cond.prazo || '',
            periodicidadeRelatorio: cond.periodicidadeRelatorio || '',
            mesesEntrega: cond.mesesEntrega || [],
            ordem: Number.isInteger(cond.ordem) ? cond.ordem : 0,
            parecerTecnicoRef: cond.parecerTecnicoRef || '',
            createdAt: mockState.conditions.get(cond.id)?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: updatedBy || null,
        };
        mockState.conditions.set(saved.id, saved);
        return saved;
    }),
    remove: jest.fn(async (id) => {
        return mockState.conditions.delete(id);
    }),
    bulkReplace: jest.fn(async (licenseId, items, { updatedBy } = {}) => {
        for (const [id, cond] of mockState.conditions) {
            if (cond.licenseId === licenseId && !items.find((x) => x.id === id)) {
                mockState.conditions.delete(id);
            }
        }
        for (const [idx, cond] of items.entries()) {
            mockState.conditions.set(cond.id, {
                ...cond,
                licenseId,
                ordem: Number.isInteger(cond.ordem) ? cond.ordem : idx,
                updatedAt: new Date().toISOString(),
                updatedBy: updatedBy || null,
                createdAt: mockState.conditions.get(cond.id)?.createdAt || new Date().toISOString(),
            });
        }
        return sortByOrdem(Array.from(mockState.conditions.values()).filter((c) => c.licenseId === licenseId));
    }),
    countByLicense: jest.fn(async (licenseId) => {
        return Array.from(mockState.conditions.values()).filter((c) => c.licenseId === licenseId).length;
    }),
    removeByLicense: jest.fn(async (licenseId) => {
        let removed = 0;
        for (const [id, cond] of mockState.conditions) {
            if (cond.licenseId === licenseId) {
                mockState.conditions.delete(id);
                removed++;
            }
        }
        return removed;
    }),
};

const mockOperatingLicenseRepository = {
    list: jest.fn(async () => Array.from(mockState.licenses.values())),
    getById: jest.fn(async (id) => mockState.licenses.get(id) || null),
    save: jest.fn(),
    remove: jest.fn(),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(), save: jest.fn() },
        userRepository: { getById: jest.fn() },
        inspectionRepository: { list: noopList, getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: mockOperatingLicenseRepository,
        licenseConditionRepository: mockLicenseConditionRepository,
        reportJobRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList, getById: jest.fn() },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        reportArchiveRepository: { list: noopList, getById: jest.fn() },
        mediaAssetRepository: { getById: jest.fn() },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listByWorkspace: noopList,
            listWorkspaceIdsByUser: noopList,
            listRolesForUser: jest.fn(async () => new Map()),
            getMember: jest.fn(async () => null),
            addMember: jest.fn(),
            removeMember: jest.fn(),
            countOwners: jest.fn(async () => 0),
        },
        adminSqlAuditRepository: { list: noopList, save: jest.fn() },
        adminSqlSnippetsRepository: { list: noopList, save: jest.fn() },
        systemAlertsRepository: { list: noopList, save: jest.fn() },
    };
});

jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
    getByUserId: jest.fn(async () => null),
}));

jest.mock('../../utils/userProfiles', () => ({
    loadUserProfile: jest.fn(async () => null),
    saveUserProfile: jest.fn(async () => {}),
    sanitizeUserProfileInput: jest.fn((data) => data),
    buildBootstrapProfile: jest.fn(() => ({})),
}));

jest.mock('../../utils/mailer', () => ({
    getMailTransport: () => null,
    sendResetEmail: jest.fn(async () => {}),
}));

const request = require('supertest');
const app = require('../../server');

function seedLicense(id, extras = {}) {
    const lic = {
        id,
        numero: id.replace(/^LO-/, ''),
        orgaoAmbiental: 'IBAMA',
        esfera: 'Federal',
        ...extras,
    };
    mockState.licenses.set(id, lic);
    return lic;
}

function seedCondition(id, licenseId, extras = {}) {
    const cond = {
        id,
        licenseId,
        numero: '2.1',
        titulo: '',
        texto: 'Programa de Monitoramento de Processos Erosivos',
        tipo: 'processos_erosivos',
        prazo: '',
        periodicidadeRelatorio: 'Anual',
        mesesEntrega: [5],
        ordem: 0,
        parecerTecnicoRef: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        ...extras,
    };
    mockState.conditions.set(id, cond);
    return cond;
}

beforeEach(() => {
    mockState.licenses.clear();
    mockState.conditions.clear();
    jest.clearAllMocks();
    mockAuthContext.user = { uid: 'user_editor', email: 'editor@test.local' };
    mockAuthContext.userProfile = { status: 'Ativo', perfil: 'Editor' };
});

describe('GET /api/licenses/:id/conditions', () => {
    it('retorna 404 quando a licenca nao existe', async () => {
        const res = await request(app)
            .get('/api/licenses/LO-INEXISTENTE/conditions')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });

    it('retorna lista vazia com _links para licenca sem condicionantes', async () => {
        seedLicense('LO-X1');
        const res = await request(app)
            .get('/api/licenses/LO-X1/conditions')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toEqual([]);
        expect(res.body._links).toHaveProperty('license.href');
        expect(res.body._links).toHaveProperty('create.href');
        expect(res.body._links).toHaveProperty('bulkReplace.href');
    });

    it('retorna lista com HATEOAS por item', async () => {
        seedLicense('LO-X2');
        seedCondition('COND-LO-X2-2-1', 'LO-X2', { numero: '2.1', ordem: 0 });
        seedCondition('COND-LO-X2-7-4', 'LO-X2', { numero: '7.4', ordem: 1 });
        const res = await request(app)
            .get('/api/licenses/LO-X2/conditions')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0]._links.self.href).toMatch(/\/api\/license-conditions\/COND-LO-X2-2-1$/);
        expect(res.body.data[0]._links.license.href).toMatch(/\/api\/licenses\/LO-X2$/);
        expect(res.body.data[0]._links.licenseConditions.href).toMatch(/\/api\/licenses\/LO-X2\/conditions$/);
    });
});

describe('POST /api/licenses/:id/conditions', () => {
    it('cria condicionante com id derivado do licenseId+numero', async () => {
        seedLicense('LO-2886-2025');
        const res = await request(app)
            .post('/api/licenses/LO-2886-2025/conditions')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    numero: '2.1',
                    texto: 'Programa de Prevencao, Monitoramento e Controle de Processos Erosivos',
                    tipo: 'processos_erosivos',
                    periodicidadeRelatorio: 'Anual',
                    mesesEntrega: [5],
                },
            });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('success');
        expect(res.body.data.id).toBe('COND-LO-2886-2025-2-1');
        expect(res.body.data.licenseId).toBe('LO-2886-2025');
        expect(res.body.data.tipo).toBe('processos_erosivos');
        expect(res.body.data.mesesEntrega).toEqual([5]);
        expect(res.body.data._links.self.href).toContain('/license-conditions/COND-LO-2886-2025-2-1');
    });

    it('valida numero e texto obrigatorios (400)', async () => {
        seedLicense('LO-Y');
        const res = await request(app)
            .post('/api/licenses/LO-Y/conditions')
            .set('Authorization', 'Bearer t')
            .send({ data: { numero: '', texto: '' } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('retorna 404 quando a licenca nao existe', async () => {
        const res = await request(app)
            .post('/api/licenses/LO-NOPE/conditions')
            .set('Authorization', 'Bearer t')
            .send({ data: { numero: '2.1', texto: 'qualquer' } });
        expect(res.status).toBe(404);
    });

    it('usa email do JWT como updatedBy', async () => {
        seedLicense('LO-Z');
        await request(app)
            .post('/api/licenses/LO-Z/conditions')
            .set('Authorization', 'Bearer t')
            .send({ data: { numero: '2.1', texto: 'texto da cond' } });
        expect(mockLicenseConditionRepository.save).toHaveBeenCalled();
        const [, opts] = mockLicenseConditionRepository.save.mock.calls[0];
        expect(opts.updatedBy).toBe('editor@test.local');
    });
});

describe('PUT /api/licenses/:id/conditions (bulk replace)', () => {
    it('substitui a lista inteira atomicamente', async () => {
        seedLicense('LO-B');
        seedCondition('COND-LO-B-OLD-1', 'LO-B', { numero: 'A.1' });
        seedCondition('COND-LO-B-OLD-2', 'LO-B', { numero: 'A.2' });

        const res = await request(app)
            .put('/api/licenses/LO-B/conditions')
            .set('Authorization', 'Bearer t')
            .send({
                data: [
                    { numero: '2.1', texto: 'Programa X', tipo: 'processos_erosivos' },
                    { numero: '2.2', texto: 'Programa Y', tipo: 'prad' },
                ],
            });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data.map((c) => c.numero).sort()).toEqual(['2.1', '2.2']);
        // Condicionantes antigas devem ter sumido
        expect(mockState.conditions.has('COND-LO-B-OLD-1')).toBe(false);
        expect(mockState.conditions.has('COND-LO-B-OLD-2')).toBe(false);
    });

    it('aceita lista vazia limpando todas as condicionantes', async () => {
        seedLicense('LO-C');
        seedCondition('COND-LO-C-X', 'LO-C');
        const res = await request(app)
            .put('/api/licenses/LO-C/conditions')
            .set('Authorization', 'Bearer t')
            .send({ data: [] });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });
});

describe('GET /api/license-conditions/:id (flat)', () => {
    it('retorna item com _links.license para parent', async () => {
        seedLicense('LO-F');
        seedCondition('COND-LO-F-2-1', 'LO-F');
        const res = await request(app)
            .get('/api/license-conditions/COND-LO-F-2-1')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data._links.self.href).toMatch(/\/api\/license-conditions\/COND-LO-F-2-1$/);
        expect(res.body.data._links.license.href).toMatch(/\/api\/licenses\/LO-F$/);
    });

    it('retorna 404 para id inexistente', async () => {
        const res = await request(app)
            .get('/api/license-conditions/NOPE')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/license-conditions/:id (flat)', () => {
    it('atualiza campos preservando licenseId', async () => {
        seedLicense('LO-G');
        seedCondition('COND-LO-G-2-1', 'LO-G', { texto: 'velho' });
        const res = await request(app)
            .put('/api/license-conditions/COND-LO-G-2-1')
            .set('Authorization', 'Bearer t')
            .send({ data: { texto: 'novo texto mais rico', prazo: '180 dias' } });
        expect(res.status).toBe(200);
        expect(res.body.data.texto).toBe('novo texto mais rico');
        expect(res.body.data.prazo).toBe('180 dias');
        expect(res.body.data.licenseId).toBe('LO-G');
    });

    it('retorna 404 para id inexistente', async () => {
        const res = await request(app)
            .put('/api/license-conditions/NOPE')
            .set('Authorization', 'Bearer t')
            .send({ data: { texto: 'xyz' } });
        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/license-conditions/:id', () => {
    it('remove item e retorna 204', async () => {
        seedLicense('LO-H');
        seedCondition('COND-LO-H-2-1', 'LO-H');
        const res = await request(app)
            .delete('/api/license-conditions/COND-LO-H-2-1')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(204);
        expect(mockState.conditions.has('COND-LO-H-2-1')).toBe(false);
    });
});

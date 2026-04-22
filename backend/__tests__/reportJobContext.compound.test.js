// Unit test para anexo de fichas de erosao simplificada no contexto de job do
// tipo `report_compound`. Foco: respeitar o modo `anexoFichasMode`
// (none/all/selected), enriquecer com UTM e ordenar por numero da torre.

// Variaveis com prefixo `mock` sao permitidas dentro de factories de jest.mock.
const mockJobs = new Map();
const mockCompounds = new Map();
const mockWorkspaces = new Map();
const mockPhotos = new Map();
const mockProjects = new Map();
const mockErosionsById = new Map();
const mockErosionsByProject = new Map();

jest.mock('../repositories', () => ({
    reportJobRepository: {
        getById: jest.fn(async (id) => mockJobs.get(id) || null),
        save: jest.fn(),
    },
    reportCompoundRepository: {
        getById: jest.fn(async (id) => mockCompounds.get(id) || null),
    },
    reportWorkspaceRepository: {
        getById: jest.fn(async (id) => mockWorkspaces.get(id) || null),
    },
    reportPhotoRepository: {
        listByWorkspace: jest.fn(async (id) => mockPhotos.get(id) || []),
    },
    projectRepository: {
        getById: jest.fn(async (id) => mockProjects.get(id) || null),
    },
    erosionRepository: {
        getById: jest.fn(async (id) => mockErosionsById.get(id) || null),
        listByProject: jest.fn(async (pid) => mockErosionsByProject.get(pid) || []),
    },
    reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
    operatingLicenseRepository: {},
    inspectionRepository: {},
    reportDeliveryTrackingRepository: {},
    projectDossierRepository: {},
    workspaceKmzRequestRepository: {},
}));

const { buildReportJobContext } = require('../utils/reportJobContext');

function resetStubs() {
    mockJobs.clear();
    mockCompounds.clear();
    mockWorkspaces.clear();
    mockPhotos.clear();
    mockProjects.clear();
    mockErosionsById.clear();
    mockErosionsByProject.clear();
}

function setupBase() {
    mockJobs.set('JOB-1', { id: 'JOB-1', kind: 'report_compound', compoundId: 'RC-1' });
    mockCompounds.set('RC-1', {
        id: 'RC-1',
        nome: 'Composto Alfa',
        workspaceIds: ['RW-1'],
        orderJson: ['RW-1'],
        sharedTextsJson: {},
    });
    mockWorkspaces.set('RW-1', { id: 'RW-1', nome: 'WS 1', projectId: 'PRJ-01', photoSortMode: 'tower_asc' });
    mockProjects.set('PRJ-01', { id: 'PRJ-01', nome: 'Projeto Alfa' });
}

describe('buildReportJobContext - anexo de fichas simplificada', () => {
    beforeEach(resetStubs);

    it('omite anexoFichas quando modo = none', async () => {
        setupBase();
        mockCompounds.get('RC-1').sharedTextsJson = { anexoFichasMode: 'none' };
        const ctx = await buildReportJobContext('JOB-1');
        expect(ctx.renderModel.compound.anexoFichas).toBeUndefined();
    });

    it('modo all carrega todas erosoes dos projetos dos workspaces e ordena por torre', async () => {
        setupBase();
        mockErosionsByProject.set('PRJ-01', [
            { id: 'E-09', torreRef: 'T-09', projectId: 'PRJ-01', latitude: -22, longitude: -43 },
            { id: 'E-02', torreRef: 'T-02', projectId: 'PRJ-01', latitude: -22, longitude: -43 },
            { id: 'E-100', torreRef: 'T-100', projectId: 'PRJ-01', latitude: -22, longitude: -43 },
        ]);
        mockCompounds.get('RC-1').sharedTextsJson = { anexoFichasMode: 'all' };
        const ctx = await buildReportJobContext('JOB-1');
        const ordered = ctx.renderModel.compound.anexoFichas.erosions.map((e) => e.id);
        expect(ordered).toEqual(['E-02', 'E-09', 'E-100']);
        expect(ctx.renderModel.compound.anexoFichas.projectName).toBe('Projeto Alfa');
    });

    it('modo selected busca apenas as erosoes listadas em anexoFichasErosionIds', async () => {
        setupBase();
        mockErosionsById.set('E-A', { id: 'E-A', torreRef: 'T-05', projectId: 'PRJ-01', latitude: -22, longitude: -43 });
        mockErosionsById.set('E-B', { id: 'E-B', torreRef: 'T-01', projectId: 'PRJ-01', latitude: -22, longitude: -43 });
        mockCompounds.get('RC-1').sharedTextsJson = {
            anexoFichasMode: 'selected',
            anexoFichasErosionIds: ['E-A', 'E-B'],
        };
        const ctx = await buildReportJobContext('JOB-1');
        const ordered = ctx.renderModel.compound.anexoFichas.erosions.map((e) => e.id);
        expect(ordered).toEqual(['E-B', 'E-A']);
    });

    it('modo selected sem ids nao gera anexoFichas', async () => {
        setupBase();
        mockCompounds.get('RC-1').sharedTextsJson = {
            anexoFichasMode: 'selected',
            anexoFichasErosionIds: [],
        };
        const ctx = await buildReportJobContext('JOB-1');
        expect(ctx.renderModel.compound.anexoFichas).toBeUndefined();
    });

    it('erosoes sem torreRef vao para o fim da lista', async () => {
        setupBase();
        mockErosionsByProject.set('PRJ-01', [
            { id: 'E-SEM', projectId: 'PRJ-01', latitude: -22, longitude: -43 },
            { id: 'E-T3', torreRef: 'T-03', projectId: 'PRJ-01', latitude: -22, longitude: -43 },
        ]);
        mockCompounds.get('RC-1').sharedTextsJson = { anexoFichasMode: 'all' };
        const ctx = await buildReportJobContext('JOB-1');
        const ordered = ctx.renderModel.compound.anexoFichas.erosions.map((e) => e.id);
        expect(ordered).toEqual(['E-T3', 'E-SEM']);
    });
});

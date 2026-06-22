// Unit test para o contexto de job do tipo `monthly_report`: o renderModel
// devolve o relatorio cru (engineers aninhados, textos, feriados explicitos)
// + contrato das settings globais do dono. A fixture compartilhada com o
// worker (pytest) garante paridade estrutural entre backend e renderer.

const fs = require('fs');
const path = require('path');

// Variaveis com prefixo `mock` sao permitidas dentro de factories de jest.mock.
const mockJobs = new Map();
const mockReports = new Map();
let mockSettings = null;

jest.mock('../repositories', () => ({
    reportJobRepository: {
        getById: jest.fn(async (id) => mockJobs.get(id) || null),
        save: jest.fn(),
    },
    monthlyReportRepository: {
        getFull: jest.fn(async (id, owner) => {
            const report = mockReports.get(id);
            return report && report.ownerUserId === owner ? report : null;
        }),
    },
    monthlyReportSettingsRepository: {
        getByOwner: jest.fn(async () => mockSettings),
    },
    reportCompoundRepository: {},
    reportWorkspaceRepository: {},
    reportPhotoRepository: {},
    projectRepository: {},
    erosionRepository: {},
    reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
    operatingLicenseRepository: {},
    inspectionRepository: {},
    reportDeliveryTrackingRepository: {},
    projectDossierRepository: {},
    workspaceKmzRequestRepository: {},
}));

const { buildReportJobContext } = require('../utils/reportJobContext');

const FIXTURE_PATH = path.join(__dirname, '..', '..', 'worker', 'tests', 'fixtures', 'monthly_report_render_model.json');
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

function sampleReport() {
    const { contrato, ...reportFields } = fixture.monthlyReport;
    return {
        ...reportFields,
        ownerUserId: 'owner-1',
        version: 3,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-15T00:00:00Z',
        updatedBy: 'ana@empresa.com',
    };
}

beforeEach(() => {
    mockJobs.clear();
    mockReports.clear();
    mockSettings = null;
    mockJobs.set('JOB-1', { id: 'JOB-1', kind: 'monthly_report', monthlyReportId: 'MR-FIXTURE', ownerUserId: 'owner-1' });
});

describe('buildReportJobContext - monthly_report', () => {
    it('monta o renderModel com engineers aninhados e contrato das settings', async () => {
        mockReports.set('MR-FIXTURE', sampleReport());
        mockSettings = {
            ownerUserId: 'owner-1',
            team: [{ id: 'mem-1', name: 'Matheus Lima' }],
            contrato: fixture.monthlyReport.contrato,
        };

        const ctx = await buildReportJobContext('JOB-1');
        const model = ctx.renderModel.monthlyReport;

        expect(model.id).toBe('MR-FIXTURE');
        expect(model.quadroStyle).toBe('marcador');
        expect(model.intro).toContain('16 de abril');
        expect(model.conclusao).toContain('campanhas de vistoria');
        expect(model.holidays).toHaveLength(3);
        expect(model.engineers).toHaveLength(2);
        expect(model.engineers[0].activities[0].category).toBe('relatorio');
        expect(model.engineers[1].projects[0].name).toContain('UHE Serra da Mesa');
        expect(model.contrato.numero).toBe('30001490');
    });

    it('paridade estrutural com a fixture compartilhada do worker', async () => {
        mockReports.set('MR-FIXTURE', sampleReport());
        mockSettings = { ownerUserId: 'owner-1', team: [], contrato: fixture.monthlyReport.contrato };

        const ctx = await buildReportJobContext('JOB-1');
        const model = ctx.renderModel.monthlyReport;

        // Toda chave presente na fixture existe no renderModel construido —
        // se o shape divergir, backend e worker quebram juntos aqui e no pytest.
        for (const key of Object.keys(fixture.monthlyReport)) {
            expect(model).toHaveProperty(key);
        }
        expect(model.engineers[0]).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            activities: expect.any(Array),
            projects: expect.any(Array),
        });
    });

    it('usa contrato vazio quando nao ha settings salvas', async () => {
        mockReports.set('MR-FIXTURE', sampleReport());
        mockSettings = null;

        const ctx = await buildReportJobContext('JOB-1');
        expect(ctx.renderModel.monthlyReport.contrato).toEqual({ numero: '', objeto: '', contratante: '', contratada: '' });
    });

    it('404 quando o relatorio nao existe para o dono', async () => {
        mockJobs.set('JOB-2', { id: 'JOB-2', kind: 'monthly_report', monthlyReportId: 'MR-x', ownerUserId: 'owner-1' });
        await expect(buildReportJobContext('JOB-2')).rejects.toMatchObject({ statusCode: 404 });
    });
});

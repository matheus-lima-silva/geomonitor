const request = require('supertest');
const app = require('../server');
const { getDocRef } = require('../utils/firebaseSetup');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Project Dossiers API Integration Tests (Mocked DB)', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'PRJ-01', nome: 'Projeto 1' } });

        await request(app)
            .post('/api/licenses')
            .set(AUTH_HEADER)
            .send({ data: { id: 'LO-PRJ-01', projetoId: 'PRJ-01', orgao: 'IBAMA' } });

        await request(app)
            .post('/api/inspections')
            .set(AUTH_HEADER)
            .send({ data: { id: 'VS-PRJ-01', projetoId: 'PRJ-01', dataInicio: '2026-03-01' } });

        await request(app)
            .post('/api/report-delivery-tracking')
            .set(AUTH_HEADER)
            .send({ data: { projectId: 'PRJ-01', monthKey: '2026-03', operationalStatus: 'Entregue' } });

        await getDocRef('erosions', 'ERS-DOS-01').set({
            id: 'ERS-DOS-01',
            projectId: 'PRJ-01',
            status: 'aberta',
        });

        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-20', nome: 'Workspace', projectId: 'PRJ-01' } });

        await request(app)
            .put('/api/report-workspaces/RW-20/photos/RPH-20')
            .set(AUTH_HEADER)
            .send({ data: { projectId: 'PRJ-01', caption: 'Foto', includeInReport: true } });
    });

    it('cria dossie, roda preflight e enfileira geracao', async () => {
        const createResponse = await request(app)
            .post('/api/projects/PRJ-01/dossiers')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Dossie mensal',
                    observacoes: 'Escopo inicial',
                    scopeJson: {
                        includeLicencas: true,
                        includeInspecoes: true,
                        includeErosoes: false,
                        includeEntregas: true,
                        includeWorkspaces: true,
                        includeFotos: false,
                    },
                },
            });

        expect(createResponse.status).toBe(201);
        const dossierId = createResponse.body.data.id;

        const preflightResponse = await request(app)
            .post(`/api/projects/PRJ-01/dossiers/${dossierId}/preflight`)
            .set(AUTH_HEADER);

        expect(preflightResponse.status).toBe(200);
        expect(preflightResponse.body.data.scope).toEqual(expect.objectContaining({
            includeLicencas: true,
            includeInspecoes: true,
            includeErosoes: false,
            includeEntregas: true,
            includeWorkspaces: true,
            includeFotos: false,
        }));
        expect(preflightResponse.body.data.summary.inspectionCount).toBe(1);
        expect(preflightResponse.body.data.summary.licenseCount).toBe(1);
        expect(preflightResponse.body.data.summary.erosionCount).toBe(1);
        expect(preflightResponse.body.data.summary.deliveryTrackingCount).toBe(1);
        expect(preflightResponse.body.data.summary.workspaceCount).toBeGreaterThanOrEqual(1);
        expect(preflightResponse.body.data.canGenerate).toBe(true);

        const generateResponse = await request(app)
            .post(`/api/projects/PRJ-01/dossiers/${dossierId}/generate`)
            .set(AUTH_HEADER);

        expect(generateResponse.status).toBe(202);
        expect(generateResponse.body.data.status).toBe('queued');
        expect(generateResponse.body.data._links.generate.href).toContain(`/api/projects/PRJ-01/dossiers/${dossierId}/generate`);
    });

    it('marca preflight como nao-geravel quando o escopo do dossie esta vazio', async () => {
        const createResponse = await request(app)
            .post('/api/projects/PRJ-01/dossiers')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Dossie vazio',
                    scopeJson: {
                        includeLicencas: false,
                        includeInspecoes: false,
                        includeErosoes: false,
                        includeEntregas: false,
                        includeWorkspaces: false,
                        includeFotos: false,
                    },
                },
            });

        const dossierId = createResponse.body.data.id;

        const preflightResponse = await request(app)
            .post(`/api/projects/PRJ-01/dossiers/${dossierId}/preflight`)
            .set(AUTH_HEADER);

        expect(preflightResponse.status).toBe(200);
        expect(preflightResponse.body.data.canGenerate).toBe(false);
        expect(preflightResponse.body.data.warnings).toContain('O escopo do dossie esta vazio. Selecione ao menos uma secao editorial.');
    });
});

// Fase 6.3: reportPhotoRepository.save auto-popula distancias/flags via PostGIS,
// respeitando manual_override.
const mockQuery = jest.fn(async () => ({
    rows: [{ id: 'PH1', payload: {}, created_at: new Date(), updated_at: new Date() }],
}));
jest.mock('../data/postgresStore', () => ({ query: mockQuery, connect: jest.fn() }));

const mockCompute = jest.fn();
jest.mock('../utils/geoDistance', () => ({ computeGeoDistance: mockCompute }));

const mockGetDefaults = jest.fn(async () => ({ faixaBufferMetersSide: 150, baseTowerRadiusMeters: 25 }));
jest.mock('../repositories/reportDefaultsRepository', () => ({ getByProjectId: mockGetDefaults }));

const repo = require('../repositories/reportPhotoRepository');

function insertCall() {
    return mockQuery.mock.calls.find((c) => /INSERT INTO report_photos/.test(c[0]));
}

beforeEach(() => {
    mockQuery.mockClear();
    mockCompute.mockReset();
    mockGetDefaults.mockClear();
});

describe('reportPhotoRepository.save auto-distancia (6.3)', () => {
    it('calcula e grava distancias/flags quando ha coords+projeto e sem override', async () => {
        mockCompute.mockResolvedValueOnce({
            distanceToAxisM: 8, distanceToTowerM: 3, insideRightOfWay: true, insideTowerRadius: false,
        });

        await repo.save({ id: 'PH1', workspaceId: 'W1', projectId: 'P1', gpsLat: -22.9, gpsLon: -43.2 });

        expect(mockGetDefaults).toHaveBeenCalledWith('P1');
        expect(mockCompute).toHaveBeenCalledWith({
            projectId: 'P1',
            lat: -22.9,
            lon: -43.2,
            faixaBufferM: 150,
            towerRadiusM: 25,
        });
        const params = insertCall()[1];
        expect(params).toContain(8); // distance_to_axis_m
        expect(params).toContain(3); // distance_to_tower_m
        expect(params).toContain(true); // inside_right_of_way
    });

    it('NAO calcula quando manual_override esta setado', async () => {
        await repo.save({ id: 'PH1', workspaceId: 'W1', projectId: 'P1', gpsLat: -22.9, gpsLon: -43.2, manualOverride: true });
        expect(mockCompute).not.toHaveBeenCalled();
    });

    it('NAO calcula quando faltam coordenadas', async () => {
        await repo.save({ id: 'PH1', workspaceId: 'W1', projectId: 'P1' });
        expect(mockCompute).not.toHaveBeenCalled();
    });

    it('nao quebra o save se o calculo geografico falhar', async () => {
        mockCompute.mockRejectedValueOnce(new Error('postgis down'));
        const result = await repo.save({ id: 'PH1', workspaceId: 'W1', projectId: 'P1', gpsLat: -22.9, gpsLon: -43.2 });
        expect(result).toBeTruthy();
        expect(insertCall()).toBeTruthy(); // o INSERT ainda aconteceu
    });
});

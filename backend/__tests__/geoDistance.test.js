const mockQuery = jest.fn();
jest.mock('../data/postgresStore', () => ({ query: mockQuery }));

const {
    computeGeoDistance,
    resolveEffectiveStructureDistance,
} = require('../utils/geoDistance');

describe('resolveEffectiveStructureDistance (modelo hibrido)', () => {
    it('override usa o valor manual mesmo com calculado presente', () => {
        expect(resolveEffectiveStructureDistance({ manualOverride: true, manualValue: 12, computed: 40 })).toBe(12);
    });

    it('sem override usa o calculado quando disponivel', () => {
        expect(resolveEffectiveStructureDistance({ manualOverride: false, manualValue: 12, computed: 40 })).toBe(40);
    });

    it('cai no manual quando nao ha calculado', () => {
        expect(resolveEffectiveStructureDistance({ manualOverride: false, manualValue: 12, computed: null })).toBe(12);
    });

    it('retorna null quando nada disponivel', () => {
        expect(resolveEffectiveStructureDistance({ manualOverride: false, manualValue: null, computed: null })).toBeNull();
    });

    it('aceita zero como distancia valida (nao confunde com ausente)', () => {
        expect(resolveEffectiveStructureDistance({ manualOverride: false, manualValue: 99, computed: 0 })).toBe(0);
    });
});

describe('computeGeoDistance', () => {
    beforeEach(() => mockQuery.mockReset());

    it('retorna null sem projectId ou coordenadas (sem tocar o banco)', async () => {
        expect(await computeGeoDistance({ projectId: '', lat: -22, lon: -43 })).toBeNull();
        expect(await computeGeoDistance({ projectId: 'P', lat: 'abc', lon: -43 })).toBeNull();
        expect(await computeGeoDistance({ projectId: 'P', lat: -22, lon: null })).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('retorna null quando o projeto nao tem geometria (0 rows)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        expect(await computeGeoDistance({ projectId: 'P', lat: -22, lon: -43 })).toBeNull();
    });

    it('mapeia a row e envia lon/lat + buffers na ordem certa', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                distance_to_axis_m: 10.5,
                distance_to_tower_m: 3.2,
                inside_right_of_way: true,
                inside_tower_radius: false,
            }],
        });
        const r = await computeGeoDistance({ projectId: 'P', lat: -22, lon: -43, faixaBufferM: 150, towerRadiusM: 25 });
        expect(r).toEqual({
            distanceToAxisM: 10.5,
            distanceToTowerM: 3.2,
            insideRightOfWay: true,
            insideTowerRadius: false,
        });
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('ST_Distance');
        expect(sql).toContain('ST_DWithin');
        expect(sql).toContain('project_geometries');
        // ordem: projectId, lon, lat, faixa, raio
        expect(params).toEqual(['P', -43, -22, 150, 25]);
    });

    it('aplica os buffers default quando nao informados', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ distance_to_axis_m: null, distance_to_tower_m: 1, inside_right_of_way: false, inside_tower_radius: true }],
        });
        await computeGeoDistance({ projectId: 'P', lat: -22, lon: -43 });
        const [, params] = mockQuery.mock.calls[0];
        expect(params[3]).toBe(200); // faixa default
        expect(params[4]).toBe(30); // raio de torre default
    });
});

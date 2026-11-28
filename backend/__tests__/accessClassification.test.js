const {
    buildRuns,
    buildSegments,
    lineLength,
    samplePoints,
    suggestTower,
    normalizeTowers,
    buildFlags,
    summarizeSegments,
} = require('../utils/accessClassification');
const { classifySurface, projectBbox, tilesForBbox, tilesAroundTowers, tileKey, buildOverpassQuery, parseOverpassWays } = require('../utils/osmRoads');
const { buildAccessPreview } = require('../utils/towerAccessPreview');

// Linha reta norte-sul de ~1.000 m (0,009 grau de latitude) em -47.
const LINE = Array.from({ length: 11 }, (_, i) => [-47, -21 + i * 0.0009]);
const TOWERS = normalizeTowers([
    { numero: '104', latitude: -20.991, longitude: -47.0002 }, // ~20 m da ponta final
    { numero: '200', latitude: -21.5, longitude: -47.5 },
    { numero: 'x', latitude: 'abc', longitude: -47 },
]);

describe('accessClassification', () => {
    it('amostra a cada ~10 m e mede o comprimento', () => {
        const length = lineLength(LINE);
        expect(length).toBeGreaterThan(995);
        expect(length).toBeLessThan(1005);
        const samples = samplePoints(LINE, 10);
        expect(samples.length).toBe(Math.ceil(length / 10));
        expect(samples[0].from).toBe(0);
    });

    it('funde trechos curtos (cruzamento de via) no vizinho mais longo', () => {
        const samples = [
            ...Array.from({ length: 40 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, tipo: 'terra', inferido: true })),
            ...Array.from({ length: 2 }, (_, i) => ({ from: 400 + i * 10, to: 410 + i * 10, tipo: 'asfalto' })),
            ...Array.from({ length: 30 }, (_, i) => ({ from: 420 + i * 10, to: 430 + i * 10, tipo: 'acesso' })),
        ];
        const runs = buildRuns(samples);
        expect(runs.map((r) => r.tipo)).toEqual(['terra', 'acesso']);
        expect(runs[0].to).toBe(420);
    });

    it('gera trechos com coordenadas proprias que cobrem a linha inteira', () => {
        const samples = samplePoints(LINE, 10).map((s) => ({ ...s, tipo: s.from < 600 ? 'terra' : 'acesso', inferido: s.from < 600 }));
        const segments = buildSegments(LINE, samples);
        expect(segments.map((s) => s.tipo)).toEqual(['terra', 'acesso']);
        expect(segments[0].coordinates[0]).toEqual(LINE[0]);
        expect(segments[1].coordinates[segments[1].coordinates.length - 1]).toEqual(LINE[LINE.length - 1]);
        expect(segments[0].inferido).toBe(true);
        expect(segments[1].inferido).toBe(false);
        const resumo = summarizeSegments(segments);
        expect(resumo.terra + resumo.acesso).toBeGreaterThan(990);
    });

    it('liga a linha a torre da ponta e orienta entrada -> torre', () => {
        const reversed = [...LINE].reverse(); // comeca na torre
        const s = suggestTower(reversed, TOWERS);
        expect(s.action).toBe('acesso');
        expect(s.towerNumber).toBe('104');
        expect(s.relation).toBe('ponta');
        expect(s.coordinates[s.coordinates.length - 1]).toEqual(LINE[LINE.length - 1]);
    });

    it('linha que so passa perto vira rota-guia com torre sugerida; longe demais, ignorar', () => {
        const passing = [[-47.0003, -20.99], [-47.0001, -20.9912], [-47.0003, -20.993]];
        // pontas a ~110 m e ~220 m; vertice do meio a ~20 m da torre 104
        expect(suggestTower(passing, TOWERS)).toMatchObject({ action: 'rota_guia', towerNumber: '104', relation: 'passa' });
        const far = [[-45, -20], [-45.001, -20.001]];
        expect(suggestTower(far, TOWERS)).toMatchObject({ action: 'ignorar', towerNumber: null });
    });

    it('sinaliza acesso curto, tipo inferido e falta de OSM', () => {
        const segments = [
            { tipo: 'terra', inferido: true, comprimentoM: 500 },
            { tipo: 'acesso', inferido: false, comprimentoM: 12 },
        ];
        expect(buildFlags({ suggestion: { action: 'acesso', relation: 'ponta' }, segments, osmLoaded: false }))
            .toEqual(['sem_osm', 'tipo_inferido', 'acesso_curto']);
    });
});

describe('osmRoads', () => {
    it('classifica pela tag surface ou pelo tipo de via', () => {
        expect(classifySurface('unclassified', 'asphalt')).toEqual({ surfaceClass: 'asfalto', inferred: false });
        expect(classifySurface('primary', 'gravel')).toEqual({ surfaceClass: 'terra', inferred: false });
        expect(classifySurface('secondary_link', undefined)).toEqual({ surfaceClass: 'asfalto', inferred: true });
        expect(classifySurface('unclassified', '')).toEqual({ surfaceClass: 'terra', inferred: true });
    });

    it('calcula envelope do projeto, ladrilhos e consulta', () => {
        const bbox = projectBbox([{ latitude: -21, longitude: -47 }, { latitude: -21.9, longitude: -46.1 }, { latitude: 'x', longitude: 1 }], 0.05);
        expect(bbox.minLon).toBeCloseTo(-47.05);
        expect(bbox.maxLat).toBeCloseTo(-20.95);
        const tiles = tilesForBbox(bbox, 0.5);
        expect(tiles).toHaveLength(4);
        expect(buildOverpassQuery(tiles[0])).toContain('way["highway"~"^(motorway|');
        expect(projectBbox([])).toBeNull();
    });

    it('ladrilhos so em volta das torres, alinhados e sem repetir entre empreendimentos', () => {
        const tiles = tilesAroundTowers([
            { longitude: -47.05, latitude: -21.05, projectId: 'A' },
            { longitude: -47.06, latitude: -21.06, projectId: 'B' }, // mesma celula
            { longitude: -47.01, latitude: -21.15, projectId: 'A' }, // perto da borda: pega a vizinha a leste
            { longitude: 'x', latitude: -21, projectId: 'C' },
        ], 0.2, 0.03);
        expect(tiles.map((t) => t.key)).toEqual(['-47.2000,-21.2000', '-47.0000,-21.2000']);
        expect(tiles[0]).toMatchObject({ minLon: -47.2, maxLon: -47, minLat: -21.2, maxLat: -21, projectIds: ['A', 'B'] });
        expect(tiles[1].projectIds).toEqual(['A']);
        expect(tileKey({ minLon: -47.2000000001, minLat: -21.2 })).toBe('-47.2000,-21.2000');
    });

    it('converte a resposta do Overpass', () => {
        const roads = parseOverpassWays({ elements: [
            { type: 'way', id: 1, tags: { highway: 'unclassified', surface: 'dirt', name: 'Estrada' }, geometry: [{ lat: -21, lon: -47 }, { lat: -21.001, lon: -47.001 }] },
            { type: 'way', id: 2, tags: { highway: 'primary' }, geometry: [{ lat: -21, lon: -47 }] },
            { type: 'node', id: 3 },
        ] });
        expect(roads).toHaveLength(1);
        expect(roads[0]).toMatchObject({ osmId: 1, surfaceClass: 'terra', surfaceInferred: false, name: 'Estrada' });
        expect(roads[0].coordinates[0]).toEqual([-47, -21]);
    });
});

describe('buildAccessPreview', () => {
    it('pinta os trechos com as vias do OSM e ordena acessos primeiro', async () => {
        const repo = {
            hasCoverage: jest.fn(async () => true),
            // primeiros 60% da linha numa estrada de terra, resto fora de via publica
            classifyPoints: jest.fn(async (points) => points.map(([, lat]) => (lat < -20.9946 ? { surfaceClass: 'terra', inferred: false } : null))),
        };
        const preview = await buildAccessPreview({
            features: [
                { id: 'f0', name: 'Longe', geometry: { type: 'LineString', coordinates: [[-45, -20], [-45.001, -20.001]] } },
                { id: 'f1', name: 'Acesso 104', geometry: { type: 'LineString', coordinates: LINE } },
            ],
            torresCoordenadas: [{ numero: '104', latitude: -20.991, longitude: -47.0002 }],
            osmRoadRepository: repo,
        });
        expect(preview.meta.osmLoaded).toBe(true);
        expect(preview.items.map((i) => i.featureId)).toEqual(['f1', 'f0']);
        const access = preview.items[0];
        expect(access).toMatchObject({ action: 'acesso', towerNumber: '104', relation: 'ponta' });
        expect(access.segments.map((s) => s.tipo)).toEqual(['terra', 'acesso']);
        expect(access.flags).toEqual([]);
        expect(preview.meta.totals).toEqual({ acesso: 1, ignorar: 1 });
    });

    it('sem OSM carregado nao consulta as vias e marca tudo como acesso', async () => {
        const repo = { hasCoverage: jest.fn(async () => false), classifyPoints: jest.fn() };
        const preview = await buildAccessPreview({
            features: [{ id: 'f1', geometry: { type: 'LineString', coordinates: LINE } }],
            torresCoordenadas: [],
            osmRoadRepository: repo,
        });
        expect(repo.classifyPoints).not.toHaveBeenCalled();
        expect(preview.items[0].segments.map((s) => s.tipo)).toEqual(['acesso']);
        expect(preview.items[0].flags).toContain('sem_osm');
    });
});

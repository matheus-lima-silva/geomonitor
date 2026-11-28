const { computeTerrainStats, computeLandCoverStats } = require('../utils/terrainStats');
const { SOURCES, createRasterReader } = require('../utils/rasterSources');
const { computePointEnvironment } = require('../utils/towerEnvironment');

// Plano inclinado: z sobe para o sul (linha cresce para o sul) => encosta desce para o NORTE.
function plane({ width = 11, height = 11, pixel = 30, riseSouthPerM = 0.2 }) {
    const values = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) values[y * width + x] = 500 + y * pixel * riseSouthPerM;
    }
    return { values, width, height, pixelW: pixel, pixelH: pixel, cx: 5, cy: 5 };
}

describe('computeTerrainStats', () => {
    it('declividade e orientacao de um plano conhecido', () => {
        const out = computeTerrainStats({ ...plane({ riseSouthPerM: 0.2 }), radiusM: 100 });
        // atan(0.2) = 11.3 graus
        expect(out.declividadeMediaGraus).toBeCloseTo(11.3, 1);
        expect(out.declividadeMaxGraus).toBeCloseTo(11.3, 1);
        expect(out.orientacao).toBe('N');
        expect(out.elevacaoM).toBe(530);
        expect(out.pixels).toBeGreaterThan(0);
    });

    it('terreno plano vira "plano" e ignora nodata', () => {
        const p = plane({ riseSouthPerM: 0 });
        p.values[0] = -9999;
        const out = computeTerrainStats({ ...p, radiusM: 100, nodata: -9999 });
        expect(out.declividadeMediaGraus).toBe(0);
        expect(out.orientacao).toBe('plano');
    });
});

describe('computeLandCoverStats', () => {
    it('fracoes no raio e usos sugeridos a partir de 20%', () => {
        const width = 11;
        const values = new Uint8Array(width * width).fill(30); // gramineas
        for (let i = 0; i < width * 4; i += 1) values[i] = 10; // 4 linhas do topo: arvores
        values[5 * width + 5] = 80; // agua no centro
        const out = computeLandCoverStats({ values, width, height: width, pixelW: 10, pixelH: 10, cx: 5, cy: 5, radiusM: 50 });
        expect(out.cobertura['30']).toBeGreaterThan(0.6);
        expect(out.cobertura['10']).toBeGreaterThan(0.1);
        expect(out.usosSoloSugeridos).toContain('pastagem');
        expect(out.usosSoloSugeridos).not.toContain('curso_agua'); // 1 pixel so
        expect(out.classeNoPonto).toBe('Agua');
    });

    it('classes "outro" levam o nome para usoSoloOutro', () => {
        const values = new Uint8Array(25).fill(50);
        const out = computeLandCoverStats({ values, width: 5, height: 5, pixelW: 10, pixelH: 10, cx: 2, cy: 2, radiusM: 30 });
        expect(out.usosSoloSugeridos).toEqual(['outro']);
        expect(out.usoSoloOutroSugerido).toBe('Area urbana/construida');
    });
});

describe('rasterSources', () => {
    it('monta o nome dos ladrilhos (Copernicus 1 grau, WorldCover 3 graus)', () => {
        expect(SOURCES.relevo.tileUrl(-21.83, -47.88)).toContain('Copernicus_DSM_COG_10_S22_00_W048_00_DEM/Copernicus_DSM_COG_10_S22_00_W048_00_DEM.tif');
        expect(SOURCES.cobertura.tileUrl(-21.83, -47.88)).toContain('ESA_WorldCover_10m_2021_v200_S24W048_Map.tif');
        expect(SOURCES.cobertura.tileUrl(-20.9, -45.1)).toContain('S21W048');
    });

    it('le a janela certa e reaproveita a imagem aberta', async () => {
        const readRasters = jest.fn(async ({ window }) => {
            const [l, t, r, b] = window;
            return [new Float32Array((r - l) * (b - t)).fill(700)];
        });
        const image = {
            getBoundingBox: () => [-48, -22, -47, -21],
            getResolution: () => [1 / 3600, -1 / 3600],
            getWidth: () => 3600,
            getHeight: () => 3600,
            getGDALNoData: () => null,
            readRasters,
        };
        const openImage = jest.fn(async () => image);
        const reader = createRasterReader({ openImage });
        const w1 = await reader.readWindow('relevo', -21.5, -47.5, 50);
        await reader.readWindow('relevo', -21.6, -47.6, 50);
        expect(openImage).toHaveBeenCalledTimes(1);
        expect(w1.width).toBeGreaterThan(4);
        expect(w1.pixelH).toBeCloseTo(30.7, 0);
        const [left, top] = readRasters.mock.calls[0][0].window;
        expect(left).toBeLessThan(1800);
        expect(top).toBeLessThan(1800);
        expect(w1.cx).toBeGreaterThan(0);
    });

    it('computePointEnvironment junta relevo e cobertura e registra erro por fonte', async () => {
        const reader = {
            readWindow: jest.fn(async (key) => {
                if (key === 'cobertura') throw new Error('timeout');
                return { ...plane({ riseSouthPerM: 0.1 }), nodata: null };
            }),
        };
        const out = await computePointEnvironment(reader, { lat: -21.8, lon: -47.8, radiusM: 100 });
        expect(out.payload.declividadeMediaGraus).toBeCloseTo(5.7, 1);
        expect(out.errors).toEqual(['cobertura: timeout']);
        expect(out.sources.relevo.nome).toBe('Copernicus DEM GLO-30');
    });
});

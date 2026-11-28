// Atributos do meio fisico num ponto (torre ou erosao): relevo e cobertura do
// solo num raio em volta, lendo so os trechos necessarios dos rasters publicos.
const { computeTerrainStats, computeLandCoverStats } = require('./terrainStats');
const { describeSources } = require('./rasterSources');

const DEFAULT_RADIUS_M = 50;

/**
 * @param {{ readWindow: Function }} reader  de createRasterReader()
 * @returns {Promise<{ payload, sources, errors }>}
 */
async function computePointEnvironment(reader, { lat, lon, radiusM = DEFAULT_RADIUS_M }) {
    const errors = [];
    let terrain = null;
    let cover = null;
    try {
        const dem = await reader.readWindow('relevo', lat, lon, radiusM);
        terrain = computeTerrainStats({ ...dem, radiusM });
    } catch (error) {
        errors.push(`relevo: ${error.message}`);
    }
    try {
        const wc = await reader.readWindow('cobertura', lat, lon, radiusM);
        cover = computeLandCoverStats({ ...wc, radiusM, nodata: 0 });
    } catch (error) {
        errors.push(`cobertura: ${error.message}`);
    }
    return {
        payload: {
            raioM: radiusM,
            ...(terrain || {}),
            ...(cover || {}),
        },
        sources: describeSources(),
        errors,
    };
}

module.exports = { computePointEnvironment, DEFAULT_RADIUS_M };

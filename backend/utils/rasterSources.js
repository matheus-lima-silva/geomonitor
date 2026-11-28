// Leitura direta de rasters publicos em COG (Fases 3/4): so os blocos que cobrem
// a janela pedida sao baixados (requisicoes HTTP Range), sem copiar as bases.
//
//  - relevo: Copernicus DEM GLO-30 (ladrilhos de 1 grau, AWS Open Data)
//  - cobertura: ESA WorldCover 10 m v200 / 2021 (ladrilhos de 3 graus, AWS Open Data)
//
// MapBiomas ficaria aqui tambem, mas em 2026-11 os GeoTIFF publicos dele
// respondiam 403 (acesso negado) mesmo nos links da pagina oficial.

const SOURCES = {
    relevo: {
        nome: 'Copernicus DEM GLO-30',
        versao: '2021',
        licenca: 'Copernicus DEM (c) DLR/Airbus, uso livre',
        tileUrl(lat, lon) {
            const la = Math.floor(lat);
            const lo = Math.floor(lon);
            const ns = la < 0 ? `S${String(-la).padStart(2, '0')}` : `N${String(la).padStart(2, '0')}`;
            const ew = lo < 0 ? `W${String(-lo).padStart(3, '0')}` : `E${String(lo).padStart(3, '0')}`;
            const name = `Copernicus_DSM_COG_10_${ns}_00_${ew}_00_DEM`;
            return `https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/${name}/${name}.tif`;
        },
    },
    cobertura: {
        nome: 'ESA WorldCover 10 m',
        versao: 'v200 (2021)',
        licenca: 'CC BY 4.0, (c) ESA WorldCover project 2021',
        tileUrl(lat, lon) {
            const la = Math.floor(lat / 3) * 3;
            const lo = Math.floor(lon / 3) * 3;
            const ns = la < 0 ? `S${String(-la).padStart(2, '0')}` : `N${String(la).padStart(2, '0')}`;
            const ew = lo < 0 ? `W${String(-lo).padStart(3, '0')}` : `E${String(lo).padStart(3, '0')}`;
            return `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${ns}${ew}_Map.tif`;
        },
    },
};

const METERS_PER_DEG_LAT = 110540;
const metersPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

async function defaultOpenImage(url) {
    const { fromUrl } = await import('geotiff');
    const tiff = await fromUrl(url, { cacheSize: 400 });
    return tiff.getImage();
}

/**
 * Cria um leitor com cache de imagens abertas (um handle por ladrilho).
 * `openImage(url)` injetavel para testes.
 */
function createRasterReader({ openImage = defaultOpenImage } = {}) {
    const images = new Map();
    function imageFor(url) {
        if (!images.has(url)) {
            images.set(url, openImage(url).catch((error) => {
                images.delete(url);
                throw error;
            }));
        }
        return images.get(url);
    }

    /**
     * Janela em volta de (lat, lon) com `radiusM` + 2 pixels de folga.
     * @returns {{ values, width, height, pixelW, pixelH, cx, cy, nodata, url }}
     */
    async function readWindow(sourceKey, lat, lon, radiusM) {
        const source = SOURCES[sourceKey];
        const url = source.tileUrl(lat, lon);
        const image = await imageFor(url);
        const [x0, , , y1] = image.getBoundingBox();
        const [rx, ry] = image.getResolution(); // ry negativo (norte para cima)
        const pixelW = Math.abs(rx) * metersPerDegLon(lat);
        const pixelH = Math.abs(ry) * METERS_PER_DEG_LAT;
        const fx = (lon - x0) / rx;
        const fy = (lat - y1) / ry;
        const halfX = Math.ceil(radiusM / pixelW) + 2;
        const halfY = Math.ceil(radiusM / pixelH) + 2;
        const left = Math.max(0, Math.floor(fx) - halfX);
        const top = Math.max(0, Math.floor(fy) - halfY);
        const right = Math.min(image.getWidth(), Math.floor(fx) + halfX + 1);
        const bottom = Math.min(image.getHeight(), Math.floor(fy) + halfY + 1);
        const rasters = await image.readRasters({ window: [left, top, right, bottom] });
        const nodataRaw = typeof image.getGDALNoData === 'function' ? image.getGDALNoData() : null;
        return {
            values: rasters[0],
            width: right - left,
            height: bottom - top,
            pixelW,
            pixelH,
            cx: fx - left - 0.5,
            cy: fy - top - 0.5,
            nodata: nodataRaw === null || nodataRaw === undefined ? null : Number(nodataRaw),
            url,
        };
    }

    return { readWindow };
}

function describeSources() {
    return Object.fromEntries(Object.entries(SOURCES).map(([key, s]) => [key, { nome: s.nome, versao: s.versao, licenca: s.licenca }]));
}

module.exports = {
    SOURCES,
    createRasterReader,
    describeSources,
};

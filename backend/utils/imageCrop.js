const sharp = require('sharp');

// Remove uma faixa inferior ("rodape") da imagem. Usado para apagar a ultima
// linha de uma marca d'agua queimada nos pixels (ex.: numero de torre errado).
//
// A faixa eh definida por `pixels` (altura absoluta em px) OU `percent`
// (fracao da altura, 0..1). `pixels` tem precedencia quando ambos vierem.
//
// IMPORTANTE — orientacao EXIF: a marca d'agua esta queimada na orientacao de
// EXIBICAO. Aplicamos `.rotate()` antes de medir/cortar para que o sharp
// auto-oriente pela tag EXIF (e a remova); sem isso, `extract` cortaria a borda
// errada em fotos com flag de orientacao != 1.
async function cropBottomBand(buffer, { pixels, percent } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
        throw new Error('Buffer de imagem invalido para corte.');
    }

    // .rotate() sem argumento = auto-orient pelo EXIF. Materializamos os pixels
    // na orientacao de exibicao ANTES de medir: em pipeline de auto-orient,
    // metadata() devolve as dimensoes PRE-rotacao, o que faria o extract receber
    // coordenadas trocadas em fotos retrato (orientation 6/8). Rotacionar para um
    // buffer primeiro garante width/height ja na orientacao final (tag zerada).
    const orientedBuffer = await sharp(buffer).rotate().toBuffer();
    const oriented = sharp(orientedBuffer);
    const metadata = await oriented.metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Nao foi possivel ler as dimensoes da imagem.');
    }

    const hasPixels = Number.isFinite(pixels) && pixels > 0;
    const hasPercent = Number.isFinite(percent) && percent > 0;
    if (!hasPixels && !hasPercent) {
        throw new Error('Informe pixels (>0) ou percent (>0) para o corte.');
    }

    const band = hasPixels ? Math.round(pixels) : Math.round(height * percent);

    // band <= 0: nada a cortar, devolve o buffer original intacto.
    if (band <= 0) {
        return buffer;
    }
    if (band >= height) {
        throw new Error(`Faixa de corte (${band}px) >= altura da imagem (${height}px).`);
    }

    // .withMetadata() faz o sharp emitir um marcador APP (Exif/JFIF) no JPEG. Sem
    // ele, o sharp remove toda a metadata e o libvips gera um JPEG que comeca em
    // FFD8FFDB (SOI+DQT, sem APP). O python-docx (worker, docx_renderer.py) so
    // reconhece JPEG JFIF (FFD8FFE0) ou Exif (FFD8FFE1) — qualquer outro vira
    // UnrecognizedImageError e a foto e descartada do DOCX. Manter este passo.
    return oriented
        .extract({ left: 0, top: 0, width, height: height - band })
        .jpeg({ quality: 92 })
        .withMetadata()
        .toBuffer();
}

module.exports = { cropBottomBand };

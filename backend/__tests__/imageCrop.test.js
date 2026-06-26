const sharp = require('sharp');
const { cropBottomBand } = require('../utils/imageCrop');

const WIDTH = 100;
const TOP_HEIGHT = 100; // faixa superior vermelha (o "conteudo")
const BAND_HEIGHT = 20; // faixa inferior azul (a "marca d'agua")
const FULL_HEIGHT = TOP_HEIGHT + BAND_HEIGHT;

// Gera um JPEG sintetico: topo vermelho (conteudo) + rodape azul (marca d'agua).
async function buildSyntheticJpeg() {
    const channels = 3;
    const raw = Buffer.alloc(WIDTH * FULL_HEIGHT * channels);
    for (let y = 0; y < FULL_HEIGHT; y += 1) {
        const isBand = y >= TOP_HEIGHT;
        for (let x = 0; x < WIDTH; x += 1) {
            const idx = (y * WIDTH + x) * channels;
            raw[idx] = isBand ? 0 : 255; // R
            raw[idx + 1] = 0; // G
            raw[idx + 2] = isBand ? 255 : 0; // B
        }
    }
    return sharp(raw, { raw: { width: WIDTH, height: FULL_HEIGHT, channels } })
        .jpeg({ quality: 100 })
        .toBuffer();
}

async function readPixel(jpegBuffer, x, y) {
    const { data, info } = await sharp(jpegBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
    const idx = (y * info.width + x) * info.channels;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

describe('cropBottomBand', () => {
    it('remove a faixa inferior por pixels e reduz a altura', async () => {
        const input = await buildSyntheticJpeg();
        const output = await cropBottomBand(input, { pixels: BAND_HEIGHT });

        const meta = await sharp(output).metadata();
        expect(meta.width).toBe(WIDTH);
        expect(meta.height).toBe(TOP_HEIGHT);

        // A nova ultima linha deve ser o conteudo vermelho, nao o azul da marca d'agua.
        const bottom = await readPixel(output, WIDTH / 2, TOP_HEIGHT - 1);
        expect(bottom.r).toBeGreaterThan(180);
        expect(bottom.b).toBeLessThan(80);
    });

    it('remove a faixa inferior por percent', async () => {
        const input = await buildSyntheticJpeg();
        const percent = BAND_HEIGHT / FULL_HEIGHT; // exatamente a faixa azul
        const output = await cropBottomBand(input, { percent });

        const meta = await sharp(output).metadata();
        expect(meta.height).toBe(FULL_HEIGHT - Math.round(FULL_HEIGHT * percent));
    });

    it('lanca quando a faixa >= altura da imagem', async () => {
        const input = await buildSyntheticJpeg();
        await expect(cropBottomBand(input, { pixels: FULL_HEIGHT })).rejects.toThrow(/Faixa de corte/);
    });

    it('devolve o buffer original quando a faixa arredonda para 0', async () => {
        const input = await buildSyntheticJpeg();
        // percent minusculo => band = round(120 * 0.001) = 0 => no-op
        const output = await cropBottomBand(input, { percent: 0.001 });
        expect(output).toBe(input);
    });

    it('lanca sem pixels nem percent', async () => {
        const input = await buildSyntheticJpeg();
        await expect(cropBottomBand(input, {})).rejects.toThrow(/pixels.*percent|percent/);
    });

    it('respeita orientacao EXIF (retrato via orientation=6) sem bad extract area', async () => {
        // Imagem landscape no buffer (120x100) com tag EXIF orientation=6 =>
        // exibida como retrato 100x120 apos auto-orient. cropBottomBand deve medir
        // pos-rotacao e cortar a faixa inferior sem estourar "bad extract area".
        const channels = 3;
        const w = 120;
        const h = 100;
        const raw = Buffer.alloc(w * h * channels, 128);
        const input = await sharp(raw, { raw: { width: w, height: h, channels } })
            .withMetadata({ orientation: 6 })
            .jpeg()
            .toBuffer();

        const output = await cropBottomBand(input, { pixels: 20 });
        const meta = await sharp(output).metadata();
        // pos auto-orient: 100x120; menos 20px => 100x100
        expect(meta.width).toBe(100);
        expect(meta.height).toBe(100);
    });

    it('emite JPEG com marcador Exif/JFIF reconhecivel pelo python-docx', async () => {
        // Regressao: sem .withMetadata() o sharp gera FFD8FFDB (sem APP), e o
        // python-docx (worker/docx_renderer.py add_picture) lanca
        // UnrecognizedImageError, descartando a foto do DOCX. python-docx so
        // aceita JFIF (FFD8FFE0+"JFIF") ou Exif (FFD8FFE1+"Exif").
        const input = await buildSyntheticJpeg();
        const output = await cropBottomBand(input, { pixels: BAND_HEIGHT });

        const soi = output.subarray(0, 4).toString('hex');
        expect(['ffd8ffe0', 'ffd8ffe1']).toContain(soi);
        const head = output.subarray(0, 64).toString('latin1');
        expect(head.includes('JFIF') || head.includes('Exif')).toBe(true);
    });

    it('lanca com buffer invalido', async () => {
        await expect(cropBottomBand(Buffer.alloc(0), { pixels: 10 })).rejects.toThrow(/Buffer de imagem invalido/);
        await expect(cropBottomBand(null, { pixels: 10 })).rejects.toThrow(/Buffer de imagem invalido/);
    });
});

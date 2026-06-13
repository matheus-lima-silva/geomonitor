import path from 'node:path';
import { fileURLToPath } from 'node:url';
import preset from '../../tailwind.preset.js';

// O Tailwind resolve os globs de `content` relativo ao CWD do processo, nao ao
// arquivo de config. Como `build:relat`/`dev:relat` rodam da raiz do monorepo
// (`vite ... --config apps/relat/vite.config.js`), globs relativos como
// `./src/**` apontariam para o `src` do geo e `apps/relat/src` nunca seria
// escaneado — purgando do CSS toda classe usada so no relat (grid-cols-7,
// valores arbitrarios etc.). Ancorar no diretorio do config resolve isso.
const dir = path.dirname(fileURLToPath(import.meta.url));
// fast-glob (usado pelo Tailwind) trata `\` como escape, entao normalizamos
// para `/` — caminhos absolutos com `/` funcionam tanto no Windows quanto no Linux.
const glob = (p) => path.join(dir, p).replace(/\\/g, '/');

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    glob('index.html'),
    glob('src/**/*.{js,jsx}'),
    // UI compartilhada de geomonitor consumida via alias '@app' — precisa
    // entrar no scan ou as classes dos primitivos somem do CSS do relat.
    glob('../../src/components/**/*.{js,jsx}'),
    glob('../../src/context/**/*.{js,jsx}'),
  ],
  plugins: [],
}

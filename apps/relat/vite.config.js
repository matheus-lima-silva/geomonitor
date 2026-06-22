import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoSrc = path.resolve(dirname, '../../src');

// Segundo app do monorepo: o "Portal de Relatorios" (relat.lima.rio.br).
// Reaproveita a UI compartilhada de src/ via alias '@app' sem copiar arquivos.
export default defineConfig({
  root: dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@app': repoSrc,
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(dirname, 'tailwind.config.js') }),
        autoprefixer,
      ],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    name: 'relat',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
});

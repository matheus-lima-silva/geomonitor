import { defineWorkspace } from 'vitest/config';

// Dois apps no mesmo repo: geo (raiz) e relat (apps/relat).
// O gate test:ci:strict roda os dois projetos.
export default defineWorkspace([
  './vite.config.js',
  './apps/relat/vite.config.js',
]);

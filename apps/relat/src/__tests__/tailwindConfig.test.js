import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config.js';

// Regressao do bug de UI do relat: o Tailwind resolve os globs de `content`
// relativo ao CWD do processo. Como `build:relat`/`dev:relat` rodam da raiz do
// monorepo, globs relativos apontariam para o `src` do geo e `apps/relat/src`
// nunca seria escaneado — purgando do CSS toda classe usada so no relat
// (grid-cols-7, valores arbitrarios etc.). Os globs precisam ser absolutos e
// cobrir apps/relat/src.
describe('apps/relat tailwind content globs', () => {
  it('content e uma lista de strings', () => {
    expect(Array.isArray(config.content)).toBe(true);
    expect(config.content.length).toBeGreaterThan(0);
    for (const glob of config.content) {
      expect(typeof glob).toBe('string');
    }
  });

  it('todos os globs sao caminhos absolutos (independentes do CWD)', () => {
    for (const glob of config.content) {
      expect(path.isAbsolute(glob)).toBe(true);
    }
  });

  it('escaneia apps/relat/src (senao classes so-do-relat sao purgadas)', () => {
    const covered = config.content.some((glob) =>
      glob.replace(/\\/g, '/').includes('/apps/relat/src/'),
    );
    expect(covered).toBe(true);
  });
});

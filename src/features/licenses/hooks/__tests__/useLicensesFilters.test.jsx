import { describe, expect, it } from 'vitest';
import { act as reactAct } from 'react';
import { createRoot } from 'react-dom/client';
import useLicensesFilters from '../useLicensesFilters';

// Padrao do projeto: act + createRoot (sem @testing-library). Instanciamos o
// hook dentro de um componente wrapper minimo e exercitamos via `bag.current`.

function exerciseHook(render) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const bag = {};
  function HookHost() {
    bag.current = useLicensesFilters();
    return null;
  }
  reactAct(() => root.render(<HookHost />));
  render(bag);
  reactAct(() => root.unmount());
  container.remove();
}

const LICENSES = [
  { id: 'LO-A', numero: '1/23', orgaoAmbiental: 'IBAMA', esfera: 'Federal', fimVigencia: '2030-01-01', exigeAcompanhamentoErosivo: true, cobertura: [{ projetoId: 'P1' }] },
  { id: 'LO-B', numero: '2/23', orgaoAmbiental: 'CETESB', esfera: 'Estadual', uf: 'SP', fimVigencia: '2026-01-01', exigeAcompanhamentoErosivo: false, cobertura: [] },
  { id: 'LO-C', numero: '3/23', orgaoAmbiental: 'INEA', esfera: 'Estadual', uf: 'RJ', fimVigencia: '', exigeAcompanhamentoErosivo: true, cobertura: [] },
];

describe('useLicensesFilters.apply', () => {
  it('sem filtros devolve todas', () => {
    exerciseHook((bag) => {
      expect(bag.current.apply(LICENSES, new Map()).map((l) => l.id)).toEqual(['LO-A', 'LO-B', 'LO-C']);
    });
  });

  it('busca textual case-insensitive e sem acento', () => {
    exerciseHook((bag) => {
      reactAct(() => bag.current.setFilter('searchTerm', 'cetesb'));
      const out = bag.current.apply(LICENSES, new Map()).map((l) => l.id);
      expect(out).toEqual(['LO-B']);
    });
  });

  it('multi-select de orgaos', () => {
    exerciseHook((bag) => {
      reactAct(() => bag.current.setFilter('orgaos', ['IBAMA', 'INEA']));
      const out = bag.current.apply(LICENSES, new Map()).map((l) => l.id);
      expect(out.sort()).toEqual(['LO-A', 'LO-C']);
    });
  });

  it('filtra por esfera', () => {
    exerciseHook((bag) => {
      reactAct(() => bag.current.setFilter('esfera', 'Estadual'));
      const out = bag.current.apply(LICENSES, new Map()).map((l) => l.id);
      expect(out.sort()).toEqual(['LO-B', 'LO-C']);
    });
  });

  it('vencimentoAntes exclui indeterminadas e futuras', () => {
    exerciseHook((bag) => {
      reactAct(() => bag.current.setFilter('vencimentoAntes', '2027-01-01'));
      const out = bag.current.apply(LICENSES, new Map()).map((l) => l.id);
      expect(out).toEqual(['LO-B']);
    });
  });

  it('soComErosiva filtra por flag', () => {
    exerciseHook((bag) => {
      reactAct(() => bag.current.setFilter('soComErosiva', true));
      const out = bag.current.apply(LICENSES, new Map()).map((l) => l.id);
      expect(out.sort()).toEqual(['LO-A', 'LO-C']);
    });
  });

  it('reset volta ao estado inicial', () => {
    exerciseHook((bag) => {
      reactAct(() => bag.current.setFilter('esfera', 'Federal'));
      reactAct(() => bag.current.reset());
      expect(bag.current.isEmpty).toBe(true);
    });
  });
});

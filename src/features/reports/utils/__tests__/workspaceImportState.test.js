import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearImportState,
  fingerprintFile,
  readImportState,
  writeImportState,
} from '../workspaceImportState';

function fakeFile({ name = 'foto.jpg', path = '', size = 0 } = {}) {
  return {
    name,
    webkitRelativePath: path,
    size,
  };
}

describe('workspaceImportState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('fingerprintFile', () => {
    it('combina webkitRelativePath e size quando disponiveis', () => {
      const fp = fingerprintFile(fakeFile({ name: 'IMG_0001.jpg', path: 'torre-01/IMG_0001.jpg', size: 1234 }));
      expect(fp).toBe('torre-01/IMG_0001.jpg::1234');
    });

    it('cai no name quando nao ha webkitRelativePath', () => {
      const fp = fingerprintFile(fakeFile({ name: 'foto.jpg', path: '', size: 555 }));
      expect(fp).toBe('foto.jpg::555');
    });

    it('eh estavel entre selecoes sucessivas do mesmo arquivo', () => {
      const fileA = fakeFile({ name: 'a.jpg', path: 'torre-01/a.jpg', size: 100 });
      const fileB = fakeFile({ name: 'a.jpg', path: 'torre-01/a.jpg', size: 100 });
      expect(fingerprintFile(fileA)).toBe(fingerprintFile(fileB));
    });

    it('diferencia arquivos com mesmo nome e tamanhos distintos', () => {
      expect(fingerprintFile(fakeFile({ name: 'foto.jpg', size: 100 })))
        .not.toBe(fingerprintFile(fakeFile({ name: 'foto.jpg', size: 101 })));
    });

    it('retorna string vazia para entrada invalida', () => {
      expect(fingerprintFile(null)).toBe('');
      expect(fingerprintFile(undefined)).toBe('');
    });
  });

  describe('read/write/clearImportState', () => {
    it('readImportState retorna null quando nao ha registro', () => {
      expect(readImportState('RW-99')).toBeNull();
    });

    it('writeImportState persiste e readImportState devolve os fingerprints', () => {
      writeImportState('RW-1', {
        completedFingerprints: ['a::1', 'b::2'],
        failedFingerprints: ['c::3'],
      });
      const state = readImportState('RW-1');
      expect(state).not.toBeNull();
      expect(state.completedFingerprints).toEqual(['a::1', 'b::2']);
      expect(state.failedFingerprints).toEqual(['c::3']);
      expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('isola por workspaceId', () => {
      writeImportState('RW-1', { completedFingerprints: ['x::1'], failedFingerprints: [] });
      writeImportState('RW-2', { completedFingerprints: ['y::1'], failedFingerprints: [] });
      expect(readImportState('RW-1').completedFingerprints).toEqual(['x::1']);
      expect(readImportState('RW-2').completedFingerprints).toEqual(['y::1']);
    });

    it('clearImportState remove o registro', () => {
      writeImportState('RW-1', { completedFingerprints: ['a::1'], failedFingerprints: [] });
      expect(readImportState('RW-1')).not.toBeNull();
      clearImportState('RW-1');
      expect(readImportState('RW-1')).toBeNull();
    });

    it('readImportState tolera JSON corrompido devolvendo null', () => {
      window.localStorage.setItem('report_workspace_import:RW-1', 'nao-e-json');
      expect(readImportState('RW-1')).toBeNull();
    });

    it('writeImportState ignora workspaceId vazio sem lancar', () => {
      expect(() => writeImportState('', { completedFingerprints: [], failedFingerprints: [] })).not.toThrow();
      expect(window.localStorage.length).toBe(0);
    });
  });

  describe('fluxo tipico de dedupe', () => {
    it('permite filtrar fotos ja enviadas em uma segunda tentativa', () => {
      const files = [
        fakeFile({ name: 'a.jpg', path: 'torre-01/a.jpg', size: 100 }),
        fakeFile({ name: 'b.jpg', path: 'torre-01/b.jpg', size: 200 }),
        fakeFile({ name: 'c.jpg', path: 'torre-02/c.jpg', size: 300 }),
      ];

      // Simula um primeiro run onde 'a' foi enviada com sucesso e 'b' falhou
      writeImportState('RW-1', {
        completedFingerprints: [fingerprintFile(files[0])],
        failedFingerprints: [fingerprintFile(files[1])],
      });

      // Segundo clique: re-seleciona a mesma pasta
      const state = readImportState('RW-1');
      const completedSet = new Set(state.completedFingerprints);
      const toProcess = files.filter((f) => !completedSet.has(fingerprintFile(f)));

      expect(toProcess).toHaveLength(2); // pula 'a', processa 'b' e 'c'
      expect(toProcess.map((f) => f.name)).toEqual(['b.jpg', 'c.jpg']);
    });

    it('apos sucesso total, clearImportState deixa o localStorage limpo do workspace', () => {
      writeImportState('RW-1', {
        completedFingerprints: ['a::1', 'b::2', 'c::3'],
        failedFingerprints: [],
      });
      // Apos o ultimo run dar tudo certo:
      clearImportState('RW-1');
      expect(readImportState('RW-1')).toBeNull();
    });
  });
});

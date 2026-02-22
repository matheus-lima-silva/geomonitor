import { createEmptyProject, normalizeProjectPayload } from '../projectModel';

describe('projectModel', () => {
  it('createEmptyProject define defaults esperados', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-10T10:00:00Z'));

    const empty = createEmptyProject();

    expect(empty.id).toBe('');
    expect(empty.nome).toBe('');
    expect(empty.tipo).toBe('Linha de Transmissão');
    expect(empty.periodicidadeRelatorio).toBe('Anual');
    expect(empty.mesesEntregaRelatorio).toEqual([]);
    expect(empty.torresCoordenadas).toEqual([]);
    expect(empty.dataCadastro).toBe('2025-02-10');

    vi.useRealTimers();
  });

  it('normalizeProjectPayload aplica trim, uppercase e defaults', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T01:00:00Z'));

    const normalized = normalizeProjectPayload({
      id: ' lt-001 ',
      nome: ' Linha Norte ',
      tipo: 'Subestação',
      tensao: 230,
      torres: 12,
      torresCoordenadas: 'invalido',
    });

    expect(normalized.id).toBe('LT-001');
    expect(normalized.nome).toBe('Linha Norte');
    expect(normalized.tipo).toBe('Subestação');
    expect(normalized.tensao).toBe('230');
    expect(normalized.torres).toBe('12');
    expect(normalized.torresCoordenadas).toEqual([]);
    expect(normalized.dataCadastro).toBe('2025-03-01');

    vi.useRealTimers();
  });

  it('mantém dataCadastro informado', () => {
    const normalized = normalizeProjectPayload({
      id: 'A',
      nome: 'Projeto A',
      dataCadastro: '2024-12-05',
      torresCoordenadas: [{ torre: 1 }],
    });

    expect(normalized.dataCadastro).toBe('2024-12-05');
    expect(normalized.torresCoordenadas).toEqual([{ torre: 1 }]);
  });
});

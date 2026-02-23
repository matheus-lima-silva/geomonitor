import { describe, expect, it } from 'vitest';
import { exportProjectToKml } from '../projectKmlExport';

describe('projectKmlExport', () => {
  it('exports linestring and towers when both exist', () => {
    const kml = exportProjectToKml({
      id: 'SIMRLE',
      nome: 'Simplicio - Rocha Leao',
      linhaFonteKml: 'Simplicio - Rocha Leao C1',
      linhaCoordenadas: [
        { latitude: '-21.92260055', longitude: '-42.79536041', altitude: '0' },
        { latitude: '-22.42427437', longitude: '-42.0098069', altitude: '0' },
      ],
      torresCoordenadas: [
        { numero: '1', latitude: '-21.92254088', longitude: '-42.79477448' },
        { numero: '2', latitude: '-21.923', longitude: '-42.793' },
      ],
    });

    expect(kml).toContain('<LineString>');
    expect(kml).toContain('<name>Simplicio - Rocha Leao C1</name>');
    expect(kml).toContain('<name>Torre 1</name>');
    expect(kml).toContain('<name>Torre 2</name>');
  });

  it('exports only towers when line has less than 2 points', () => {
    const kml = exportProjectToKml({
      id: 'P1',
      nome: 'Projeto 1',
      linhaCoordenadas: [{ latitude: '-21', longitude: '-42', altitude: '0' }],
      torresCoordenadas: [{ numero: '10', latitude: '-21.1', longitude: '-42.1' }],
    });

    expect(kml).not.toContain('<LineString>');
    expect(kml).toContain('<name>Torre 10</name>');
  });

  it('throws when project has no valid geometry to export', () => {
    expect(() => exportProjectToKml({
      id: 'EMPTY',
      torresCoordenadas: [],
      linhaCoordenadas: [],
    })).toThrow('nao possui geometria suficiente');
  });
});

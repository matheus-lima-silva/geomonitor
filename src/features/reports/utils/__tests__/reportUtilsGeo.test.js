import { describe, expect, it } from 'vitest';
import {
  bearingToCompassPt,
  findTowerCoordinate,
  formatImportSourceLabel,
  formatPhotoDistanceLabel,
  getPhotoCoordinate,
  haversineMeters,
} from '../reportUtils';

describe('findTowerCoordinate', () => {
  const project = {
    torresCoordenadas: [
      { numero: '605', latitude: -23.870, longitude: -46.530 },
      { numero: '606', latitude: -23.879, longitude: -46.531 },
    ],
  };

  it('casa a torre por numero e devolve [lat, lng]', () => {
    expect(findTowerCoordinate(project, '606')).toEqual([-23.879, -46.531]);
  });

  it('retorna null para torre inexistente ou ref vazia', () => {
    expect(findTowerCoordinate(project, '999')).toBeNull();
    expect(findTowerCoordinate(project, '')).toBeNull();
    expect(findTowerCoordinate(null, '606')).toBeNull();
  });

  it('ignora torre sem coordenada valida', () => {
    const bad = { torresCoordenadas: [{ numero: '1', latitude: 'x', longitude: null }] };
    expect(findTowerCoordinate(bad, '1')).toBeNull();
  });
});

describe('getPhotoCoordinate', () => {
  it('le gps_lat/gps_lon da foto', () => {
    expect(getPhotoCoordinate({ gpsLat: -23.87, gpsLon: -46.53 })).toEqual([-23.87, -46.53]);
  });

  it('retorna null sem coordenadas', () => {
    expect(getPhotoCoordinate({ gpsLat: null, gpsLon: -46.53 })).toBeNull();
    expect(getPhotoCoordinate({})).toBeNull();
  });
});

describe('haversineMeters', () => {
  it('aproxima 1 grau de longitude no equador (~111 km)', () => {
    const d = haversineMeters([0, 0], [0, 1]);
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  it('retorna null para entrada invalida', () => {
    expect(haversineMeters(null, [0, 0])).toBeNull();
    expect(haversineMeters([0, 0], [NaN, 0])).toBeNull();
  });
});

describe('bearingToCompassPt', () => {
  it('mapeia direcoes cardeais (pt-BR: L=Leste, O=Oeste)', () => {
    expect(bearingToCompassPt([0, 0], [0, 1])).toBe('L');
    expect(bearingToCompassPt([0, 0], [0, -1])).toBe('O');
    expect(bearingToCompassPt([0, 0], [1, 0])).toBe('N');
    expect(bearingToCompassPt([0, 0], [-1, 0])).toBe('S');
  });

  it('retorna string vazia sem coordenadas', () => {
    expect(bearingToCompassPt(null, [0, 0])).toBe('');
  });
});

describe('formatPhotoDistanceLabel', () => {
  it('usa distanceMeters do backend e a direcao da foto vista da torre', () => {
    // foto a oeste da torre
    expect(formatPhotoDistanceLabel(35, [0, 0], [0, -0.0003])).toBe('≈ 35 m · O da torre');
  });

  it('formata quilometros para distancias grandes', () => {
    expect(formatPhotoDistanceLabel(1500, null, null)).toBe('≈ 1.5 km');
  });

  it('calcula por haversine quando distanceMeters nao vem', () => {
    const label = formatPhotoDistanceLabel(null, [0, 0], [0, 0.0003]);
    expect(label).toContain('da torre');
    expect(label).toContain('L'); // leste
  });

  it('retorna string vazia sem distancia computavel', () => {
    expect(formatPhotoDistanceLabel(null, null, null)).toBe('');
  });
});

describe('formatImportSourceLabel', () => {
  it('traduz as origens conhecidas', () => {
    expect(formatImportSourceLabel('loose_photos')).toBe('Fotos Soltas');
    expect(formatImportSourceLabel('organized_kmz')).toBe('KMZ Organizado');
  });

  it('cai para a propria chave ou "-"', () => {
    expect(formatImportSourceLabel('desconhecido')).toBe('desconhecido');
    expect(formatImportSourceLabel('')).toBe('-');
  });
});

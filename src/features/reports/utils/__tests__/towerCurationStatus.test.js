import { describe, expect, it } from 'vitest';
import { computeTowerCurationStatus, getWorkspacePhotoStatus } from '../reportUtils';

function makePhoto(id, towerId, caption, includeInReport) {
  return { id, towerId, caption, includeInReport, curationStatus: 'uploaded' };
}

describe('computeTowerCurationStatus', () => {
  it('retorna objeto vazio para lista vazia', () => {
    expect(computeTowerCurationStatus([], {})).toEqual({});
  });

  it('marca torre como completa quando todas as fotos sao curated', () => {
    const photos = [
      makePhoto('p1', '1', 'Legenda A', true),
      makePhoto('p2', '1', 'Legenda B', true),
    ];
    const result = computeTowerCurationStatus(photos, {});
    expect(result['1']).toBe(true);
  });

  it('marca torre como incompleta quando alguma foto nao e curated', () => {
    const photos = [
      makePhoto('p1', '1', 'Legenda A', true),
      makePhoto('p2', '1', '', false), // sem caption nem includeInReport
    ];
    const result = computeTowerCurationStatus(photos, {});
    expect(result['1']).toBe(false);
  });

  it('usa dados do draft quando disponivel', () => {
    const photos = [
      makePhoto('p1', '1', '', false),
      makePhoto('p2', '1', '', false),
    ];
    const drafts = {
      p1: { towerId: '1', caption: 'Editada', includeInReport: true },
      p2: { towerId: '1', caption: 'Editada 2', includeInReport: true },
    };
    const result = computeTowerCurationStatus(photos, drafts);
    expect(result['1']).toBe(true);
  });

  it('agrupa fotos corretamente por torre', () => {
    const photos = [
      makePhoto('p1', '1', 'Legenda', true),
      makePhoto('p2', '2', 'Legenda', true),
      makePhoto('p3', '2', '', false),
    ];
    const result = computeTowerCurationStatus(photos, {});
    expect(result['1']).toBe(true);
    expect(result['2']).toBe(false);
  });

  it('fotos sem torre vao para __none__ e nao sao curated', () => {
    const photos = [
      makePhoto('p1', '', 'Legenda', true),
    ];
    const result = computeTowerCurationStatus(photos, {});
    // sem towerId -> nao pode ser curated
    expect(result['__none__']).toBe(false);
  });

  it('draft pode mover foto para outra torre', () => {
    const photos = [
      makePhoto('p1', '1', 'Legenda A', true),
      makePhoto('p2', '1', 'Legenda B', true),
    ];
    // draft move p2 para torre 2
    const drafts = {
      p2: { towerId: '2', caption: 'Legenda B', includeInReport: true },
    };
    const result = computeTowerCurationStatus(photos, drafts);
    expect(result['1']).toBe(true);  // p1 sozinha, curated
    expect(result['2']).toBe(true);  // p2 sozinha, curated
  });

  it('torre incompleta se falta includeInReport', () => {
    const photos = [
      makePhoto('p1', '1', 'Legenda', false), // tem caption e tower mas nao includeInReport
    ];
    const result = computeTowerCurationStatus(photos, {});
    expect(result['1']).toBe(false);
  });

  it('torre incompleta se falta caption', () => {
    const photos = [
      makePhoto('p1', '1', '', true), // tem tower e includeInReport mas nao caption
    ];
    const result = computeTowerCurationStatus(photos, {});
    expect(result['1']).toBe(false);
  });
});

describe('getWorkspacePhotoStatus', () => {
  it('retorna curated quando tem caption, tower e includeInReport', () => {
    const photo = makePhoto('p1', '1', 'Legenda', true);
    expect(getWorkspacePhotoStatus(photo, photo)).toBe('curated');
  });

  it('retorna reviewed quando tem apenas caption', () => {
    const photo = makePhoto('p1', '', 'Legenda', false);
    expect(getWorkspacePhotoStatus(photo, photo)).toBe('reviewed');
  });

  it('retorna uploaded quando nao tem nada preenchido', () => {
    const photo = makePhoto('p1', '', '', false);
    expect(getWorkspacePhotoStatus(photo, photo)).toBe('uploaded');
  });
});

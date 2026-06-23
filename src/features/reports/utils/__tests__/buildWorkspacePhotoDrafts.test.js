import { describe, expect, it } from 'vitest';
import { buildWorkspacePhotoDrafts, isWorkspacePhotoDirty } from '../reportUtils';

describe('buildWorkspacePhotoDrafts', () => {
  it('usa os valores da foto quando nao ha rascunho persistido', () => {
    const photos = [{ id: 'p1', towerId: '641', caption: 'Foto A', includeInReport: true }];
    const drafts = buildWorkspacePhotoDrafts(photos, {});
    expect(drafts.p1).toEqual({ towerId: '641', caption: 'Foto A', includeInReport: true });
  });

  it('rascunho com torre vazia NAO mascara a torre persistida (round-trip do KMZ)', () => {
    // Cenario do bug: o round-trip atribuiu tower_id server-side, mas o draft
    // de autosave antigo guarda towerId '' (estado anterior, sem torre).
    const photos = [{ id: 'p1', towerId: '641', caption: 'TimePhoto 1', includeInReport: false }];
    const persisted = { p1: { towerId: '', caption: '', includeInReport: false } };
    const drafts = buildWorkspacePhotoDrafts(photos, persisted);
    expect(drafts.p1.towerId).toBe('641');
    expect(drafts.p1.caption).toBe('TimePhoto 1');
  });

  it('foto com torre persistida + rascunho vazio nao fica marcada como alterada', () => {
    const photo = { id: 'p1', towerId: '641', caption: 'TimePhoto 1', includeInReport: false };
    const persisted = { p1: { towerId: '', caption: '', includeInReport: false } };
    const drafts = buildWorkspacePhotoDrafts([photo], persisted);
    expect(isWorkspacePhotoDirty(photo, drafts.p1)).toBe(false);
  });

  it('rascunho com torre preenchida prevalece sobre a torre persistida (edicao real)', () => {
    const photos = [{ id: 'p1', towerId: '641', caption: 'Foto A', includeInReport: false }];
    const persisted = { p1: { towerId: '642', caption: 'Editada', includeInReport: true } };
    const drafts = buildWorkspacePhotoDrafts(photos, persisted);
    expect(drafts.p1).toEqual({ towerId: '642', caption: 'Editada', includeInReport: true });
    expect(isWorkspacePhotoDirty(photos[0], drafts.p1)).toBe(true);
  });
});

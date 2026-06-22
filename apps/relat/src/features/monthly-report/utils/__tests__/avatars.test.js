import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColor, initials } from '../avatars';

describe('avatars util', () => {
  it('initials usa as duas primeiras iniciais (ou ? quando vazio)', () => {
    expect(initials('Matheus Lima')).toBe('ML');
    expect(initials('  ana  ')).toBe('A');
    expect(initials('joão da silva')).toBe('JD');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });

  it('avatarColor cicla pelas cores e trata indice negativo', () => {
    expect(avatarColor(0)).toBe(AVATAR_COLORS[0]);
    expect(avatarColor(AVATAR_COLORS.length)).toBe(AVATAR_COLORS[0]);
    expect(avatarColor(AVATAR_COLORS.length + 1)).toBe(AVATAR_COLORS[1]);
    expect(avatarColor(-1)).toBe(AVATAR_COLORS[AVATAR_COLORS.length - 1]);
  });

  it('todas as cores sao tokens Tailwind (sem hex literal)', () => {
    for (const c of AVATAR_COLORS) expect(c).not.toMatch(/#/);
  });
});

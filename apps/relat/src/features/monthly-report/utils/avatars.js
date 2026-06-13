// Avatar de iniciais com cor rotativa, usado na Equipe (modal de Configuracoes)
// e no seletor de engenheiro. Cores via tokens Tailwind (sem hex literal).

export const AVATAR_COLORS = ['bg-brand-600', 'bg-success', 'bg-warning', 'bg-critical', 'bg-slate-600'];

export function avatarColor(index) {
  return AVATAR_COLORS[((index % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
}

export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

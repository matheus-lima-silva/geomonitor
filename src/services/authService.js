import { API_BASE_URL } from '../utils/serviceFactory';
import { storeTokens, clearTokens } from '../utils/tokenStorage';

function mapRoleFromPerfil(perfil) {
  if (perfil === 'Administrador') return 'admin';
  if (perfil === 'Gerente') return 'manager';
  return 'viewer';
}

function toProfile(profile) {
  return {
    uid: profile?.id || profile?.uid || '',
    email: profile?.email || '',
    nome: profile?.nome || '',
    cargo: profile?.cargo || '',
    departamento: profile?.departamento || '',
    telefone: profile?.telefone || '',
    perfil: profile?.perfil || 'Utilizador',
    status: profile?.status || 'Pendente',
    perfilAtualizadoPrimeiroLogin: profile?.perfilAtualizadoPrimeiroLogin === true,
    role: mapRoleFromPerfil(profile?.perfil),
    profissao_id: profile?.profissao_id || '',
    registro_conselho: profile?.registro_conselho || '',
    registro_estado: profile?.registro_estado || '',
    registro_numero: profile?.registro_numero || '',
    registro_sufixo: profile?.registro_sufixo || '',
  };
}

async function parseApiError(res) {
  try {
    const body = await res.json();
    const error = new Error(body.message || 'Erro desconhecido.');
    error.code = body.code || '';
    return error;
  } catch {
    return new Error('Erro de comunicação com o servidor.');
  }
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw await parseApiError(res);

  const { data } = await res.json();
  storeTokens(data.accessToken, data.refreshToken);
  return toProfile(data.user);
}

export async function register(email, password, nome = '') {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, nome }),
  });

  if (!res.ok) throw await parseApiError(res);

  const { data } = await res.json();
  return toProfile(data.user);
}

export async function resetPassword(email) {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) throw await parseApiError(res);
}

export async function confirmResetPassword(token, newPassword) {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) throw await parseApiError(res);
}

export function logout() {
  clearTokens();
}

export async function loadProfile() {
  const { getAuthToken } = await import('../utils/serviceFactory');
  const token = await getAuthToken();

  const res = await fetch(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const { data } = await res.json();
  return toProfile(data);
}

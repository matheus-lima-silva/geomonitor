import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));

import { storeTokens, clearTokens } from '../../utils/tokenStorage';
import { login, register, resetPassword, logout, loadProfile } from '../authService';

describe('authService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('login', () => {
    it('chama POST /auth/login, armazena tokens e retorna perfil', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: {
            accessToken: 'acc-tok',
            refreshToken: 'ref-tok',
            user: {
              id: 'U-1',
              email: 'ana@empresa.com',
              nome: 'Ana',
              perfil: 'Gerente',
              status: 'Ativo',
            },
          },
        }),
      });

      const profile = await login('ana@empresa.com', 'senha123');

      expect(fetchMock.mock.calls[0][0]).toContain('/auth/login');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        email: 'ana@empresa.com',
        password: 'senha123',
      });
      expect(storeTokens).toHaveBeenCalledWith('acc-tok', 'ref-tok');
      expect(profile).toEqual(expect.objectContaining({
        uid: 'U-1',
        email: 'ana@empresa.com',
        nome: 'Ana',
        role: 'manager',
      }));
    });

    it('lança erro quando API retorna 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          status: 'error',
          code: 'INVALID_CREDENTIALS',
          message: 'Email ou senha incorretos.',
        }),
      });

      await expect(login('x@empresa.com', 'errada')).rejects.toThrow('Email ou senha incorretos.');
    });
  });

  describe('register', () => {
    it('chama POST /auth/register e retorna perfil', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: {
            user: {
              id: 'U-9',
              email: 'novo@empresa.com',
              nome: 'Novo',
              perfil: 'Utilizador',
              status: 'Pendente',
            },
          },
        }),
      });

      const profile = await register('novo@empresa.com', 'Senha1A', 'Novo');

      expect(fetchMock.mock.calls[0][0]).toContain('/auth/register');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        email: 'novo@empresa.com',
        password: 'Senha1A',
        nome: 'Novo',
      });
      expect(profile).toEqual(expect.objectContaining({
        uid: 'U-9',
        email: 'novo@empresa.com',
        nome: 'Novo',
        role: 'viewer',
        status: 'Pendente',
      }));
    });

    it('lança erro quando email já existe', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          status: 'error',
          code: 'EMAIL_IN_USE',
          message: 'Este email já está cadastrado.',
        }),
      });

      await expect(register('x@empresa.com', 'Senha1A', 'X')).rejects.toThrow('Este email já está cadastrado.');
    });
  });

  describe('resetPassword', () => {
    it('chama POST /auth/reset-password', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' }),
      });

      await resetPassword('reset@empresa.com');

      expect(fetchMock.mock.calls[0][0]).toContain('/auth/reset-password');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'reset@empresa.com' });
    });
  });

  describe('logout', () => {
    it('limpa os tokens', () => {
      logout();
      expect(clearTokens).toHaveBeenCalled();
    });
  });

  describe('loadProfile', () => {
    it('chama GET /users/me com token e retorna perfil', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: {
            id: 'U-1',
            email: 'ana@empresa.com',
            nome: 'Ana',
            perfil: 'Administrador',
            status: 'Ativo',
          },
        }),
      });

      const profile = await loadProfile();

      expect(fetchMock.mock.calls[0][0]).toContain('/users/me');
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123');
      expect(profile).toEqual(expect.objectContaining({
        uid: 'U-1',
        role: 'admin',
      }));
    });

    it('retorna null quando API retorna 404', async () => {
      fetchMock.mockResolvedValue({ ok: false, json: vi.fn() });

      const profile = await loadProfile();
      expect(profile).toBeNull();
    });
  });

  it.each([
    ['Administrador', 'admin'],
    ['Gerente', 'manager'],
    ['Utilizador', 'viewer'],
  ])('perfil %s mapeia para role %s', async (perfil, role) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        data: {
          accessToken: 'acc',
          refreshToken: 'ref',
          user: { id: 'U-1', email: 'a@b.com', nome: 'A', perfil, status: 'Ativo' },
        },
      }),
    });

    const profile = await login('a@b.com', 'Senha1A');
    expect(profile.role).toBe(role);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../userService', () => ({
  bootstrapCurrentUserProfile: vi.fn(),
  getCurrentUserProfile: vi.fn(),
}));

vi.mock('../../firebase/config', () => ({
  auth: { name: 'mock-auth' },
}));

import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../../firebase/config';
import { bootstrapCurrentUserProfile, getCurrentUserProfile } from '../userService';
import {
  loadProfile,
  login,
  logout,
  register,
  resetPassword,
} from '../authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['Administrador', 'admin'],
    ['Gerente', 'manager'],
    ['Utilizador', 'viewer'],
  ])('loadProfile mapeia perfil %s para role %s', async (perfil, role) => {
    vi.mocked(bootstrapCurrentUserProfile).mockResolvedValue({
      nome: 'Maria',
      perfil,
      status: 'Ativo',
      cargo: 'Engenheira',
      departamento: 'Campo',
      telefone: '9999',
      perfilAtualizadoPrimeiroLogin: true,
    });

    const profile = await loadProfile({
      uid: 'U-1',
      email: 'maria@empresa.com',
      displayName: 'Display Maria',
    });

    expect(bootstrapCurrentUserProfile).toHaveBeenCalledWith(
      { nome: 'Display Maria', email: 'maria@empresa.com' },
      { updatedBy: 'maria@empresa.com' },
    );
    expect(profile.role).toBe(role);
    expect(profile.nome).toBe('Maria');
  });

  it('login autentica e retorna perfil carregado da API', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: {
        uid: 'U-1',
        email: 'ana@empresa.com',
        displayName: 'Ana Display',
      },
    });
    vi.mocked(bootstrapCurrentUserProfile).mockResolvedValue({
      nome: 'Ana',
      perfil: 'Gerente',
      status: 'Ativo',
    });

    const profile = await login('ana@empresa.com', '123456');

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'ana@empresa.com', '123456');
    expect(profile).toEqual(
      expect.objectContaining({
        uid: 'U-1',
        email: 'ana@empresa.com',
        nome: 'Ana',
        role: 'manager',
      }),
    );
  });

  it('register cria utilizador, faz bootstrap do perfil via API e retorna perfil', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
      user: {
        uid: 'U-9',
        email: 'novo@empresa.com',
        displayName: '',
      },
    });
    vi.mocked(bootstrapCurrentUserProfile).mockResolvedValue({
      nome: 'Novo',
      perfil: 'Utilizador',
      status: 'Pendente',
      cargo: '',
      departamento: '',
      telefone: '',
      perfilAtualizadoPrimeiroLogin: false,
    });

    const profile = await register('novo@empresa.com', 'senha', 'Novo');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'novo@empresa.com', 'senha');
    expect(bootstrapCurrentUserProfile).toHaveBeenCalledWith(
      {
        nome: 'Novo',
        email: 'novo@empresa.com',
        cargo: '',
        departamento: '',
        telefone: '',
        perfilAtualizadoPrimeiroLogin: false,
      },
      { updatedBy: 'novo@empresa.com' },
    );
    expect(profile).toEqual(
      expect.objectContaining({
        uid: 'U-9',
        email: 'novo@empresa.com',
        nome: 'Novo',
        role: 'viewer',
      }),
    );
  });

  it('register desfaz utilizador quando bootstrap falha', async () => {
    const createdUser = {
      uid: 'U-ERR',
      email: 'falha@empresa.com',
      displayName: '',
    };
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user: createdUser });
    vi.mocked(bootstrapCurrentUserProfile).mockRejectedValue(new Error('Bootstrap falhou'));
    vi.mocked(deleteUser).mockResolvedValue(undefined);

    await expect(register('falha@empresa.com', 'senha', 'Falha')).rejects.toThrow(
      'Falha ao criar perfil. A conta foi desfeita. Tente novamente.',
    );
    expect(deleteUser).toHaveBeenCalledWith(createdUser);
  });

  it('resetPassword e logout delegam para firebase auth', async () => {
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
    vi.mocked(signOut).mockResolvedValue(undefined);

    await resetPassword('reset@empresa.com');
    await logout();

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'reset@empresa.com');
    expect(signOut).toHaveBeenCalledWith(auth);
  });
});

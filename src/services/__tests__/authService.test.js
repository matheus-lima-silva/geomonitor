import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('../../firebase/config', () => ({
  auth: { name: 'mock-auth' },
  db: { name: 'mock-db' },
}));

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
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
    vi.mocked(doc).mockReturnValue('PROFILE_REF');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        nome: 'Maria',
        perfil,
        status: 'Ativo',
        cargo: 'Engenheira',
        departamento: 'Campo',
        telefone: '9999',
        perfilAtualizadoPrimeiroLogin: true,
      }),
    });

    const profile = await loadProfile({
      uid: 'U-1',
      email: 'maria@empresa.com',
      displayName: 'Display Maria',
    });

    expect(doc).toHaveBeenCalledWith(db, 'shared', 'geomonitor', 'users', 'U-1');
    expect(profile.role).toBe(role);
    expect(profile.nome).toBe('Maria');
  });

  it('login autentica e retorna perfil carregado', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: {
        uid: 'U-1',
        email: 'ana@empresa.com',
        displayName: 'Ana Display',
      },
    });
    vi.mocked(doc).mockReturnValue('PROFILE_REF');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        nome: 'Ana',
        perfil: 'Gerente',
        status: 'Ativo',
      }),
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

  it('register cria usuário, grava documento padrão e retorna perfil', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-10T15:20:30.000Z'));
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
      user: {
        uid: 'U-9',
        email: 'novo@empresa.com',
        displayName: '',
      },
    });
    vi.mocked(doc).mockReturnValue('PROFILE_REF');
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        nome: 'Novo',
        perfil: 'Utilizador',
        status: 'Pendente',
      }),
    });

    const profile = await register('novo@empresa.com', 'senha', 'Novo');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'novo@empresa.com', 'senha');
    expect(setDoc).toHaveBeenCalledWith(
      'PROFILE_REF',
      {
        id: 'U-9',
        nome: 'Novo',
        email: 'novo@empresa.com',
        cargo: '',
        departamento: '',
        telefone: '',
        perfil: 'Utilizador',
        status: 'Pendente',
        perfilAtualizadoPrimeiroLogin: false,
        createdAt: '2025-09-10T15:20:30.000Z',
      },
      { merge: true },
    );
    expect(profile).toEqual(
      expect.objectContaining({
        uid: 'U-9',
        email: 'novo@empresa.com',
        nome: 'Novo',
        role: 'viewer',
      }),
    );

    vi.useRealTimers();
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

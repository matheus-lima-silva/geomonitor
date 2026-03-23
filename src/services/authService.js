import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { bootstrapCurrentUserProfile, getCurrentUserProfile } from './userService';

function mapRoleFromPerfil(perfil) {
  if (perfil === 'Administrador') return 'admin';
  if (perfil === 'Gerente') return 'manager';
  return 'viewer';
}

function toProfile(authUser, profile) {
  return {
    uid: authUser.uid,
    email: authUser.email,
    nome: profile?.nome || authUser.displayName || '',
    cargo: profile?.cargo || '',
    departamento: profile?.departamento || '',
    telefone: profile?.telefone || '',
    perfil: profile?.perfil || 'Utilizador',
    status: profile?.status || 'Pendente',
    perfilAtualizadoPrimeiroLogin: profile?.perfilAtualizadoPrimeiroLogin === true,
    role: mapRoleFromPerfil(profile?.perfil),
  };
}

export async function loadProfile(authUser) {
  const profile = await bootstrapCurrentUserProfile({
    nome: authUser.displayName || '',
    email: authUser.email || '',
  }, { updatedBy: authUser.email || 'app' });
  return toProfile(authUser, profile);
}

export async function login(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return loadProfile(result.user);
}

export async function register(email, password, nome = '') {
  const result = await createUserWithEmailAndPassword(auth, email, password);

  try {
    const profile = await bootstrapCurrentUserProfile({
      nome: nome || '',
      email,
      cargo: '',
      departamento: '',
      telefone: '',
      perfilAtualizadoPrimeiroLogin: false,
    }, {
      updatedBy: email,
    });

    return toProfile(result.user, profile);
  } catch (error) {
    if (result.user) {
      await deleteUser(result.user).catch(console.error);
    }
    throw new Error('Falha ao criar perfil. A conta foi desfeita. Tente novamente.');
  }
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return signOut(auth);
}

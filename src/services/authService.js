import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

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
  const profileRef = doc(db, 'shared', 'geomonitor', 'users', authUser.uid);
  const profileSnap = await getDoc(profileRef);
  return toProfile(authUser, profileSnap.exists() ? profileSnap.data() : null);
}

export async function login(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return loadProfile(result.user);
}

export async function register(email, password, nome = '') {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  
  try {
    await setDoc(
      doc(db, 'shared', 'geomonitor', 'users', result.user.uid),
      {
        id: result.user.uid,
        nome: nome || '',
        email,
        cargo: '',
        departamento: '',
        telefone: '',
        perfil: 'Utilizador',
        status: 'Pendente',
        perfilAtualizadoPrimeiroLogin: false,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return loadProfile(result.user);
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

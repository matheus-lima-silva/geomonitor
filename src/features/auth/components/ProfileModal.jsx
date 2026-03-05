import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { saveUser } from '../../../services/userService';

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function ProfileModal({ onClose }) {
  const { user, refreshProfile } = useAuth();
  const { show } = useToast();
  const [formData, setFormData] = useState({
    id: user?.uid || '',
    nome: user?.nome || '',
    email: user?.email || '',
    cargo: user?.cargo || '',
    departamento: user?.departamento || '',
    telefone: formatPhone(user?.telefone || ''),
    perfil: user?.perfil || 'Utilizador',
  });

  async function handleSave() {
    if (!String(formData.nome || '').trim()) {
      show('Preencha o nome para salvar o perfil.', 'error');
      return;
    }

    try {
      await saveUser(user.uid, {
        id: user.uid,
        nome: String(formData.nome || '').trim(),
        email: user.email,
        cargo: String(formData.cargo || '').trim(),
        departamento: String(formData.departamento || '').trim(),
        telefone: String(formData.telefone || '').trim(),
        perfil: user.perfil || 'Utilizador',
        status: user.status || 'Pendente',
        perfilAtualizadoPrimeiroLogin: user.perfilAtualizadoPrimeiroLogin ?? true,
      }, { merge: true, updatedBy: user.email });

      await refreshProfile();
      show('Perfil salvo com sucesso.', 'success');
      onClose();
    } catch (err) {
      show(err.message || 'Erro ao salvar perfil.', 'error');
    }
  }

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>
        <AppIcon name="close" />
        Cancelar
      </Button>
      <Button variant="primary" onClick={handleSave}>
        <AppIcon name="save" />
        Salvar Alterações
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <AppIcon name="user" /> Meu Perfil
        </span>
      }
      size="lg"
      footer={footer}
    >
      <section className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex-shrink-0 w-14 h-14 bg-blue-100 text-brand-700 rounded-full flex items-center justify-center text-xl font-bold">
          {String(formData.nome || user?.email || 'U').trim().charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="flex flex-col">
          <strong className="text-lg text-slate-800">{String(formData.nome || '').trim() || 'Utilizador'}</strong>
          <span className="text-sm text-slate-500">{user?.email || '-'}</span>
          <small className="text-xs text-slate-400 mt-1">ID: {formData.id || '-'}</small>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Input
          id="profile-nome"
          label="Nome Completo *"
          value={formData.nome}
          onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Seu nome completo"
        />
        <Input
          id="profile-email"
          label="Email"
          value={formData.email}
          disabled
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Input
          id="profile-cargo"
          label="Cargo"
          value={formData.cargo}
          onChange={(e) => setFormData((prev) => ({ ...prev, cargo: e.target.value }))}
          placeholder="Ex: Engenheiro"
        />
        <Input
          id="profile-departamento"
          label="Departamento"
          value={formData.departamento}
          onChange={(e) => setFormData((prev) => ({ ...prev, departamento: e.target.value }))}
          placeholder="Ex: Geotecnia"
        />
        <Input
          id="profile-telefone"
          label="Telefone"
          type="tel"
          value={formData.telefone}
          onChange={(e) => setFormData((prev) => ({ ...prev, telefone: formatPhone(e.target.value) }))}
          placeholder="(00) 00000-0000"
          maxLength={15}
        />
      </div>

      <section className="bg-brand-50 border border-brand-100 rounded-xl p-5 text-brand-900">
        <div className="flex items-center gap-2 font-bold text-sm mb-2 text-brand-800">
          <AppIcon name="shield" />
          Perfil de Acesso
        </div>
        <strong className="block text-lg mb-1">{formData.perfil}</strong>
        <p className="text-sm opacity-80 m-0">Para alterar seu perfil de acesso, contate um administrador.</p>
      </section>
    </Modal>
  );
}

export default ProfileModal;

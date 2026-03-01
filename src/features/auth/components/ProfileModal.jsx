import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
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

  return (
    <div className="modal-backdrop profile-modal-backdrop">
      <div className="modal wide profile-modal">
        <div className="profile-modal-head">
          <h3>
            <AppIcon name="user" />
            Meu Perfil
          </h3>
          <button type="button" className="profile-modal-close secondary" onClick={onClose}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="profile-modal-body">
          <section className="profile-ident-card">
            <div className="profile-ident-avatar">
              {String(formData.nome || user?.email || 'U').trim().charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="profile-ident-details">
              <strong>{String(formData.nome || '').trim() || 'Utilizador'}</strong>
              <span>{user?.email || '-'}</span>
              <small>ID: {formData.id || '-'}</small>
            </div>
          </section>

          <div className="profile-form-grid profile-form-grid-two">
            <label>
              <span>Nome Completo *</span>
              <input
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Seu nome completo"
              />
            </label>
            <label>
              <span>Email</span>
              <input value={formData.email} disabled />
            </label>
          </div>

          <div className="profile-form-grid profile-form-grid-three">
            <label>
              <span>Cargo</span>
              <input
                value={formData.cargo}
                onChange={(e) => setFormData((prev) => ({ ...prev, cargo: e.target.value }))}
                placeholder="Ex: Engenheiro"
              />
            </label>
            <label>
              <span>Departamento</span>
              <input
                value={formData.departamento}
                onChange={(e) => setFormData((prev) => ({ ...prev, departamento: e.target.value }))}
                placeholder="Ex: Geotecnia"
              />
            </label>
            <label>
              <span>Telefone</span>
              <input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData((prev) => ({ ...prev, telefone: formatPhone(e.target.value) }))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </label>
          </div>

          <section className="profile-access-card">
            <div className="profile-access-title">
              <AppIcon name="shield" />
              Perfil de Acesso
            </div>
            <strong>{formData.perfil}</strong>
            <p>Para alterar seu perfil de acesso, contate um administrador.</p>
          </section>
        </div>

        <div className="row-actions profile-modal-actions">
          <button type="button" onClick={handleSave} className="profile-save-btn">
            <AppIcon name="save" />
            Salvar Alteracoes
          </button>
          <button type="button" className="secondary profile-cancel-btn" onClick={onClose}>
            <AppIcon name="close" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;

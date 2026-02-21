import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { saveUser } from '../../../services/userService';

function ProfileModal({ onClose }) {
  const { user, refreshProfile } = useAuth();
  const { show } = useToast();
  const [formData, setFormData] = useState({
    nome: user?.nome || '',
    cargo: user?.cargo || '',
    departamento: user?.departamento || '',
    telefone: user?.telefone || '',
  });

  async function handleSave() {
    try {
      await saveUser(user.uid, {
        id: user.uid,
        nome: formData.nome,
        email: user.email,
        cargo: formData.cargo,
        departamento: formData.departamento,
        telefone: formData.telefone,
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
    <div className="modal-backdrop">
      <div className="modal wide">
        <h3>Meu Perfil</h3>
        <div className="grid-form">
          <input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Nome" />
          <input value={user.email || ''} disabled />
          <input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} placeholder="Cargo" />
          <input value={formData.departamento} onChange={(e) => setFormData({ ...formData, departamento: e.target.value })} placeholder="Departamento" />
          <input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="Telefone" />
          <input value={user.perfil || 'Utilizador'} disabled />
        </div>

        <div className="row-actions">
          <button type="button" onClick={handleSave}>Salvar</button>
          <button type="button" className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;

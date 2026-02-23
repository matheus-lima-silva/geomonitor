import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { saveUser } from '../../../services/userService';

function MandatoryProfileUpdateView() {
  const { user, refreshProfile } = useAuth();
  const { show } = useToast();
  const [formData, setFormData] = useState({
    nome: user?.nome || '',
    cargo: '',
    departamento: '',
    telefone: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!formData.nome || !formData.cargo || !formData.departamento || !formData.telefone) {
      show('Preencha todos os campos obrigatÃ³rios.', 'error');
      return;
    }

    setSaving(true);
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
        perfilAtualizadoPrimeiroLogin: true,
      }, { merge: true, updatedBy: user.email });

      await refreshProfile();
      show('Perfil atualizado com sucesso.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao atualizar perfil.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel auth">
      <h2>Complete seu perfil</h2>
      <p className="muted">Antes de acessar o sistema, atualize seus dados obrigatÃ³rios.</p>
      <form onSubmit={handleSave} className="grid-form">
        <input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Nome" required />
        <input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} placeholder="Cargo" required />
        <input value={formData.departamento} onChange={(e) => setFormData({ ...formData, departamento: e.target.value })} placeholder="Departamento" required />
        <input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="Telefone" required />
        <button type="submit" disabled={saving}>
          <AppIcon name="save" />
          {saving ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </form>
    </section>
  );
}

export default MandatoryProfileUpdateView;

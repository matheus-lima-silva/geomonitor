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
      show('Preencha todos os campos obrigatórios.', 'error');
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

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60";

  return (
    <section className="w-full max-w-lg mx-auto mt-12 bg-white rounded-2xl shadow-panel border border-slate-200 p-8 flex flex-col gap-5">
      <h2 className="text-xl font-bold text-slate-800 m-0">Complete seu perfil</h2>
      <p className="text-sm text-slate-500">Antes de acessar o sistema, atualize seus dados obrigatórios.</p>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <input className={inputCls} value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Nome" required />
        <input className={inputCls} value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} placeholder="Cargo" required />
        <input className={inputCls} value={formData.departamento} onChange={(e) => setFormData({ ...formData, departamento: e.target.value })} placeholder="Departamento" required />
        <input className={inputCls} value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="Telefone" required />
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <AppIcon name="save" size={18} />
          {saving ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </form>
    </section>
  );
}

export default MandatoryProfileUpdateView;

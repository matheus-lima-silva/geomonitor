import { useState } from 'react';
import AppIcon from './AppIcon';
import { useToast } from '../context/ToastContext';
import { createEmptyProject } from '../models/projectModel';
import { useProjects } from '../hooks/useProjects';

function ProjectManager({ onProjectsChange }) {
  const { projects, loading, addProject } = useProjects();
  const { show } = useToast();
  const [form, setForm] = useState(createEmptyProject());

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await addProject({
        ...form,
        coordenadasPorTorre: form.coordenadasPorTorre,
      });
      const reset = createEmptyProject();
      setForm(reset);
      show('Empreendimento salvo com sucesso.', 'success');
      onProjectsChange?.();
    } catch {
      show('Erro ao salvar empreendimento.', 'error');
    }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors";

  return (
    <section className="p-4 md:p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 m-0">Empreendimentos</h2>
        <p className="text-sm text-slate-500 mt-1">Cadastre e mantenha os dados base das linhas de transmissão.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <input className={inputCls} placeholder="Nome" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
        <input className={inputCls} placeholder="Código" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} required />
        <input
          className={inputCls}
          placeholder="Total de torres"
          type="number"
          min="0"
          value={form.totalTorres}
          onChange={(e) => setForm((p) => ({ ...p, totalTorres: e.target.value }))}
        />
        <textarea
          className={`${inputCls} md:col-span-2`}
          placeholder="Coordenadas por torre (JSON opcional)"
          value={typeof form.coordenadasPorTorre === 'string' ? form.coordenadasPorTorre : JSON.stringify(form.coordenadasPorTorre)}
          onChange={(e) => setForm((p) => ({ ...p, coordenadasPorTorre: e.target.value }))}
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 md:col-span-2"
        >
          <AppIcon name="save" size={18} />
          Salvar empreendimento
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando empreendimentos...</p>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Total de torres</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{project.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{project.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">{project.totalTorres}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ProjectManager;

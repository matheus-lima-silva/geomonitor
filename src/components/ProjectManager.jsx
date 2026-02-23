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

  return (
    <section className="panel">
      <h2>Empreendimentos</h2>
      <p className="muted">Cadastre e mantenha os dados base das linhas de transmissÃ£o.</p>

      <form onSubmit={handleSubmit} className="grid-form">
        <input placeholder="Nome" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
        <input placeholder="CÃ³digo" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} required />
        <input
          placeholder="Total de torres"
          type="number"
          min="0"
          value={form.totalTorres}
          onChange={(e) => setForm((p) => ({ ...p, totalTorres: e.target.value }))}
        />
        <textarea
          placeholder="Coordenadas por torre (JSON opcional)"
          value={typeof form.coordenadasPorTorre === 'string' ? form.coordenadasPorTorre : JSON.stringify(form.coordenadasPorTorre)}
          onChange={(e) => setForm((p) => ({ ...p, coordenadasPorTorre: e.target.value }))}
        />
        <button type="submit">
          <AppIcon name="save" />
          Salvar empreendimento
        </button>
      </form>

      {loading ? (
        <p>Carregando empreendimentos...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CÃ³digo</th>
              <th>Total de torres</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.nome}</td>
                <td>{project.codigo}</td>
                <td>{project.totalTorres}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default ProjectManager;

import { useRef } from 'react';
import AppIcon from '@app/components/AppIcon';
import { Button } from '@app/components/ui';
import { genId, ID_PREFIX } from '../../utils/ids';

const MIN_TEXTAREA_HEIGHT = 110;
const CHARS_PER_WORD_LINE = 95;

function projectStats(text) {
  const length = (text || '').length;
  const lines = Math.max(1, Math.ceil(length / CHARS_PER_WORD_LINE));
  return `${length} caracteres · ~${lines} linha${lines !== 1 ? 's' : ''} no Word`;
}

/**
 * Resumo por projeto do engenheiro ativo — um item por empreendimento, vira a
 * secao 2.n.1 do documento (bullets "Nome: texto"). Textarea auto-resize com
 * contagem de caracteres/linhas estimadas no Word.
 */
export default function ProjectSummaryList({ projects, onChange }) {
  const containerRef = useRef(null);

  function updateProject(projectId, patch) {
    onChange(projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
  }

  function addProject() {
    onChange([...projects, { id: genId(ID_PREFIX.project), name: '', description: '', sortOrder: projects.length }]);
  }

  function removeProject(projectId) {
    if (!window.confirm('Remover este projeto do resumo?')) return;
    onChange(projects.filter((p) => p.id !== projectId));
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(MIN_TEXTAREA_HEIGHT, textarea.scrollHeight + 4)}px`;
  }

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mt-6 mb-1">
        <h3 className="m-0 text-md font-bold text-slate-800">Resumo por projeto</h3>
        <Button variant="outline" size="sm" onClick={addProject}>
          <AppIcon name="plus" className="w-[15px] h-[15px] mr-1.5" />
          Adicionar projeto
        </Button>
      </div>
      <p className="m-0 mb-3 text-sm text-slate-500">
        Um item por empreendimento — entra como a seção 2.n.1 do engenheiro selecionado.
      </p>

      <div className="flex flex-col gap-3">
        {projects.length === 0 ? (
          <p className="m-0 text-sm text-slate-400">Nenhum projeto ainda — adicione o primeiro empreendimento.</p>
        ) : projects.map((project, idx) => (
          <div
            key={project.id}
            data-testid="project-item"
            className="rounded-[10px] border border-slate-200 bg-app-surfaceMuted p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-slate-500 shrink-0">{idx + 1}.</span>
              <input
                type="text"
                aria-label={`Nome do empreendimento ${idx + 1}`}
                placeholder="Nome do empreendimento (ex: LT 500 kV Bom Despacho–Ouro Preto)"
                className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={project.name || ''}
                onChange={(e) => updateProject(project.id, { name: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Remover projeto ${idx + 1}`}
                className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"
                onClick={() => removeProject(project.id)}
              >
                <AppIcon name="x" className="w-4 h-4" />
              </button>
            </div>
            <textarea
              aria-label={`Descrição do empreendimento ${idx + 1}`}
              placeholder="Descrição das atividades desenvolvidas neste empreendimento..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
              style={{ minHeight: MIN_TEXTAREA_HEIGHT }}
              value={project.description || ''}
              onChange={(e) => {
                autoResize(e.target);
                updateProject(project.id, { description: e.target.value });
              }}
            />
            <p className="m-0 mt-1 font-mono text-2xs text-slate-400">{projectStats(project.description)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

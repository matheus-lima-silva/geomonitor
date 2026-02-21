import { useEffect, useMemo, useState } from 'react';
import { useAutoSaveInspection } from '../hooks/useAutoSaveInspection';
import { createEmptyInspection } from '../models/inspectionModel';
import { saveErosion } from '../services/erosionService';
import { gerarPeriodoDias, preservarDetalhesDias } from '../utils/dateUtils';
import { parseTowerInput } from '../utils/parseTowerInput';
import { useToast } from '../context/ToastContext';
import {
  EROSION_LOCATION_OPTIONS,
  validateErosionLocation,
} from '../features/erosions/utils/erosionUtils';

function createInspectionId(projetoId, dataInicio) {
  if (!projetoId || !dataInicio) return `VS-${Date.now()}`;
  const [yyyy, mm, dd] = String(dataInicio).split('-');
  return `VS-${String(projetoId).toUpperCase()}-${dd}${mm}${yyyy}`;
}

function InspectionManager({ projects, onSaved, planningDraft, onPlanningDraftConsumed }) {
  const [inspection, setInspection] = useState(createEmptyInspection());
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [torreModal, setTorreModal] = useState(null);
  const [suggestedTowerInput, setSuggestedTowerInput] = useState('');
  const { ensureSaved, saving } = useAutoSaveInspection();
  const { show } = useToast();

  const diaAtual = useMemo(
    () => inspection.detalhesDias.find((dia) => dia.data === diaSelecionado),
    [inspection.detalhesDias, diaSelecionado],
  );

  function sincronizarDias(nextInspection) {
    const datas = gerarPeriodoDias(nextInspection.dataInicio, nextInspection.dataFim);
    const detalhesDias = preservarDetalhesDias(nextInspection.detalhesDias, datas);

    const firstDate = detalhesDias[0]?.data ?? '';
    if (!diaSelecionado && firstDate) setDiaSelecionado(firstDate);

    return { ...nextInspection, detalhesDias };
  }

  function atualizarDia(data, updater) {
    setInspection((prev) => ({
      ...prev,
      detalhesDias: prev.detalhesDias.map((dia) => (dia.data === data ? updater(dia) : dia)),
    }));
  }

  function applySuggestedTowersToCurrentDay() {
    if (!diaSelecionado || !suggestedTowerInput) return;
    const torres = parseTowerInput(suggestedTowerInput);
    atualizarDia(diaSelecionado, (dia) => ({
      ...dia,
      torres: torres,
      torresDetalhadas: torres.map(
        (numero) => dia.torresDetalhadas.find((item) => item.numero === numero) ?? { numero, obs: '', temErosao: false },
      ),
    }));
    show('Torres sugeridas aplicadas ao dia selecionado.', 'success');
  }

  async function abrirModalErosao(numeroTorre) {
    try {
      const inspectionId = await ensureSaved({
        ...inspection,
        id: inspection.id || createInspectionId(inspection.projetoId, inspection.dataInicio),
      });
      setInspection((prev) => ({ ...prev, id: inspectionId }));
      setTorreModal(numeroTorre);
    } catch {
      show('Não foi possível salvar vistoria antes da erosão.', 'error');
    }
  }

  async function handleSaveErosion(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const localTipo = String(formData.get('localTipo') || '').trim();
      const localDescricao = String(formData.get('localDescricao') || '').trim();
      const locationValidation = validateErosionLocation({ localTipo, localDescricao });
      if (!locationValidation.ok) {
        show(locationValidation.message, 'error');
        return;
      }

      await saveErosion({
        vistoriaId: inspection.id,
        projetoId: inspection.projetoId,
        torreRef: String(torreModal),
        latitude: formData.get('latitude') || '',
        longitude: formData.get('longitude') || '',
        localTipo,
        localDescricao,
        obs: formData.get('descricao') || '',
      }, { origem: 'vistoria' });

      atualizarDia(diaSelecionado, (dia) => ({
        ...dia,
        torresDetalhadas: dia.torresDetalhadas.map((torre) =>
          towerMatches(torre.numero, torreModal) ? { ...torre, temErosao: true } : torre,
        ),
      }));

      setTorreModal(null);
      show('Erosão cadastrada com sucesso.', 'success');
    } catch {
      show('Erro ao cadastrar erosão.', 'error');
    }
  }

  function towerMatches(a, b) {
    return String(a) === String(b);
  }

  useEffect(() => {
    if (!planningDraft) return undefined;
    setInspection((prev) => ({
      ...prev,
      projetoId: planningDraft.projectId || prev.projetoId,
      id: prev.id || createInspectionId(planningDraft.projectId || prev.projetoId, prev.dataInicio),
    }));
    setSuggestedTowerInput(planningDraft.towerInput || '');
    onPlanningDraftConsumed?.();
    return undefined;
  }, [planningDraft, onPlanningDraftConsumed]);

  async function handleSaveInspection() {
    try {
      if (!inspection.projetoId || !inspection.dataInicio) {
        show('Selecione empreendimento e data de início.', 'error');
        return;
      }

      const inspectionId = await ensureSaved({
        ...inspection,
        id: inspection.id || createInspectionId(inspection.projetoId, inspection.dataInicio),
      });

      setInspection((prev) => ({ ...prev, id: inspectionId }));
      show('Vistoria salva com sucesso.', 'success');
      onSaved?.(inspectionId);
    } catch {
      show('Erro ao salvar vistoria.', 'error');
    }
  }

  return (
    <section className="panel nested">
      <h3>Nova Vistoria</h3>
      <p className="muted">Diário multi-dia com checklist por torre e cadastro de erosão.</p>

      <div className="grid-form">
        <select value={inspection.projetoId} onChange={(e) => setInspection((prev) => ({ ...prev, projetoId: e.target.value }))}>
          <option value="">Selecione um empreendimento</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.nome}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={inspection.dataInicio}
          onChange={(e) => setInspection((prev) => sincronizarDias({ ...prev, dataInicio: e.target.value, id: createInspectionId(prev.projetoId, e.target.value) }))}
        />
        <input
          type="date"
          value={inspection.dataFim}
          onChange={(e) => setInspection((prev) => sincronizarDias({ ...prev, dataFim: e.target.value }))}
        />
        <input
          placeholder="Responsável"
          value={inspection.responsavel || ''}
          onChange={(e) => setInspection((prev) => ({ ...prev, responsavel: e.target.value }))}
        />
        <input
          placeholder="Observações gerais"
          value={inspection.obs || ''}
          onChange={(e) => setInspection((prev) => ({ ...prev, obs: e.target.value }))}
        />
      </div>

      <div className="row-actions">
        <button type="button" onClick={handleSaveInspection} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar vistoria'}
        </button>
      </div>

      {suggestedTowerInput && (
        <div className="notice">
          <div><strong>Torres sugeridas:</strong> {suggestedTowerInput}</div>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={applySuggestedTowersToCurrentDay} disabled={!diaSelecionado}>
              Aplicar torres sugeridas ao dia atual
            </button>
          </div>
        </div>
      )}

      <div className="chips">
        {inspection.detalhesDias.map((dia) => (
          <button key={dia.data} type="button" className={diaSelecionado === dia.data ? 'chip-active' : ''} onClick={() => setDiaSelecionado(dia.data)}>
            {dia.data}
          </button>
        ))}
      </div>

      {diaAtual && (
        <div className="panel nested">
          <h4>Diário de {diaAtual.data}</h4>
          <input
            placeholder="Clima"
            value={diaAtual.clima}
            onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, clima: e.target.value }))}
          />

          <input
            placeholder="Torres visitadas (ex: 1-3, 5, 8)"
            onBlur={(e) => {
              const torres = parseTowerInput(e.target.value);
              atualizarDia(diaSelecionado, (dia) => ({
                ...dia,
                torres,
                torresDetalhadas: torres.map(
                  (numero) => dia.torresDetalhadas.find((item) => item.numero === numero) ?? { numero, obs: '', temErosao: false },
                ),
              }));
            }}
          />

          <ul>
            {diaAtual.torresDetalhadas.map((torre) => (
              <li key={torre.numero} className={torre.temErosao ? 'erosion' : ''}>
                <strong>Torre {torre.numero}</strong>
                <input
                  placeholder="Observação"
                  value={torre.obs}
                  onChange={(e) =>
                    atualizarDia(diaSelecionado, (dia) => ({
                      ...dia,
                      torresDetalhadas: dia.torresDetalhadas.map((item) =>
                        item.numero === torre.numero ? { ...item, obs: e.target.value } : item,
                      ),
                    }))
                  }
                />
                <button type="button" onClick={() => abrirModalErosao(torre.numero)} disabled={saving}>
                  {saving ? 'Salvando...' : 'Detalhar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {torreModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSaveErosion}>
            <h4>Erosão - Torre {torreModal}</h4>
            <select name="localTipo" defaultValue="">
              <option value="">Local da erosão...</option>
              {EROSION_LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <input name="localDescricao" placeholder="Detalhe do local (obrigatório se Outros)" />
            <input name="latitude" placeholder="Latitude" />
            <input name="longitude" placeholder="Longitude" />
            <textarea name="descricao" placeholder="Descrição" rows="4" />
            <div className="row-actions">
              <button type="submit">Salvar erosão</button>
              <button type="button" className="secondary" onClick={() => setTorreModal(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export default InspectionManager;

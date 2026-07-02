import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, SearchableSelect } from '@app/components/ui';
import { useToast } from '@app/context/ToastContext';
import { listProjects } from '@app/services/projectService';

const PLANT_TYPES = ['UHE', 'PCH', 'CGH', 'Subestacao'];
const PLANT_TYPE_LABELS = { UHE: 'UHE', PCH: 'PCH', CGH: 'CGH', Subestacao: 'Subestação' };

/**
 * Cadastro de usina (cria a ficha PAEC). Nome + tipo + potencia instalada sao
 * identidade basica da usina (nao entram no manifest tokenizado, ficam em
 * paec_plants); vinculo a empreendimento e copiar-de sao opcionais.
 */
export default function NewPlantModal({ open, onClose, onCreate, existingPlants = [] }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [plantType, setPlantType] = useState('');
  const [installedCapacityMw, setInstalledCapacityMw] = useState('');
  const [projectId, setProjectId] = useState('');
  const [copyFromId, setCopyFromId] = useState('');
  const [projectOptions, setProjectOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPlantType('');
    setInstalledCapacityMw('');
    setProjectId('');
    setCopyFromId('');
    listProjects()
      .then((projects) => {
        setProjectOptions((projects || []).map((p) => ({
          value: p.id,
          label: p.tipo ? `${p.nome} (${p.tipo})` : p.nome,
        })));
      })
      .catch(() => setProjectOptions([]));
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        plantType: plantType || null,
        installedCapacityMw: installedCapacityMw === '' ? null : Number(installedCapacityMw),
        projectId: projectId || null,
        copyFromId: copyFromId || undefined,
      });
    } catch (err) {
      toast.show(err?.message || 'Erro ao criar a ficha.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova usina" size="md">
      <form id="new-plant-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Input
            id="paec-plant-name"
            label="Nome da usina"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: PCH Anta"
            required
          />
          <Select
            id="paec-plant-type"
            label="Tipo"
            value={plantType}
            onChange={(e) => setPlantType(e.target.value)}
          >
            <option value="">—</option>
            {PLANT_TYPES.map((type) => (
              <option key={type} value={type}>{PLANT_TYPE_LABELS[type]}</option>
            ))}
          </Select>
        </div>

        <Input
          id="paec-plant-capacity"
          label="Potência instalada (MW)"
          type="number"
          min="0"
          step="0.1"
          value={installedCapacityMw}
          onChange={(e) => setInstalledCapacityMw(e.target.value)}
          placeholder="Ex.: 12.5"
        />

        <SearchableSelect
          id="paec-plant-project"
          label="Vincular a um empreendimento (opcional)"
          options={projectOptions}
          value={projectId}
          onChange={setProjectId}
          placeholder="Nenhum vínculo"
        />

        <Select
          id="paec-plant-copy-from"
          label="Copiar dados de… (opcional)"
          value={copyFromId}
          onChange={(e) => setCopyFromId(e.target.value)}
        >
          <option value="">Não copiar</option>
          {existingPlants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </form>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button
          type="submit"
          form="new-plant-form"
          variant="primary"
          disabled={!name.trim() || submitting}
        >
          {submitting ? 'Criando…' : 'Criar ficha'}
        </Button>
      </div>
    </Modal>
  );
}

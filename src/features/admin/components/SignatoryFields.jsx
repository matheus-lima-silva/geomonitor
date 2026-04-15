import { Input, Select } from '../../../components/ui';

export const EMPTY_SIG = {
  nome: '',
  profissao_id: '',
  registro_conselho: '',
  registro_estado: '',
  registro_numero: '',
  registro_sufixo: '',
};

export function formatRegistroPreview(conselho, estado, numero, sufixo) {
  const parts = [];
  if (conselho && estado) parts.push(`${conselho}-${estado}`);
  else if (conselho) parts.push(conselho);
  if (numero) parts.push(sufixo ? `${numero}/${sufixo}` : numero);
  return parts.join(' ');
}

export default function SignatoryFields({ data, onChange, prefix, profissoes }) {
  const setField = (field, value) => {
    onChange((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <Input
          id={`${prefix}-nome`}
          label="Nome"
          value={data.nome || ''}
          onChange={(e) => setField('nome', e.target.value)}
          placeholder="Nome completo"
        />
      </div>
      <div className="sm:col-span-1">
        <Select
          id={`${prefix}-prof`}
          label="Profissao"
          value={data.profissao_id || ''}
          onChange={(e) => setField('profissao_id', e.target.value)}
        >
          <option value="">--</option>
          {(profissoes || []).map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </Select>
      </div>
      <div className="sm:col-span-3 grid grid-cols-4 gap-2">
        <Input
          id={`${prefix}-cons`}
          label="Conselho"
          value={data.registro_conselho || ''}
          onChange={(e) => setField('registro_conselho', e.target.value)}
          placeholder="CREA"
        />
        <Input
          id={`${prefix}-uf`}
          label="UF"
          value={data.registro_estado || ''}
          onChange={(e) => setField('registro_estado', e.target.value.slice(0, 2).toUpperCase())}
          placeholder="RJ"
          maxLength={2}
        />
        <Input
          id={`${prefix}-num`}
          label="Numero"
          value={data.registro_numero || ''}
          onChange={(e) => setField('registro_numero', e.target.value)}
          placeholder="123456"
        />
        <Input
          id={`${prefix}-suf`}
          label="Sufixo"
          value={data.registro_sufixo || ''}
          onChange={(e) => setField('registro_sufixo', e.target.value.toUpperCase())}
          placeholder="D"
        />
      </div>
    </div>
  );
}

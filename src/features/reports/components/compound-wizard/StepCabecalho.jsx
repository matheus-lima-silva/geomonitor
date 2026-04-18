import { Input, Select } from '../../../../components/ui';

// Step 1 — identificacao do documento. Este 'Cabecalho' e a metadata exibida
// no cabecalho do DOCX (nome_lt, titulo_programa, codigo_documento), NAO o
// template DOCX em si (que esta perfeito e nao deve ser mexido).
export default function StepCabecalho({ draft, onChange, missingRequired }) {
  function set(key, value) {
    onChange((prev) => ({ ...prev, [key]: value }));
  }

  const nameError = missingRequired?.some((field) => field.key === 'nome')
    ? 'Obrigatório'
    : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          id="wizard-nome"
          label="Nome do relatório *"
          value={draft.nome}
          onChange={(event) => set('nome', event.target.value)}
          placeholder="Ex.: Consolidado trimestral"
          hint="Identificador interno do relatório (não aparece no DOCX)."
          error={nameError}
        />
        <Input
          id="wizard-revisao"
          label="Revisão"
          value={draft.revisao}
          onChange={(event) => set('revisao', event.target.value)}
          placeholder="Ex.: 00"
          hint="Número de revisão do documento (00, 01, 02...)."
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cabeçalho do documento DOCX
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="wizard-nome-lt"
            label="Nome da LT"
            value={draft.nome_lt}
            onChange={(event) => set('nome_lt', event.target.value)}
            placeholder="Ex.: LT 500 kV Cachoeira Paulista - Adrianópolis III"
            hint="Será exibido no cabeçalho de todas as páginas."
          />
          <Input
            id="wizard-titulo-programa"
            label="Título do programa"
            value={draft.titulo_programa}
            onChange={(event) => set('titulo_programa', event.target.value)}
            placeholder="Ex.: Programa de monitoramento de processos erosivos"
            hint="Subtítulo exibido na capa e no cabeçalho."
          />
          <Input
            id="wizard-codigo-doc"
            label="Código do documento"
            value={draft.codigo_documento}
            onChange={(event) => set('codigo_documento', event.target.value)}
            placeholder="Ex.: OOSEMB.RT.061.2026"
            hint="Número do documento conforme sistema de gestão."
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Opções de fotos
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={!!draft.includeTowerCoordinates}
            onChange={(event) => set('includeTowerCoordinates', event.target.checked)}
          />
          <span>Incluir coordenada da torre antes das fotos</span>
        </label>
        {draft.includeTowerCoordinates ? (
          <div className="mt-3 max-w-sm">
            <Select
              id="wizard-coord-format"
              label="Formato da coordenada"
              value={draft.towerCoordinateFormat || 'decimal'}
              onChange={(event) => set('towerCoordinateFormat', event.target.value)}
              hint="Requer que o empreendimento do workspace tenha coordenadas de torres cadastradas."
            >
              <option value="decimal">Decimal (ex: -22.905556°, -43.199444°)</option>
              <option value="dms">Sexagesimal / GMS (ex: 22°54&apos;20&quot;S 43°11&apos;58&quot;W)</option>
              <option value="utm">UTM (ex: 686345E 7465123N 23S)</option>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

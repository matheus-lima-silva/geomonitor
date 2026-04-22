import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Select } from '../../../components/ui';

// Barra de filtros composta para o grid de LOs. Usa estado flat em
// useLicensesFilters (hook) controlado pelo parent. Segue o padrao do
// BibliotecaTab (filtros inline + botao Limpar).

function OrgaoMultiSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedCount = value.length;
  const label = selectedCount === 0
    ? 'Órgão (todos)'
    : selectedCount === 1
      ? value[0]
      : `Órgão (${selectedCount})`;

  function toggle(orgao) {
    if (value.includes(orgao)) onChange(value.filter((v) => v !== orgao));
    else onChange([...value, orgao]);
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <AppIcon name="planning" />
        <span className="truncate max-w-[12rem]">{label}</span>
        <AppIcon name={open ? 'chevron-up' : 'chevron-down'} />
      </Button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-10 mt-1 min-w-[14rem] bg-white border border-slate-200 rounded-lg shadow-panel p-2 max-h-72 overflow-auto"
        >
          {options.length === 0 && <p className="text-xs text-slate-500 px-2 py-1 m-0">Nenhum órgão disponível.</p>}
          {options.map((orgao) => {
            const checked = value.includes(orgao);
            return (
              <label key={orgao} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  className="focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  checked={checked}
                  onChange={() => toggle(orgao)}
                />
                <span>{orgao}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LicenseFiltersBar({ licenses, filters, setFilter, reset, isEmpty }) {
  const orgaoOptions = useMemo(() => {
    const set = new Set();
    for (const lic of Array.isArray(licenses) ? licenses : []) {
      if (lic?.orgaoAmbiental) set.add(lic.orgaoAmbiental);
    }
    return [...set].sort();
  }, [licenses]);

  return (
    <div className="flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-card">
      <div className="flex-1 min-w-[14rem]">
        <Input
          id="license-search"
          label=""
          placeholder="Buscar por número, órgão ou empreendimento"
          value={filters.searchTerm}
          onChange={(e) => setFilter('searchTerm', e.target.value)}
        />
      </div>

      <OrgaoMultiSelect
        options={orgaoOptions}
        value={filters.orgaos}
        onChange={(v) => setFilter('orgaos', v)}
      />

      <Select
        id="license-filter-esfera"
        label=""
        value={filters.esfera}
        onChange={(e) => setFilter('esfera', e.target.value)}
        className="min-w-[8rem]"
      >
        <option value="">Esfera: todas</option>
        <option value="Federal">Federal</option>
        <option value="Estadual">Estadual</option>
      </Select>

      <Input
        id="license-filter-vencimento"
        label=""
        type="date"
        placeholder="Vence antes de"
        value={filters.vencimentoAntes}
        onChange={(e) => setFilter('vencimentoAntes', e.target.value)}
      />

      <label className="inline-flex items-center gap-2 px-2 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 cursor-pointer focus-within:ring-2 focus-within:ring-brand-500">
        <input
          type="checkbox"
          checked={filters.soComErosiva}
          onChange={(e) => setFilter('soComErosiva', e.target.checked)}
          className="focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        />
        Só com acomp. erosivo
      </label>

      {!isEmpty && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <AppIcon name="reset" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

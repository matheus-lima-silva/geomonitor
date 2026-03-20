import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErosionTechnicalFields from '../ErosionTechnicalFields';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function changeInput(el, value) {
  const prototype = Object.getPrototypeOf(el);
  const { set } = Object.getOwnPropertyDescriptor(prototype, 'value') || {};
  if (set) {
    set.call(el, value);
  } else {
    el.value = value;
  }
  act(() => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function clickElement(el) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function focusElement(el) {
  act(() => {
    el.focus();
  });
}

function blurElement(el) {
  act(() => {
    el.blur();
  });
}

function findFeicaoSelect(scope) {
  return [...scope.querySelectorAll('select')].find((select) => (
    ['laminar', 'sulco', 'movimento_massa', 'ravina', 'vocoroca']
      .every((value) => [...select.options].some((option) => option.value === value))
  ));
}

function findHintButton(scope, labelFragment) {
  return [...scope.querySelectorAll('button')].find((button) => (
    String(button.getAttribute('aria-label') || '').includes(labelFragment)
  ));
}

function renderFields(root, overrides = {}) {
  const props = {
    formData: {
      localContexto: {
        localTipo: 'faixa_servidao',
        exposicao: 'faixa_servidao',
        estruturaProxima: 'torre',
        localDescricao: '',
      },
      presencaAguaFundo: '',
      tiposFeicao: [],
      usosSolo: [],
      usoSoloOutro: '',
      saturacaoPorAgua: '',
      tipoSolo: '',
      profundidadeMetros: '',
      declividadeGraus: '',
      distanciaEstruturaMetros: '',
      sinaisAvanco: false,
      vegetacaoInterior: false,
      impactoVia: null,
      ...overrides.formData,
    },
    onPatch: vi.fn(),
    readOnlyClasses: null,
    validationErrors: {},
    isHistoricalRecord: false,
    ...overrides,
  };

  act(() => {
    root.render(<ErosionTechnicalFields {...props} />);
  });

  return props;
}

describe('ErosionTechnicalFields', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('usa single-select para tipo predominante e preserva a dica legada dentro do tooltip', () => {
    const props = renderFields(root, {
      formData: {
        tiposFeicao: ['laminar', 'ravina'],
      },
    });

    const feicaoSelect = findFeicaoSelect(container);
    const feicaoHintButton = findHintButton(container, 'Tipo de erosao observado');

    expect(feicaoSelect).toBeTruthy();
    expect(feicaoSelect.value).toBe('ravina');
    expect(feicaoHintButton).toBeTruthy();
    expect(container.textContent).not.toContain('Registro legado com multiplas feicoes detectadas.');

    clickElement(feicaoHintButton);
    expect(container.textContent).toContain('Registro legado com multiplas feicoes detectadas.');

    changeInput(feicaoSelect, 'movimento_massa');
    expect(props.onPatch).toHaveBeenCalledWith({ tiposFeicao: ['movimento_massa'] });
  });

  it('revela hints sob demanda com foco e clique nos campos principais e na via', () => {
    renderFields(root, {
      formData: {
        localContexto: {
          localTipo: 'via_acesso_exclusiva',
          exposicao: 'faixa_servidao',
          estruturaProxima: 'acesso',
          localDescricao: '',
        },
        impactoVia: {},
      },
    });

    const localHintButton = findHintButton(container, 'Local da');
    const obstrucaoHintButton = findHintButton(container, 'Grau de');

    expect(localHintButton).toBeTruthy();
    expect(obstrucaoHintButton).toBeTruthy();
    expect(container.textContent).not.toContain('Identifique onde a erosao esta em relacao a linha de transmissao.');
    expect(container.textContent).not.toContain('Sem obstrucao: via livre.');

    focusElement(localHintButton);
    expect(container.textContent).toContain('Identifique onde a erosao esta em relacao a linha de transmissao.');

    blurElement(localHintButton);
    expect(container.textContent).not.toContain('Identifique onde a erosao esta em relacao a linha de transmissao.');

    clickElement(obstrucaoHintButton);
    expect(container.textContent).toContain('Sem obstrucao: via livre.');
  });

  it('bloqueia a distancia no leito da via e revela a orientacao apenas sob demanda', () => {
    renderFields(root, {
      formData: {
        localContexto: {
          localTipo: 'via_acesso_exclusiva',
          exposicao: 'faixa_servidao',
          estruturaProxima: 'acesso',
          localDescricao: '',
        },
        impactoVia: {
          posicaoRelativaVia: 'leito',
        },
      },
    });

    const distanceHintButton = findHintButton(container, 'borda da via');
    const lockedDistanceInput = [...container.querySelectorAll('input')]
      .find((input) => input.value === '0 m (no leito da via)');

    expect(distanceHintButton).toBeTruthy();
    expect(lockedDistanceInput).toBeTruthy();
    expect(lockedDistanceInput.disabled).toBe(true);
    expect(container.textContent).not.toContain('Erosao no leito da via: distancia zero.');

    clickElement(distanceHintButton);
    expect(container.textContent).toContain('Erosao no leito da via: distancia zero.');
  });
});

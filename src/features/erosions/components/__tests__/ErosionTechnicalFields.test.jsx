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
  describe('V3.1 — erosao em acesso', () => {
    const viaContext = {
      localTipo: 'via_acesso_exclusiva',
      exposicao: 'faixa_servidao',
      estruturaProxima: 'acesso',
      localDescricao: '',
    };

    it('mostra o bloco de trafego primeiro e grava as respostas em impactoVia', () => {
      const props = renderFields(root, { formData: { localContexto: viaContext, impactoVia: { posicaoRelativaVia: 'talude_jusante' } } });
      const block = container.querySelector('[data-testid="erosion-traffic-block"]');
      expect(block).toBeTruthy();
      expect(block.textContent).toContain('A caminhonete passa?');
      expect(block.textContent).toContain('Dá para desviar no local?');
      expect(block.textContent).toContain('A torre tem outro acesso?');

      changeInput(container.querySelector('#erosion-caminhonete-passa'), 'nao_passa');
      expect(props.onPatch).toHaveBeenLastCalledWith({ impactoVia: { posicaoRelativaVia: 'talude_jusante', caminhonetePassa: 'nao_passa' } });

      changeInput(container.querySelector('#erosion-desvio'), 'nao');
      expect(props.onPatch).toHaveBeenLastCalledWith({ impactoVia: { posicaoRelativaVia: 'talude_jusante', possibilidadeDesvio: false } });
    });

    it('nao mostra o bloco de trafego fora de acesso', () => {
      renderFields(root);
      expect(container.querySelector('[data-testid="erosion-traffic-block"]')).toBeNull();
      expect(container.querySelector('#erosion-medicao-metodo')).toBeTruthy();
    });

    it('usa faixas de profundidade em centimetros e grava o meio da faixa', () => {
      const props = renderFields(root, { formData: { localContexto: viaContext, impactoVia: {} } });
      const depthSelect = [...container.querySelectorAll('select')].find((sel) => [...sel.options].some((o) => o.textContent === '25 a 50 cm'));
      expect(depthSelect).toBeTruthy();
      changeInput(depthSelect, 'P3');
      expect(props.onPatch).toHaveBeenLastCalledWith({ profundidadeMetros: 0.38 });
    });

    it('sem medicao, explica que a classe vem da resposta da caminhonete', () => {
      renderFields(root, { formData: { localContexto: viaContext, impactoVia: {}, medicaoMetodo: 'sem_medicao' } });
      expect(container.querySelector('[data-testid="erosion-sem-medicao"]').textContent).toContain('A caminhonete passa?');
    });

    it('calcula a largura livre e sugere o grau de obstrucao', () => {
      const props = renderFields(root, {
        formData: { localContexto: viaContext, impactoVia: { larguraPlataformaMetros: '4', larguraComprometidaMetros: '1.5', grauObstrucao: 'parcial' } },
      });
      const info = container.querySelector('[data-testid="erosion-largura-livre"]');
      expect(info.textContent).toContain('Largura livre: 2,5 m');
      expect(info.textContent).toContain('obstrução sugerida: total');
      const useButton = [...info.querySelectorAll('button')].find((b) => b.textContent.includes('Usar sugestão'));
      clickElement(useButton);
      expect(props.onPatch).toHaveBeenLastCalledWith({ impactoVia: { larguraPlataformaMetros: '4', larguraComprometidaMetros: '1.5', grauObstrucao: 'total' } });
    });

    it('sugere "outro acesso" pelo cadastro de acessos da torre', () => {
      const props = renderFields(root, { formData: { localContexto: viaContext, impactoVia: {} }, towerAccessCount: 2 });
      const hint = container.querySelector('[data-testid="erosion-tower-access-count"]');
      expect(hint.textContent).toContain('2 acesso(s)');
      const useButton = [...hint.querySelectorAll('button')].find((b) => b.textContent.includes('Usar: sim'));
      clickElement(useButton);
      expect(props.onPatch).toHaveBeenLastCalledWith({ impactoVia: { rotaAlternativaDisponivel: true } });
    });
  });
  describe('Fase 5 — sugestoes das bases publicas', () => {
    const env = {
      towerNumber: '104',
      declividadeMediaGraus: 9.5,
      declividadeMaxGraus: 13.6,
      usosSoloSugeridos: ['pastagem', 'outro'],
      usoSoloOutroSugerido: 'Mineracao',
      usosSoloFonte: 'MapBiomas C11 2024',
      raioM: 50,
    };

    it('mostra a declividade do terreno e aplica so quando o usuario pede', () => {
      const props = renderFields(root, { towerEnvironment: env });
      const slope = container.querySelector('[data-testid="erosion-env-slope"]');
      expect(slope.textContent).toContain('Terreno em volta da torre 104: ~9,5°');
      expect(slope.textContent).toContain('máx. 13,6°');
      expect(props.onPatch).not.toHaveBeenCalled();
      clickElement([...slope.querySelectorAll('button')].find((b) => b.textContent === 'Usar'));
      expect(props.onPatch).toHaveBeenLastCalledWith({ declividadeGraus: 9.5 });
    });

    it('mostra o ANADEM so como referencia e aplica o Copernicus', () => {
      const props = renderFields(root, {
        towerEnvironment: { ...env, anadem: { declividadeMediaGraus: 7.4, declividadeMaxGraus: 8.7 } },
      });
      const slope = container.querySelector('[data-testid="erosion-env-slope"]');
      expect(slope.textContent).toContain('~9,5°');
      expect(slope.textContent).toContain('terreno sem vegetação (ANADEM): ~7,4°');
      clickElement([...slope.querySelectorAll('button')].find((b) => b.textContent === 'Usar'));
      expect(props.onPatch).toHaveBeenLastCalledWith({ declividadeGraus: 9.5 });
    });

    it('sugere usos do solo com a fonte e soma aos ja marcados', () => {
      const props = renderFields(root, { towerEnvironment: env, formData: { usosSolo: ['acesso'] } });
      const uses = container.querySelector('[data-testid="erosion-env-uses"]');
      expect(uses.textContent).toContain('MapBiomas C11 2024, raio de 50 m');
      expect(uses.textContent).toContain('Mineracao');
      clickElement([...uses.querySelectorAll('button')].find((b) => b.textContent === 'Usar sugestão'));
      expect(props.onPatch).toHaveBeenLastCalledWith({ usosSolo: ['acesso', 'pastagem', 'outro'], usoSoloOutro: 'Mineracao' });
    });

    it('indica "ja marcado" quando os usos sugeridos ja estao na ficha', () => {
      renderFields(root, { towerEnvironment: { ...env, usosSoloSugeridos: ['pastagem'], usoSoloOutroSugerido: '' }, formData: { usosSolo: ['pastagem'] } });
      expect(container.querySelector('[data-testid="erosion-env-uses"]').textContent).toContain('já marcado');
    });

    it('sugere o tipo de solo do IBGE e mostra a suscetibilidade RUSLE', () => {
      const props = renderFields(root, {
        towerEnvironment: {
          ...env,
          solo: { tipoSoloSugerido: 'argiloso', ibge: { ordem: 'ARGISSOLO', subordem: 'VERMELHO-AMARELO', textura: 'Média/argilosa' } },
          rusle: { classe: 'muito_alta', perdaSoloIndice: 53.6, kFonte: 'embrapa' },
        },
      });
      const soil = container.querySelector('[data-testid="erosion-env-soil"]');
      expect(soil.textContent).toContain('argissolo vermelho-amarelo, textura média/argilosa');
      clickElement([...soil.querySelectorAll('button')].find((b) => b.textContent === 'Usar'));
      expect(props.onPatch).toHaveBeenLastCalledWith({ tipoSolo: 'argiloso' });
      const rusle = container.querySelector('[data-testid="erosion-env-rusle"]').textContent;
      expect(rusle).toContain('muito alta');
      expect(rusle).toContain('K da Embrapa');
    });

    it('sem dados da torre nao mostra sugestoes', () => {
      renderFields(root);
      expect(container.querySelector('[data-testid="erosion-env-uses"]')).toBeNull();
      expect(container.querySelector('[data-testid="erosion-env-slope"]')).toBeNull();
    });
  });
});

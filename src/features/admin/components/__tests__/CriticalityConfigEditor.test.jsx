import { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CriticalityConfigEditor from '../CriticalityConfigEditor';
import { CRITICALITY_DEFAULTS, mergeCriticalityConfig } from '../../../shared/rulesConfig';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const INITIAL = JSON.stringify(mergeCriticalityConfig(CRITICALITY_DEFAULTS), null, 2);

function setReactInputValue(input, value) {
  const proto = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) descriptor.set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function Harness({ initial, onValidityChange }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CriticalityConfigEditor value={value} onChange={setValue} onValidityChange={onValidityChange} />
      <pre data-testid="out">{value}</pre>
    </>
  );
}

describe('CriticalityConfigEditor', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  function out() {
    return JSON.parse(container.querySelector('[data-testid="out"]').textContent);
  }

  it('renderiza as faixas C1-C4 e a matriz de fatores', () => {
    act(() => { root.render(<Harness initial={INITIAL} />); });
    expect(container.textContent).toContain('Faixas de classificacao (C1-C4)');
    expect(container.textContent).toContain('Pontos por fator');
    ['C1', 'C2', 'C3', 'C4'].forEach((code) => expect(container.textContent).toContain(code));
    ['Tipo de erosao', 'Profundidade', 'Declividade', 'Solo', 'Atividade', 'Exposicao']
      .forEach((rotulo) => expect(container.textContent).toContain(rotulo));
  });

  it('editar o limite de uma faixa encadeia o inicio da seguinte e emite JSON', () => {
    act(() => { root.render(<Harness initial={INITIAL} />); });
    const c1Max = container.querySelector('[aria-label="Limite superior de C1"]');
    act(() => { setReactInputValue(c1Max, '5'); });

    const config = out();
    const c1 = config.faixas.find((f) => f.codigo === 'C1');
    const c2 = config.faixas.find((f) => f.codigo === 'C2');
    expect(c1.max).toBe(5);
    expect(c2.min).toBe(6);
  });

  it('editar um ponto da matriz emite o valor no JSON canonico', () => {
    act(() => { root.render(<Harness initial={INITIAL} />); });
    const input = container.querySelector('[aria-label="Pontos de Profundidade, classe 4"]');
    act(() => { setReactInputValue(input, '8'); });

    expect(out().pontos.profundidade.P4.pontos).toBe(8);
  });

  it('sinaliza invalidez quando uma faixa ultrapassa a seguinte', () => {
    const onValidityChange = vi.fn();
    act(() => { root.render(<Harness initial={INITIAL} onValidityChange={onValidityChange} />); });
    const c1Max = container.querySelector('[aria-label="Limite superior de C1"]');
    act(() => { setReactInputValue(c1Max, '100'); });

    expect(container.textContent).toContain('deve ser menor que o de C2');
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('preserva os campos nao editados (solucoes_por_criticidade, descricoes)', () => {
    act(() => { root.render(<Harness initial={INITIAL} />); });
    const input = container.querySelector('[aria-label="Pontos de Solo, classe 1"]');
    act(() => { setReactInputValue(input, '1'); });

    const config = out();
    expect(config.solucoes_por_criticidade?.C4?.tipo_medida).toBe('engenharia_PRAD');
    expect(config.pontos.profundidade.P2.descricao).toBe('> 1 - 10');
  });
});

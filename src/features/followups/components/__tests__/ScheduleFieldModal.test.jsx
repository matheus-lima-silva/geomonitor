globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleFieldModal from '../ScheduleFieldModal';

let container = null;
let root = null;

const campaign = {
  id: 'LT-1|2026-03',
  projeto: 'Linha Norte',
  rotulo: 'Entrega Mar/2026',
  entregaMes: 3,
  entregaAno: 2026,
  daysUntilDue: 10,
  delivered: false,
  vistorias: [],
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

function render(props = {}) {
  act(() => root.render(
    <ScheduleFieldModal
      open
      campaign={campaign}
      value={null}
      onClose={vi.fn()}
      onSave={vi.fn()}
      {...props}
    />,
  ));
}

function setById(id, value) {
  const el = container.querySelector(`#${id}`);
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function saveButton() {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Salvar agendamento'));
}

describe('ScheduleFieldModal', () => {
  it('nao renderiza nada sem campanha', () => {
    act(() => root.render(<ScheduleFieldModal open campaign={null} onClose={vi.fn()} onSave={vi.fn()} />));
    expect(container.textContent).toBe('');
  });

  it('exige as datas de inicio e fim', () => {
    const onSave = vi.fn();
    render({ onSave });
    act(() => saveButton().click());
    expect(container.textContent).toContain('Informe as datas');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejeita fim anterior ao inicio', () => {
    const onSave = vi.fn();
    render({ onSave });
    setById('schedule-field-inicio', '2026-03-10');
    setById('schedule-field-fim', '2026-03-05');
    act(() => saveButton().click());
    expect(container.textContent).toContain('igual ou posterior');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('salva o agendamento com a observacao aparada', () => {
    const onSave = vi.fn();
    render({ onSave });
    setById('schedule-field-inicio', '2026-03-10');
    setById('schedule-field-fim', '2026-03-14');
    setById('schedule-field-obs', '  equipe A  ');
    act(() => saveButton().click());
    expect(onSave).toHaveBeenCalledWith({ inicio: '2026-03-10', fim: '2026-03-14', obs: 'equipe A' });
  });

  it('pre-preenche o formulario a partir de value', () => {
    render({ value: { inicio: '2026-02-01', fim: '2026-02-05', obs: 'previo' } });
    expect(container.querySelector('#schedule-field-inicio').value).toBe('2026-02-01');
    expect(container.querySelector('#schedule-field-fim').value).toBe('2026-02-05');
    expect(container.querySelector('#schedule-field-obs').value).toBe('previo');
  });
});

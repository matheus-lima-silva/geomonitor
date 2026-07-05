import { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StepAssinaturas from '../StepAssinaturas';

// Cobre a reordenacao de assinaturas (elaboradores/revisores) que vivia no
// form inline antigo de CompoundsTab e foi migrada para este step do wizard.
// Os testes legados equivalentes (describe.skip em ReportsView.test.jsx) foram
// removidos por exercitarem a UI antiga; a logica de ordem passa a ser coberta aqui.

const mockSignatarios = [
  { id: 'SIG-A', nome: 'Alice Silva', profissao_id: 'PROF-1', profissao_nome: 'Eng Civil', registro_conselho: 'CREA', registro_estado: 'RJ', registro_numero: '111', registro_sufixo: 'D' },
  { id: 'SIG-B', nome: 'Bruno Costa', profissao_id: 'PROF-2', profissao_nome: 'Geologo', registro_conselho: 'CREA', registro_estado: 'SP', registro_numero: '222', registro_sufixo: '' },
  { id: 'SIG-C', nome: 'Carlos Lima', profissao_id: 'PROF-1', profissao_nome: 'Eng Civil', registro_conselho: 'CREA', registro_estado: 'MG', registro_numero: '333', registro_sufixo: '' },
];
const mockProfissoes = [
  { id: 'PROF-1', nome: 'Engenheiro Civil' },
  { id: 'PROF-2', nome: 'Geologo' },
];

// Harness controlado: segura o draft em estado real para que toggles/moves
// disparem re-render, replicando o fluxo do wizard.
function Harness({ initialDraft = { elaboradores: [], revisores: [] }, candidates = mockSignatarios }) {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <StepAssinaturas
      draft={draft}
      onChange={setDraft}
      signatariosCandidatos={candidates}
      profissoes={mockProfissoes}
    />
  );
}

describe('StepAssinaturas', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    container = null;
    root = null;
  });

  function elaboradorCheckbox(nome) {
    const nameSpan = [...container.querySelectorAll('span.flex-1')]
      .find((span) => span.textContent.trim() === nome);
    const row = nameSpan.closest('div');
    return [...row.querySelectorAll('label')]
      .find((label) => label.textContent.trim() === 'Elaborador')
      .querySelector('input[type="checkbox"]');
  }

  function orderedNames() {
    const section = [...container.querySelectorAll('div')].find(
      (div) => div.querySelector('p')?.textContent === 'Ordem dos elaboradores',
    );
    return [...section.querySelectorAll('.min-w-5')].map((badge) => badge.parentElement.textContent.replace(/^\d+/, '').trim());
  }

  it('mostra empty state quando nao ha signatarios cadastrados', () => {
    act(() => root.render(<Harness candidates={[]} />));
    expect(container.textContent).toContain('Nenhum signatário cadastrado');
  });

  it('nao mostra a secao de ordem com menos de 2 elaboradores selecionados', () => {
    act(() => root.render(<Harness />));
    act(() => elaboradorCheckbox('Alice Silva').click());
    expect(container.textContent).not.toContain('Ordem dos elaboradores');
  });

  it('mostra a secao de ordem quando ha 2+ elaboradores selecionados', () => {
    act(() => root.render(<Harness />));
    act(() => elaboradorCheckbox('Alice Silva').click());
    act(() => elaboradorCheckbox('Bruno Costa').click());
    expect(container.textContent).toContain('Ordem dos elaboradores');
    expect(orderedNames()).toEqual(['Alice Silva', 'Bruno Costa']);
  });

  it('mover para cima reordena os elaboradores', () => {
    act(() => root.render(
      <Harness initialDraft={{ elaboradores: ['SIG-A', 'SIG-B', 'SIG-C'], revisores: [] }} />,
    ));
    expect(orderedNames()).toEqual(['Alice Silva', 'Bruno Costa', 'Carlos Lima']);

    // Move Carlos (posicao 3) para cima duas vezes => Carlos fica em primeiro.
    const carlosUp = () => [...container.querySelectorAll('[aria-label="Mover para cima"]')]
      .find((btn) => btn.closest('.justify-between').textContent.includes('Carlos Lima'));
    act(() => carlosUp().click());
    act(() => carlosUp().click());

    expect(orderedNames()).toEqual(['Carlos Lima', 'Alice Silva', 'Bruno Costa']);
  });

  it('o primeiro item nao pode subir e o ultimo nao pode descer', () => {
    act(() => root.render(
      <Harness initialDraft={{ elaboradores: ['SIG-A', 'SIG-B'], revisores: [] }} />,
    ));
    const upButtons = [...container.querySelectorAll('[aria-label="Mover para cima"]')];
    const downButtons = [...container.querySelectorAll('[aria-label="Mover para baixo"]')];
    expect(upButtons[0].disabled).toBe(true);
    expect(downButtons[downButtons.length - 1].disabled).toBe(true);
  });
});

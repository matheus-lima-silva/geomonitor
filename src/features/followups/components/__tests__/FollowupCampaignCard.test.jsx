globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FollowupCampaignCard from '../FollowupCampaignCard';

let container = null;
let root = null;

function baseCampaign(overrides = {}) {
  return {
    id: 'LT-1|2026-03',
    projetoId: 'LT-1',
    projeto: 'Linha Norte',
    rotulo: 'Entrega Mar/2026',
    periodicidade: 'Trimestral',
    entregaMes: 3,
    entregaAno: 2026,
    daysUntilDue: 10,
    delivered: false,
    deliveredAt: '',
    operationalStatusValue: undefined,
    operationalStatusLabel: '',
    operationalStatusTone: 'neutral',
    vistorias: [],
    ...overrides,
  };
}

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

function button(text) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
}

describe('FollowupCampaignCard', () => {
  it('renderiza projeto, id e rotulo da campanha', () => {
    act(() => root.render(
      <FollowupCampaignCard campaign={baseCampaign()} onSchedule={vi.fn()} onNavigate={vi.fn()} />,
    ));
    expect(container.textContent).toContain('Linha Norte');
    expect(container.textContent).toContain('LT-1');
    expect(container.textContent).toContain('Entrega Mar/2026');
  });

  it('mostra pendencia quando nao ha vistoria nem campo agendado e a entrega esta proxima', () => {
    act(() => root.render(
      <FollowupCampaignCard campaign={baseCampaign({ daysUntilDue: 5 })} onSchedule={vi.fn()} onNavigate={vi.fn()} />,
    ));
    expect(container.textContent).toContain('Nenhuma vistoria registrada e nenhum campo agendado');
  });

  it('aciona onSchedule ao clicar em Agendar campo', () => {
    const onSchedule = vi.fn();
    const campaign = baseCampaign();
    act(() => root.render(
      <FollowupCampaignCard campaign={campaign} onSchedule={onSchedule} onNavigate={vi.fn()} />,
    ));
    act(() => button('Agendar campo').click());
    expect(onSchedule).toHaveBeenCalledWith(campaign);
  });

  it('aciona onNavigate nos atalhos de planejamento e relatorio', () => {
    const onNavigate = vi.fn();
    act(() => root.render(
      <FollowupCampaignCard campaign={baseCampaign()} onSchedule={vi.fn()} onNavigate={onNavigate} />,
    ));
    act(() => button('Planejar visita').click());
    expect(onNavigate).toHaveBeenCalledWith('visit-planning');
    act(() => button('Relatório').click());
    expect(onNavigate).toHaveBeenCalledWith('georelat');
  });
});

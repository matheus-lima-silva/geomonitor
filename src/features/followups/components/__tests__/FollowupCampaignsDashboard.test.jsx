globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useFollowupCampaignFacets', () => ({
  useFollowupCampaignFacets: () => ({ emissions: [], loading: false, error: '' }),
}));

import FollowupCampaignsDashboard from '../FollowupCampaignsDashboard';

let container = null;
let root = null;

// reportRows no formato que buildCampaigns espera (project x mes de entrega).
const REPORT_ROWS = [
  {
    key: 'LT-1|2026-03', projectId: 'LT-1', projectName: 'Linha Norte',
    year: 2026, month: 3, monthKey: '2026-03', daysUntilDue: -5,
    operationalStatusValue: undefined, operationalStatusLabel: '', operationalStatusTone: 'neutral',
  },
  {
    key: 'LT-2|2026-04', projectId: 'LT-2', projectName: 'Linha Sul',
    year: 2026, month: 4, monthKey: '2026-04', daysUntilDue: 100,
    deliveredAt: '2026-04-10',
    operationalStatusValue: undefined, operationalStatusLabel: '', operationalStatusTone: 'neutral',
  },
];

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
    <FollowupCampaignsDashboard
      reportRows={REPORT_ROWS}
      inspections={[]}
      projects={[]}
      onNavigate={vi.fn()}
      showToast={vi.fn()}
      {...props}
    />,
  ));
}

function kpiButton(label) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(label));
}

describe('FollowupCampaignsDashboard', () => {
  it('monta as campanhas a partir das reportRows e mostra a contagem', () => {
    render();
    expect(container.textContent).toContain('Linha Norte');
    expect(container.textContent).toContain('Linha Sul');
    expect(container.textContent).toContain('2 de 2 campanhas');
  });

  it('filtra pelo KPI de atraso e atualiza a contagem', () => {
    render();
    act(() => kpiButton('Entrega atrasada').click());
    expect(container.textContent).toContain('1 de 2 campanhas');
    // so o card da campanha atrasada permanece (h3 = titulo do card; "Linha Sul"
    // ainda existe como <option> do filtro, por isso checamos os cards, nao o texto todo).
    const cardTitles = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(cardTitles).toContain('Linha Norte');
    expect(cardTitles).not.toContain('Linha Sul');
  });

  it('abre o modal de agendamento ao clicar em Agendar campo', () => {
    render();
    const agendar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Agendar campo'));
    expect(agendar).toBeTruthy();
    act(() => agendar.click());
    // Modal "Agendar campo" abre (titulo do Modal)
    const heading = [...container.querySelectorAll('h2, h3')].find((h) => h.textContent.includes('Agendar campo'));
    expect(heading).toBeTruthy();
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InspectionPhotoAutofillModal from '../InspectionPhotoAutofillModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Linha sintetica: torre N em lat -20 + N * 0.003 (~333 m entre torres).
const DEG_PER_M_LAT = 1 / 111320;
const towerLat = (n) => -20 + n * 0.003;
const PROJECT = {
  id: 'BMDOPR',
  nome: 'Bom Despacho - Ouro Preto',
  torres: '20',
  torresCoordenadas: Array.from({ length: 20 }, (_, i) => ({ numero: String(i + 1), latitude: towerLat(i + 1), longitude: -44 })),
};

function fakeFile(name, { type = 'image/jpeg', relativePath = '' } = {}) {
  return {
    name,
    type,
    size: 1000,
    lastModified: 1,
    webkitRelativePath: relativePath,
    slice: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function meta({ n, offsetM = 10, label = `BMDOPR\n${n}`, date = '2026-09-22', time = '10:00' }) {
  return {
    gpsLat: towerLat(n) + offsetM * DEG_PER_M_LAT,
    gpsLon: -44,
    capturedAt: date ? `${date}T${time}:00` : null,
    capturedDate: date,
    capturedTime: date ? time : null,
    description: label,
    make: 'samsung',
    model: 'SM-S911B',
    software: 'Timestamp Camera',
    orientation: 1,
  };
}

// 22/09: torre 5 (2 fotos) + 3 fotos da torre 6 etiquetadas 5 (conflito) + GPS-only perto da 7.
// 24/09: torre 9. 23/09 fica sem fotos (gap util).
const METAS = {
  'a.jpg': meta({ n: 5, time: '09:00' }),
  'b.jpg': meta({ n: 5, time: '09:02' }),
  'c.jpg': meta({ n: 6, offsetM: 8, label: 'BMDOPR\n5', time: '10:30' }),
  'd.jpg': meta({ n: 6, offsetM: 9, label: 'BMDOPR\n5', time: '10:31' }),
  'e.jpg': meta({ n: 6, offsetM: 12, label: 'BMDOPR\n5', time: '10:32' }),
  'f.jpg': meta({ n: 7, offsetM: 30, label: null, time: '11:00' }),
  'g.jpg': meta({ n: 9, date: '2026-09-24', time: '08:00' }),
};
const FILES = [
  ...Object.keys(METAS).map((name) => fakeFile(name)),
  fakeFile('video.mp4', { type: 'video/mp4' }),
];

const readExifMeta = vi.fn(async (file) => METAS[file.name] || null);

async function flush(times = 6) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function clickButton(text, scope = document.body) {
  const button = [...scope.querySelectorAll('button')].find((item) => item.textContent.includes(text));
  expect(button, `botao "${text}"`).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button;
}

function selectFiles(files) {
  const input = document.querySelector('#inspection-photo-autofill-folder');
  expect(input).toBeTruthy();
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('InspectionPhotoAutofillModal', () => {
  let container;
  let root;
  let onApply;
  let onCancel;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onApply = vi.fn();
    onCancel = vi.fn();
    readExifMeta.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props = {}) {
    act(() => {
      root.render(
        <InspectionPhotoAutofillModal
          open
          project={PROJECT}
          currentForm={{ projetoId: 'BMDOPR', dataInicio: '', dataFim: '', detalhesDias: [] }}
          onCancel={onCancel}
          onApply={onApply}
          readExifMeta={readExifMeta}
          {...props}
        />,
      );
    });
  }

  async function renderAndAnalyze(props) {
    render(props);
    selectFiles(FILES);
    expect(document.querySelector('[data-testid="photo-autofill-count"]').textContent).toContain('7 fotos JPEG encontradas');
    expect(document.querySelector('[data-testid="photo-autofill-count"]').textContent).toContain('1 arquivo ignorado');
    clickButton('Analisar fotos');
    await flush();
    expect(document.querySelector('[data-testid="photo-autofill-review"]')).toBeTruthy();
  }

  it('conta so JPEGs, analisa e mostra dias, torres, gap e divergencia', async () => {
    await renderAndAnalyze();
    expect(readExifMeta).toHaveBeenCalledTimes(7);

    const days = document.querySelectorAll('[data-testid="photo-autofill-day"]');
    expect(days).toHaveLength(2);
    expect(days[0].textContent).toContain('22/09/2026');
    expect(days[0].textContent).toContain('Novo dia');
    expect(document.querySelector('[data-testid="photo-autofill-gap-day"]').textContent).toContain('23/09/2026');

    // Primeiro dia vem expandido: linhas de torre 5 (conflito) e 7 (GPS, desmarcada).
    const towers = document.querySelectorAll('[data-testid="photo-autofill-tower"]');
    expect(towers).toHaveLength(2);
    expect(towers[0].textContent).toContain('Conflito de legenda');
    expect(towers[0].querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(towers[1].textContent).toContain('Sugestão GPS');
    expect(towers[1].querySelector('input[type="checkbox"]').checked).toBe(false);

    const conflict = document.querySelector('[data-testid="photo-autofill-conflict"]');
    expect(conflict.textContent).toMatch(/3 fotos etiquetadas 5/);
    expect(conflict.querySelector('select').value).toBe('6');
    expect(document.querySelector('[data-testid="photo-autofill-divergences"]').textContent).toContain('1 pendente');
  });

  it('confirmar divergencia tira a linha da lista e o painel some com tudo resolvido; Desfazer volta', async () => {
    await renderAndAnalyze();
    const conflict = document.querySelector('[data-testid="photo-autofill-conflict"]');
    clickButton('Confirmar', conflict);
    expect(document.querySelector('[data-testid="photo-autofill-conflict"]')).toBeNull();
    expect(document.querySelector('[data-testid="photo-autofill-divergences"]')).toBeNull();
    const resolved = document.querySelector('[data-testid="photo-autofill-divergences-resolved"]');
    expect(resolved.textContent).toContain('5 → 6');

    clickButton('Desfazer', resolved);
    expect(document.querySelector('[data-testid="photo-autofill-conflict"]')).toBeTruthy();
  });

  it('aplicar com divergencia pendente pede confirmacao; confirmar entrega analise e decisoes', async () => {
    await renderAndAnalyze();
    clickButton('Aplicar ao diário');
    expect(onApply).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="photo-autofill-confirm-pending"]').textContent).toContain('1 divergência sem confirmar');

    clickButton('Aplicar mesmo assim');
    expect(onApply).toHaveBeenCalledTimes(1);
    const { analysis, decisions } = onApply.mock.calls[0][0];
    expect(analysis.days).toHaveLength(2);
    expect(decisions.towers['2026-09-22|7'].include).toBe(false);
    expect(Object.values(decisions.divergences)[0].status).toBe('pending');
  });

  it('desmarcar torre, marcar GPS-only e definir motivo do gap refletem nas decisoes aplicadas', async () => {
    await renderAndAnalyze();
    const conflict = document.querySelector('[data-testid="photo-autofill-conflict"]');
    clickButton('Confirmar', conflict);

    const towers = document.querySelectorAll('[data-testid="photo-autofill-tower"]');
    act(() => {
      towers[1].querySelector('input[type="checkbox"]').click();
    });
    const gap = document.querySelector('[data-testid="photo-autofill-gap-day"]');
    const reason = gap.querySelector('select');
    act(() => {
      reason.value = 'chuva';
      reason.dispatchEvent(new Event('change', { bubbles: true }));
    });

    clickButton('Aplicar ao diário');
    expect(onApply).toHaveBeenCalledTimes(1);
    const { decisions } = onApply.mock.calls[0][0];
    expect(decisions.towers['2026-09-22|7'].include).toBe(true);
    expect(decisions.gapDays['2026-09-23']).toEqual({ keep: true, reason: 'chuva' });
    expect(Object.values(decisions.divergences)[0]).toEqual({ status: 'confirmed', numero: '6' });
  });

  it('marca "Já no diário" para torre que o dia atual ja tem', async () => {
    await renderAndAnalyze({
      currentForm: {
        projetoId: 'BMDOPR',
        dataInicio: '2026-09-22',
        dataFim: '2026-09-22',
        detalhesDias: [{ data: '2026-09-22', torresDetalhadas: [{ numero: '5', obs: '', temErosao: false }] }],
      },
    });
    const towers = document.querySelectorAll('[data-testid="photo-autofill-tower"]');
    expect(towers[0].textContent).toContain('Já no diário');
    expect(document.querySelectorAll('[data-testid="photo-autofill-day"]')[0].textContent).not.toContain('Novo dia');
  });

  it('Escape chama onCancel e o botao analisar fica desabilitado sem arquivos', () => {
    render();
    const analyze = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Analisar fotos'));
    expect(analyze.disabled).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalled();
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignPhotoIntakeModal from '../CampaignPhotoIntakeModal';

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

describe('CampaignPhotoIntakeModal', () => {
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
        <CampaignPhotoIntakeModal
          open
          project={PROJECT}
          currentForm={{ projetoId: 'BMDOPR', dataInicio: '', dataFim: '', detalhesDias: [] }}
          onCancel={onCancel}
          onApply={onApply}
          readExifMeta={readExifMeta}
          fetchDailyWeather={null}
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

  it('etiqueta com 3a linha ACESSO: fotos saem das divergencias e aparecem contadas como acesso', async () => {
    const accessMetas = { ...METAS };
    for (const name of ['c.jpg', 'd.jpg', 'e.jpg']) accessMetas[name] = { ...METAS[name], description: 'BMDOPR\n5\nACESSO' };
    await renderAndAnalyze({ readExifMeta: vi.fn(async (file) => accessMetas[file.name] || null) });

    expect(document.querySelector('[data-testid="photo-autofill-conflict"]')).toBeNull();
    expect(document.querySelector('[data-testid="photo-autofill-review"]').textContent).toContain('Fotos de acesso: 3');
    const tower5 = [...document.querySelectorAll('[data-testid="photo-autofill-tower"]')].find((row) => row.textContent.includes('5 fotos'));
    expect(tower5.textContent).toContain('3 de acesso');

    clickButton('Aplicar ao diário');
    expect(onApply).toHaveBeenCalledTimes(1);
    const { analysis } = onApply.mock.calls[0][0];
    expect(analysis.stats.accessPhotos).toBe(3);
    expect(analysis.divergences.filter((d) => d.numero === '5')).toEqual([]);
  });

  it('"E acesso" na divergencia some com a linha, Desfazer volta, e as decisoes levam o assunto por foto', async () => {
    await renderAndAnalyze();
    const conflict = document.querySelector('[data-testid="photo-autofill-conflict"]');
    clickButton('É acesso', conflict);
    await flush(2);
    expect(document.querySelector('[data-testid="photo-autofill-conflict"]')).toBeNull();
    const resolved = document.querySelector('[data-testid="photo-autofill-divergences-resolved"]');
    expect(resolved.textContent).toContain('3 fotos marcadas como acesso/contexto');

    clickButton('Desfazer', resolved);
    await flush(2);
    expect(document.querySelector('[data-testid="photo-autofill-conflict"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="photo-autofill-subject-marked"]')).toBeNull();

    clickButton('É acesso', document.querySelector('[data-testid="photo-autofill-conflict"]'));
    await flush(2);
    clickButton('Aplicar ao diário');
    expect(onApply).toHaveBeenCalledTimes(1);
    const { decisions, analysis } = onApply.mock.calls[0][0];
    expect(decisions.photos['c.jpg|1000|1']).toEqual({ subject: 'acesso' });
    expect(decisions.photos['e.jpg|1000|1']).toEqual({ subject: 'acesso' });
    expect(analysis.stats.accessPhotos).toBe(3);
    // Decisoes anteriores sobrevivem a re-analise (GPS-only segue desmarcada).
    expect(decisions.towers['2026-09-22|7'].include).toBe(false);
  });

  it('expandir a torre lista as fotos e o toggle por foto muda o assunto', async () => {
    await renderAndAnalyze();
    const tower5 = [...document.querySelectorAll('[data-testid="photo-autofill-tower"]')].find((row) => row.textContent.includes('5 fotos'));
    clickButton('5 fotos', tower5);
    const list = document.querySelector('[data-testid="photo-autofill-group-photos"]');
    expect(list).toBeTruthy();
    expect(list.querySelectorAll('li')).toHaveLength(5);
    const firstRow = list.querySelector('li');
    expect(firstRow.textContent).toContain('a.jpg');
    expect(firstRow.querySelector('button[aria-pressed="true"]').textContent).toBe('Torre');

    clickButton('Acesso', firstRow);
    await flush(2);
    const refreshed = [...document.querySelectorAll('[data-testid="photo-autofill-tower"]')].find((row) => row.textContent.includes('5 fotos'));
    expect(refreshed.textContent).toContain('1 de acesso');
    const refreshedList = document.querySelector('[data-testid="photo-autofill-group-photos"]');
    expect(refreshedList.querySelector('li button[aria-pressed="true"]').textContent).toBe('Acesso');
  });

  it('clima sugerido: badge por dia, checkbox aceito por padrao, gap com chuva pre-marcado, recusar reflete nas decisoes', async () => {
    const fetchDailyWeather = vi.fn(async ({ start, end }) => {
      expect(start).toBe('2026-09-22');
      expect(end).toBe('2026-09-24');
      return [
        { date: '2026-09-22', clima: 'Chuva', reason: 'chuvisco 6 h, 2 mm' },
        { date: '2026-09-23', clima: 'Chuva', reason: 'chuva 4 h, 12 mm' },
        { date: '2026-09-24', clima: 'Sol', reason: 'ceu limpo' },
      ];
    });
    await renderAndAnalyze({ fetchDailyWeather });
    await flush(2);
    expect(fetchDailyWeather).toHaveBeenCalledTimes(1);
    expect(fetchDailyWeather.mock.calls[0][0].lon).toBe(-44);

    const badges = [...document.querySelectorAll('[data-testid="photo-autofill-weather"]')].map((b) => b.textContent);
    expect(badges).toEqual(['Clima: Chuva', 'Clima: Chuva', 'Clima: Sol']);
    expect(document.querySelector('[data-testid="photo-autofill-review"]').textContent).toContain('Clima sugerido em 2 dias'); // 23/09 ja entra como Chuva pelo motivo do gap

    // Gap 23/09 com chuva: motivo pre-marcado.
    const gap = document.querySelector('[data-testid="photo-autofill-gap-day"]');
    expect(gap.querySelector('select').value).toBe('chuva');

    // Dia 22 (expandido) tem o checkbox aceito; desmarcar vira "ignorado".
    const checkbox = document.querySelector('#weather-2026-09-22');
    expect(checkbox.checked).toBe(true);
    act(() => { checkbox.click(); });
    expect([...document.querySelectorAll('[data-testid="photo-autofill-weather"]')][0].textContent).toContain('ignorado');

    clickButton('Confirmar', document.querySelector('[data-testid="photo-autofill-conflict"]'));
    clickButton('Aplicar ao diário');
    const { decisions } = onApply.mock.calls[0][0];
    expect(decisions.weather['2026-09-22']).toMatchObject({ accept: false, clima: 'Chuva' });
    expect(decisions.weather['2026-09-24']).toMatchObject({ accept: true, clima: 'Sol' });
    expect(decisions.gapDays['2026-09-23'].reason).toBe('chuva');
  });

  it('clima indisponivel nao bloqueia a revisao', async () => {
    const fetchDailyWeather = vi.fn(async () => { throw new Error('Open-Meteo fora'); });
    await renderAndAnalyze({ fetchDailyWeather });
    await flush(2);
    expect(document.querySelector('[data-testid="photo-autofill-weather-error"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="photo-autofill-weather"]')).toHaveLength(0);
    clickButton('Confirmar', document.querySelector('[data-testid="photo-autofill-conflict"]'));
    clickButton('Aplicar ao diário');
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].decisions.weather).toEqual({});
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

  it('sem destinos configurados: nao mostra o bloco, mas entrega filesByKey e diario habilitado', async () => {
    await renderAndAnalyze();
    expect(document.querySelector('[data-testid="photo-intake-destinations"]')).toBeNull();
    clickButton('Aplicar ao diário');
    clickButton('Aplicar mesmo assim');
    const payload = onApply.mock.calls[0][0];
    expect(payload.filesByKey).toBeInstanceOf(Map);
    expect(payload.filesByKey.size).toBe(7);
    expect([...payload.filesByKey.values()][0].name).toBe('a.jpg');
    expect(payload.destinations).toEqual({ diary: { enabled: true, value: '' }, workspace: { enabled: false, value: '' } });
  });

  it('modo workspace: workspace travado, diario opcional com vistoria escolhida, rotulo de envio', async () => {
    await renderAndAnalyze({
      destinations: {
        diary: { available: true, enabled: false, locked: false, options: [{ value: '__new__', label: 'Criar vistoria nova pelas fotos' }, { value: 'VS-1', label: 'VS-1 · 21/09 – 24/09' }], value: '__new__' },
        workspace: { available: true, enabled: true, locked: true, options: [{ value: 'RW-1', label: 'RW-1 · Campanha' }], value: 'RW-1' },
      },
    });
    const block = document.querySelector('[data-testid="photo-intake-destinations"]');
    expect(block).toBeTruthy();
    const workspaceBox = block.querySelector('#photo-intake-dest-workspace');
    expect(workspaceBox.checked).toBe(true);
    expect(workspaceBox.disabled).toBe(true);
    expect(findButtonText('Enviar 6 fotos para o workspace')).toBeTruthy();

    const diaryBox = block.querySelector('#photo-intake-dest-diary');
    expect(diaryBox.checked).toBe(false);
    act(() => { diaryBox.click(); });
    const diarySelect = block.querySelector('#photo-intake-dest-diary-target');
    expect(diarySelect.disabled).toBe(false);
    act(() => {
      diarySelect.value = 'VS-1';
      diarySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(findButtonText('Aplicar ao diário e enviar 6 fotos')).toBeTruthy();

    clickButton('Aplicar ao diário e enviar');
    clickButton('Aplicar mesmo assim');
    const payload = onApply.mock.calls[0][0];
    expect(payload.destinations).toEqual({ diary: { enabled: true, value: 'VS-1' }, workspace: { enabled: true, value: 'RW-1' } });
  });

  it('desmarcar o unico destino desabilita o botao de aplicar', async () => {
    await renderAndAnalyze({
      destinations: {
        diary: { available: true, enabled: true, locked: false },
        workspace: { available: false },
      },
    });
    act(() => { document.querySelector('#photo-intake-dest-diary').click(); });
    const apply = findButtonText('Aplicar ao diário');
    expect(apply.disabled).toBe(true);
  });
});

function findButtonText(text) {
  return [...document.querySelectorAll('button')].find((item) => item.textContent.includes(text));
}

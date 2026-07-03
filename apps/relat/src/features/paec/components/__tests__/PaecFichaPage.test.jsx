import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/paecService', () => {
  class VersionConflictError extends Error {
    constructor(currentVersion) {
      super('conflict');
      this.name = 'VersionConflictError';
      this.code = 'VERSION_CONFLICT';
      this.currentVersion = currentVersion;
    }
  }
  return {
    VersionConflictError,
    fetchPlant: vi.fn(),
    fetchTemplate: vi.fn(),
    savePlant: vi.fn(async (id, data) => ({ ...data, id, version: (data.version || 1) + 1 })),
    migratePlantTemplate: vi.fn(),
    generatePaec: vi.fn(),
    getJobStatus: vi.fn(),
  };
});

vi.mock('@app/services/mediaService', () => ({
  downloadMediaAsset: vi.fn(),
  createMediaUpload: vi.fn(),
  uploadMediaBinary: vi.fn(),
  completeMediaUpload: vi.fn(),
}));
vi.mock('@app/services/reportArchiveService', () => ({ computeFileSha256: vi.fn() }));
vi.mock('@app/components/MediaImage', () => ({
  default: ({ mediaAssetId, alt }) => <img data-media-id={mediaAssetId} alt={alt} />,
}));
vi.mock('@app/features/reports/utils/reportUtils', () => ({ triggerBlobDownload: vi.fn() }));

import {
  fetchPlant, fetchTemplate, savePlant, migratePlantTemplate, generatePaec, getJobStatus, VersionConflictError,
} from '../../services/paecService';
import { downloadMediaAsset } from '@app/services/mediaService';
import { ToastProvider } from '@app/context/ToastContext';
import PaecFichaPage from '../PaecFichaPage';
import { AUTOSAVE_DELAY_MS } from '../../hooks/usePaecPlant';
import { POLL_INTERVAL_MS } from '../../hooks/useGeneratePaecDocx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function sampleManifest() {
  return {
    fields: [
      { key: 'usina', label: 'Nome da usina', section: 'Identificação', type: 'text', required: true },
      { key: 'cnpj_1', label: 'CNPJ', section: 'Identificação', type: 'text', required: true },
      { key: 'nome_rep', label: 'Nome', section: 'Representante legal', type: 'text', required: true },
    ],
    blocks: [{ key: 'brigadistas', kind: 'list', label: 'Relação de brigadistas' }],
  };
}

function samplePlant(overrides = {}) {
  return {
    id: 'PAEC-1',
    name: 'PCH Anta',
    templateId: 'PAECT-1',
    templateRevisionLabel: 'REV 10',
    version: 1,
    fields: { usina: 'PCH Anta' },
    pendencies: [
      { kind: 'field', key: 'cnpj_1', label: 'CNPJ', section: 'Identificação' },
      { kind: 'field', key: 'nome_rep', label: 'Nome', section: 'Representante legal' },
      { kind: 'list', key: 'brigadistas', label: 'Relação de brigadistas', section: null },
    ],
    stats: { fieldsFilled: 1, fieldsTotal: 3 },
    ...overrides,
  };
}

describe('PaecFichaPage', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: sampleManifest() });
    // jsdom nao implementa Element.scrollTo/scrollIntoView (nao ha layout
    // real) — o editor usa os dois pro scroll-spy/navegacao por pendencia.
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  async function renderPage(onExit = vi.fn()) {
    await act(async () => {
      root.render(
        <ToastProvider>
          <PaecFichaPage plantId="PAEC-1" onExit={onExit} />
        </ToastProvider>,
      );
    });
    return onExit;
  }

  it('carrega a ficha e o manifest, renderiza secoes/campos e o painel de pendencias', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    expect(container.textContent).toContain('PCH Anta');
    expect(container.textContent).toContain('REV 10');
    expect(container.querySelector('#paec-field-usina').value).toBe('PCH Anta');
    expect(container.querySelector('#paec-field-cnpj_1').value).toBe('');
    expect(container.textContent).toContain('Identificação');
    expect(container.textContent).toContain('Representante legal');
    expect(container.textContent).toContain('Relação de brigadistas');
    expect(container.textContent).toContain('3 pendências');
  });

  it('editar um campo agenda autosave', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    const input = container.querySelector('#paec-field-cnpj_1');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
    setter.call(input, '00.000.000/0000-00');
    await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });

    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(savePlant).toHaveBeenCalledTimes(1);
    expect(savePlant.mock.calls[0][1].fields.cnpj_1).toBe('00.000.000/0000-00');
  });

  it('clicar numa pendencia de campo no painel foca o input correspondente', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('CNPJ'));
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // requestAnimationFrame tambem e mockado por vi.useFakeTimers() —
      // avanca o relogio falso para disparar o callback agendado.
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(document.activeElement.id).toBe('paec-field-cnpj_1');
  });

  it('bloco list com columns curadas renderiza tabela editavel e autosalva listItems', async () => {
    const manifestWithColumns = {
      ...sampleManifest(),
      blocks: [{
        key: 'brigadistas',
        kind: 'list',
        label: 'Relação de brigadistas',
        columns: [{ key: 'nome', label: 'Nome' }, { key: 'telefone', label: 'Telefone' }],
      }],
    };
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: manifestWithColumns });
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    expect(container.textContent).not.toContain('Edição chega em breve');
    const addButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Adicionar linha'));
    await act(async () => { addButton.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const nomeInput = container.querySelector('[aria-label="Nome"]');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(nomeInput), 'value').set;
    setter.call(nomeInput, 'Fulano de Tal');
    await act(async () => { nomeInput.dispatchEvent(new Event('input', { bubbles: true })); });

    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(savePlant.mock.calls[0][1].listItems).toEqual({
      brigadistas: [{ nome: 'Fulano de Tal', telefone: '' }],
    });
  });

  it('clicar numa tabela em branco no painel de pendencias rola ate o bloco', async () => {
    const manifestWithColumns = {
      ...sampleManifest(),
      blocks: [{
        key: 'brigadistas',
        kind: 'list',
        label: 'Relação de brigadistas',
        columns: [{ key: 'nome', label: 'Nome' }],
      }],
    };
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: manifestWithColumns });
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Relação de brigadistas'));
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(document.getElementById('paec-block-brigadistas')).not.toBeNull();
  });

  it('secoes com renumberGroup renderizam o card de liga/desliga e autosalvam sectionFlags', async () => {
    const manifestWithSections = {
      ...sampleManifest(),
      sections: [
        { sectionKey: 'recurso_a', defaultTitle: '12.1.1. Recurso A', renumberGroup: '12.1' },
        { sectionKey: 'recurso_b', defaultTitle: '12.1.2. Recurso B', renumberGroup: '12.1' },
      ],
    };
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: manifestWithSections });
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    expect(container.textContent).toContain('Seções configuráveis');
    expect(container.textContent).toContain('12.1.1. Recurso A');

    const checkbox = container.querySelector('input[aria-label^="Incluir 12.1.2. Recurso B"]');
    await act(async () => { checkbox.click(); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(savePlant.mock.calls[0][1].sectionFlags).toEqual({ recurso_b: { enabled: false } });
  });

  it('manifest sem secoes com renumberGroup nao renderiza o card de liga/desliga', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();
    expect(container.textContent).not.toContain('Seções configuráveis');
  });

  it('imageSlots do manifest renderizam o card de anexos com as imagens da ficha', async () => {
    const manifestWithSlots = {
      ...sampleManifest(),
      imageSlots: [{
        assetKey: 'anexo_vii_rota_de_fuga',
        label: 'Anexo VII — Rota de fuga',
        maxImages: 5,
      }],
    };
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: manifestWithSlots });
    fetchPlant.mockResolvedValueOnce(samplePlant({
      assets: { anexo_vii_rota_de_fuga: ['MEDIA-1', 'MEDIA-2'] },
    }));
    await renderPage();

    expect(container.textContent).toContain('Anexo VII — Rota de fuga');
    expect(container.textContent).toContain('2/5');
    expect(container.querySelectorAll('img[data-media-id]')).toHaveLength(2);
    expect(document.getElementById('paec-block-anexo_vii_rota_de_fuga')).not.toBeNull();
  });

  it('remover imagem de um slot autosalva assets sem esse mediaId', async () => {
    const manifestWithSlots = {
      ...sampleManifest(),
      imageSlots: [{
        assetKey: 'anexo_vii_rota_de_fuga',
        label: 'Anexo VII — Rota de fuga',
        maxImages: 5,
      }],
    };
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: manifestWithSlots });
    fetchPlant.mockResolvedValueOnce(samplePlant({
      assets: { anexo_vii_rota_de_fuga: ['MEDIA-1', 'MEDIA-2'] },
    }));
    await renderPage();

    const removeButton = container.querySelector('[aria-label^="Remover imagem 1"]');
    await act(async () => { removeButton.click(); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(savePlant.mock.calls[0][1].assets).toEqual({
      anexo_vii_rota_de_fuga: ['MEDIA-2'],
    });
  });

  it('mostra o banner de revisao nova e migra ao clicar', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant({
      activeTemplate: { id: 'PAECT-2', revisionLabel: 'REV 11' },
    }));
    await renderPage();

    expect(container.textContent).toContain('Nova revisão do modelo disponível (REV 11)');

    migratePlantTemplate.mockResolvedValueOnce({ id: 'PAEC-1', templateId: 'PAECT-2' });
    fetchPlant.mockResolvedValueOnce(samplePlant({
      templateId: 'PAECT-2',
      templateRevisionLabel: 'REV 11',
      activeTemplate: null,
    }));
    const migrateButton = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent.includes('Migrar para a revisão nova'));
    await act(async () => { migrateButton.click(); });

    expect(migratePlantTemplate).toHaveBeenCalledWith('PAEC-1');
    expect(container.textContent).not.toContain('Nova revisão do modelo disponível');
  });

  it('sem activeTemplate nao mostra o banner de migracao', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();
    expect(container.textContent).not.toContain('Nova revisão do modelo disponível');
  });

  it('gerar PAEC abre o modal de resultado com as pendencias do job', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    generatePaec.mockResolvedValueOnce({ id: 'JOB-1' });
    getJobStatus.mockResolvedValueOnce({
      statusExecucao: 'completed',
      outputDocxMediaId: 'MEDIA-9',
      resultMeta: { pendencies: [{ kind: 'field', key: 'cnpj_1', label: 'CNPJ' }], stats: { fieldsFilled: 1, fieldsTotal: 3 } },
    });

    const generateBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Gerar PAEC'));
    let promise;
    await act(async () => { promise = generateBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    expect(document.querySelector('[role="dialog"]').textContent).toContain('1 item ficou');
    expect(downloadMediaAsset).not.toHaveBeenCalled();
  });

  it('409 entra em modo conflito e desabilita o formulario', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderPage();

    savePlant.mockRejectedValueOnce(new VersionConflictError(2));
    const input = container.querySelector('#paec-field-cnpj_1');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
    setter.call(input, 'x');
    await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(container.querySelector('[role="alert"]').textContent).toContain('alterada em outra sessão');
    expect(container.querySelector('fieldset').disabled).toBe(true);
  });
});

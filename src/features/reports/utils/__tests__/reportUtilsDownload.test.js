import { describe, expect, it, vi } from 'vitest';
import { triggerUrlDownload, buildKmzImportSummaryText, buildKmzGenerationProgress } from '../reportUtils';

describe('triggerUrlDownload', () => {
  it('navega direto ate a URL via anchor (sem blob/createObjectURL)', () => {
    const clickSpy = vi.fn();
    const realCreate = document.createElement.bind(document);
    let created = null;
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag);
      if (String(tag).toLowerCase() === 'a') {
        created = el;
        el.click = clickSpy;
      }
      return el;
    });

    const url = 'https://geo.lima.rio.br/bucket/key.kmz?X-Amz-Signature=abc';
    const ok = triggerUrlDownload('workspace-fotos.kmz', url);

    expect(ok).toBe(true);
    expect(created).not.toBeNull();
    expect(created.getAttribute('href')).toBe(url);
    expect(created.getAttribute('download')).toBe('workspace-fotos.kmz');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    createSpy.mockRestore();
  });

  it('retorna false sem URL', () => {
    expect(triggerUrlDownload('x.kmz', '')).toBe(false);
  });
});

describe('buildKmzImportSummaryText', () => {
  it('reporta fotos existentes que receberam torre (re-import sem reupload)', () => {
    const text = buildKmzImportSummaryText({ photosUpdated: 3, towersAssigned: 2, photosSkipped: 1 });
    expect(text).toContain('3 foto(s) atualizada(s) (2 com torre)');
    expect(text).toContain('1 sem mudanca');
  });

  it('reporta fotos novas de um KMZ externo', () => {
    expect(buildKmzImportSummaryText({ photosCreated: 5 })).toContain('5 foto(s) nova(s)');
  });

  it('mensagem neutra quando nada muda', () => {
    expect(buildKmzImportSummaryText({ photosSkipped: 0 }))
      .toBe('Nenhuma foto foi alterada pelo KMZ importado.');
  });
});

describe('buildKmzGenerationProgress', () => {
  it('inativo quando ja ha output (pronto para download)', () => {
    const p = buildKmzGenerationProgress({ statusExecucao: 'completed', outputKmzMediaId: 'MED-1' });
    expect(p.active).toBe(false);
  });

  it('indeterminado enquanto na fila', () => {
    const p = buildKmzGenerationProgress({ statusExecucao: 'queued' });
    expect(p.active).toBe(true);
    expect(p.indeterminate).toBe(true);
    expect(p.label).toBe('KMZ na fila...');
  });

  it('percentual durante a renderizacao com progress do worker', () => {
    const p = buildKmzGenerationProgress({
      statusExecucao: 'processing',
      progress: { processed: 120, total: 480 },
    });
    expect(p.active).toBe(true);
    expect(p.indeterminate).toBe(false);
    expect(p.percent).toBe(25);
    expect(p.label).toBe('Gerando KMZ... 120/480 fotos (25%)');
  });

  it('processing sem total ainda contado -> indeterminado', () => {
    const p = buildKmzGenerationProgress({ statusExecucao: 'processing', progress: {} });
    expect(p.indeterminate).toBe(true);
  });

  it('inativo quando status nao e pendente', () => {
    expect(buildKmzGenerationProgress({ statusExecucao: 'failed' }).active).toBe(false);
  });
});

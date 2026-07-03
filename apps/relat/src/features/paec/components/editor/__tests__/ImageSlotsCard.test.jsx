import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const uploadFileMock = vi.fn();
vi.mock('../../../hooks/useMediaUpload', () => ({
  IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  useMediaUpload: () => ({ uploadFile: uploadFileMock, uploading: false }),
}));
// MediaImage resolve URL assinada via fetch — irrelevante aqui, vira um stub.
vi.mock('@app/components/MediaImage', () => ({
  default: ({ mediaAssetId, alt }) => <img data-media-id={mediaAssetId} alt={alt} />,
}));

import ImageSlotsCard from '../ImageSlotsCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SLOT = {
  assetKey: 'anexo_vii_rota_de_fuga',
  label: 'Anexo VII — Rota de fuga',
  maxImages: 3,
};

describe('ImageSlotsCard', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    uploadFileMock.mockReset();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
  });

  it('mostra label, contagem e estado vazio', async () => {
    await act(async () => {
      root.render(<ImageSlotsCard slot={SLOT} mediaIds={[]} plantId="PAEC-1" onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('Anexo VII — Rota de fuga');
    expect(container.textContent).toContain('0/3');
    expect(container.textContent).toContain('Nenhuma imagem ainda');
  });

  it('renderiza uma thumbnail por mediaId com botao de remover', async () => {
    await act(async () => {
      root.render(
        <ImageSlotsCard slot={SLOT} mediaIds={['MEDIA-1', 'MEDIA-2']} plantId="PAEC-1" onChange={vi.fn()} />,
      );
    });
    const thumbs = container.querySelectorAll('img[data-media-id]');
    expect(thumbs).toHaveLength(2);
    expect(container.textContent).toContain('2/3');
    expect(container.querySelectorAll('[aria-label^="Remover imagem"]')).toHaveLength(2);
  });

  it('remover uma imagem chama onChange sem esse mediaId', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ImageSlotsCard slot={SLOT} mediaIds={['MEDIA-1', 'MEDIA-2']} plantId="PAEC-1" onChange={onChange} />,
      );
    });
    const removeButtons = container.querySelectorAll('[aria-label^="Remover imagem"]');
    await act(async () => { removeButtons[0].click(); });
    expect(onChange).toHaveBeenCalledWith('anexo_vii_rota_de_fuga', ['MEDIA-2']);
  });

  it('selecionar arquivos sobe cada um e acrescenta os mediaIds na ordem', async () => {
    const onChange = vi.fn();
    uploadFileMock
      .mockResolvedValueOnce('MEDIA-NOVO-1')
      .mockResolvedValueOnce('MEDIA-NOVO-2');
    await act(async () => {
      root.render(
        <ImageSlotsCard slot={SLOT} mediaIds={['MEDIA-1']} plantId="PAEC-1" onChange={onChange} />,
      );
    });

    const input = container.querySelector('input[type="file"]');
    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });

    expect(uploadFileMock).toHaveBeenCalledTimes(2);
    expect(uploadFileMock).toHaveBeenCalledWith(files[0], { linkedResourceId: 'PAEC-1' });
    expect(onChange).toHaveBeenCalledWith(
      'anexo_vii_rota_de_fuga',
      ['MEDIA-1', 'MEDIA-NOVO-1', 'MEDIA-NOVO-2'],
    );
  });

  it('respeita maxImages truncando a selecao', async () => {
    const onChange = vi.fn();
    uploadFileMock.mockResolvedValue('MEDIA-NOVO');
    await act(async () => {
      root.render(
        <ImageSlotsCard slot={SLOT} mediaIds={['MEDIA-1', 'MEDIA-2']} plantId="PAEC-1" onChange={onChange} />,
      );
    });

    const input = container.querySelector('input[type="file"]');
    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });

    // slot 2/3: so cabe mais 1 — segunda selecao e descartada
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      'anexo_vii_rota_de_fuga',
      ['MEDIA-1', 'MEDIA-2', 'MEDIA-NOVO'],
    );
  });

  it('slot cheio desabilita o botao de adicionar', async () => {
    await act(async () => {
      root.render(
        <ImageSlotsCard
          slot={SLOT}
          mediaIds={['MEDIA-1', 'MEDIA-2', 'MEDIA-3']}
          plantId="PAEC-1"
          onChange={vi.fn()}
        />,
      );
    });
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Adicionar imagem'),
    );
    expect(addButton.disabled).toBe(true);
  });
});

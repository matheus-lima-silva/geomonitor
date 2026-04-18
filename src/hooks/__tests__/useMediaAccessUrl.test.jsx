globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../../services/mediaService', () => ({
  downloadMediaAsset: vi.fn(),
}));

import { downloadMediaAsset } from '../../services/mediaService';
import { useMediaAccessUrl } from '../useMediaAccessUrl';

let urlCounter = 0;
const created = [];
const revoked = [];

beforeEach(() => {
  urlCounter = 0;
  created.length = 0;
  revoked.length = 0;
  globalThis.URL.createObjectURL = (blob) => {
    urlCounter += 1;
    const url = `blob:mock-${urlCounter}`;
    created.push({ blob, url });
    return url;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };
  downloadMediaAsset.mockReset();
});

function Probe({ mediaAssetId, onChange }) {
  const state = useMediaAccessUrl(mediaAssetId);
  onChange(state);
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useMediaAccessUrl', () => {
  it('baixa midia e expoe URL resolvida', async () => {
    downloadMediaAsset.mockResolvedValue({ blob: new Blob(['x']) });
    const states = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe mediaAssetId="MA-1" onChange={(s) => states.push(s)} />);
    });
    await flush();
    expect(downloadMediaAsset).toHaveBeenCalledWith('MA-1');
    const last = states[states.length - 1];
    expect(last.loading).toBe(false);
    expect(last.url).toMatch(/^blob:mock-/);
    await act(async () => {
      root.unmount();
    });
    expect(revoked).toContain(last.url);
  });

  it('compartilha cache entre duas instancias para o mesmo asset', async () => {
    downloadMediaAsset.mockResolvedValue({ blob: new Blob(['x']) });
    const statesA = [];
    const statesB = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <Probe mediaAssetId="MA-SHARED" onChange={(s) => statesA.push(s)} />
          <Probe mediaAssetId="MA-SHARED" onChange={(s) => statesB.push(s)} />
        </>,
      );
    });
    await flush();
    expect(downloadMediaAsset).toHaveBeenCalledTimes(1);
    await act(async () => {
      root.unmount();
    });
  });

  it('expoe error quando download falha', async () => {
    downloadMediaAsset.mockRejectedValue(new Error('boom'));
    const states = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe mediaAssetId="MA-ERR" onChange={(s) => states.push(s)} />);
    });
    await flush();
    const last = states[states.length - 1];
    expect(last.loading).toBe(false);
    expect(last.url).toBeNull();
    expect(last.error).toBeInstanceOf(Error);
    await act(async () => {
      root.unmount();
    });
  });

  it('nao inicia fetch quando mediaAssetId e null', async () => {
    const states = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe mediaAssetId={null} onChange={(s) => states.push(s)} />);
    });
    await flush();
    expect(downloadMediaAsset).not.toHaveBeenCalled();
    const last = states[states.length - 1];
    expect(last.loading).toBe(false);
    expect(last.url).toBeNull();
    await act(async () => { root.unmount(); });
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../../../../services/reportWorkspaceService', () => ({
  subscribeReportWorkspaces: vi.fn(),
  listReportWorkspacePhotos: vi.fn(),
}));

import {
  subscribeReportWorkspaces,
  listReportWorkspacePhotos,
} from '../../../../services/reportWorkspaceService';
import { useErosionPhotoSources } from '../useErosionPhotoSources';

function Probe({ projectId, onChange }) {
  const state = useErosionPhotoSources(projectId);
  onChange(state);
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  subscribeReportWorkspaces.mockReset();
  listReportWorkspacePhotos.mockReset();
});

describe('useErosionPhotoSources', () => {
  it('filtra workspaces pelo projectId e ignora trashed', async () => {
    let subCb;
    subscribeReportWorkspaces.mockImplementation((cb) => {
      subCb = cb;
      return () => {};
    });
    listReportWorkspacePhotos.mockResolvedValue([]);

    const states = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe projectId="P-1" onChange={(s) => states.push(s)} />);
    });

    await act(async () => {
      subCb([
        { id: 'RW-1', projectId: 'P-1', titulo: 'A' },
        { id: 'RW-2', projectId: 'P-2', titulo: 'Outro projeto' },
        { id: 'RW-3', projectId: 'P-1', titulo: 'Trash', trashedAt: '2026-01-01' },
      ]);
    });

    await flush();

    const last = states[states.length - 1];
    expect(last.workspaces.map((ws) => ws.id)).toEqual(['RW-1']);
    expect(last.hasAnyWorkspace).toBe(true);

    await act(async () => { root.unmount(); });
  });

  it('concatena fotos dos workspaces em galeria plana', async () => {
    let subCb;
    subscribeReportWorkspaces.mockImplementation((cb) => {
      subCb = cb;
      return () => {};
    });
    listReportWorkspacePhotos.mockImplementation(async (id) => {
      if (id === 'RW-A') return [
        { id: 'RWP-1', mediaAssetId: 'MA-1', caption: 'f1' },
        { id: 'RWP-2', mediaAssetId: 'MA-2', deletedAt: '2026-01-01' },
      ];
      if (id === 'RW-B') return [{ id: 'RWP-3', mediaAssetId: 'MA-3', caption: 'f3' }];
      return [];
    });

    const states = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe projectId="P-1" onChange={(s) => states.push(s)} />);
    });

    await act(async () => {
      subCb([
        { id: 'RW-A', projectId: 'P-1', titulo: 'A' },
        { id: 'RW-B', projectId: 'P-1', titulo: 'B' },
      ]);
    });

    await flush();
    await flush();

    const last = states[states.length - 1];
    const ids = last.photos.map((p) => p.photoId).sort();
    expect(ids).toEqual(['RWP-1', 'RWP-3']);
    expect(last.photos.find((p) => p.photoId === 'RWP-1').workspaceId).toBe('RW-A');
    expect(last.photos.find((p) => p.photoId === 'RWP-3').workspaceTitle).toBe('B');

    await act(async () => { root.unmount(); });
  });

  it('hasAnyWorkspace falso quando projectId nao tem workspace', async () => {
    let subCb;
    subscribeReportWorkspaces.mockImplementation((cb) => {
      subCb = cb;
      return () => {};
    });
    listReportWorkspacePhotos.mockResolvedValue([]);

    const states = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe projectId="P-NONE" onChange={(s) => states.push(s)} />);
    });
    await act(async () => {
      subCb([{ id: 'RW-X', projectId: 'OTHER' }]);
    });
    await flush();

    const last = states[states.length - 1];
    expect(last.hasAnyWorkspace).toBe(false);
    expect(last.photos).toEqual([]);

    await act(async () => { root.unmount(); });
  });
});

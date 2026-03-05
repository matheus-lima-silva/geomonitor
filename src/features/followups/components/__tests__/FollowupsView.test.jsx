import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FollowupsView from '../FollowupsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const saveReportDeliveryTrackingMock = vi.fn();
const saveErosionManualFollowupEventMock = vi.fn();

vi.mock('../../../../services/reportDeliveryTrackingService', () => ({
  saveReportDeliveryTracking: (...args) => saveReportDeliveryTrackingMock(...args),
}));

vi.mock('../../../../services/erosionService', () => ({
  saveErosionManualFollowupEvent: (...args) => saveErosionManualFollowupEventMock(...args),
}));

describe('FollowupsView', () => {
  let container;
  let root;
  const showToast = vi.fn();

  const setNativeValue = (element, value) => {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
      return;
    }
    if (valueSetter) {
      valueSetter.call(element, value);
      return;
    }
    // Fallback for jsdom edge-cases.
    // eslint-disable-next-line no-param-reassign
    element.value = value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
  });

  it('saves operational status and source override for report delivery tracking', async () => {
    saveReportDeliveryTrackingMock.mockResolvedValue('P1__2026-03');

    await act(async () => {
      root.render(
        <FollowupsView
          reportRows={[{
            key: 'P1|2026-03',
            projectId: 'P1',
            projectName: 'Projeto 1',
            month: 3,
            year: 2026,
            monthKey: '2026-03',
            sourceApplied: 'LO',
            sourceOverride: 'AUTO',
            hasLoOption: true,
            hasProjectOption: true,
            deadlineStatusLabel: 'Urgente',
            operationalStatusValue: 'NAO_INICIADO',
          }]}
          workRows={[]}
          erosions={[]}
          inspections={[]}
          projects={[{ id: 'P1', nome: 'Projeto 1' }]}
          invalidOverrides={[]}
          userActor="analista@empresa.com"
          showToast={showToast}
        />,
      );
      await Promise.resolve();
    });

    const firstRow = [...container.querySelectorAll('tbody tr')]
      .find((row) => row.textContent.includes('P1 - Projeto 1'));
    expect(firstRow).toBeTruthy();
    const selects = firstRow.querySelectorAll('select');
    expect(selects.length).toBe(2);

    await act(async () => {
      setNativeValue(selects[0], 'PROJECT');
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      setNativeValue(selects[1], 'ENTREGUE');
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const dateInput = firstRow.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
    await act(async () => {
      setNativeValue(dateInput, '2026-03-12');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      const notesField = firstRow.querySelector('textarea');
      setNativeValue(notesField, 'Relatorio entregue apos revisao final');
      notesField.dispatchEvent(new Event('input', { bubbles: true }));
      notesField.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const saveButton = firstRow.querySelector('button');
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(saveReportDeliveryTrackingMock).toHaveBeenCalledWith(
      'P1',
      '2026-03',
      expect.objectContaining({
        operationalStatus: 'ENTREGUE',
        sourceOverride: 'PROJECT',
      }),
      {
        updatedBy: 'analista@empresa.com',
        merge: true,
      },
    );
    expect(showToast).toHaveBeenCalledWith('Acompanhamento de entrega atualizado.', 'success');
  });

  it('registers manual work event using shared erosion service', async () => {
    saveErosionManualFollowupEventMock.mockResolvedValue({
      manualEvent: { tipoEvento: 'obra' },
      nextStatus: 'Monitoramento',
    });

    const erosion = {
      id: 'ER-10',
      projetoId: 'P1',
      torreRef: '12',
      acompanhamentosResumo: [],
    };

    await act(async () => {
      root.render(
        <FollowupsView
          reportRows={[]}
          workRows={[{
            erosionId: 'ER-10',
            projectId: 'P1',
            projectName: 'Projeto 1',
            towerRef: '12',
            stage: 'Projeto',
            description: 'Levantamento inicial',
            timestamp: '2026-03-01T09:00:00.000Z',
          }]}
          erosions={[erosion]}
          inspections={[{ id: 'V1' }]}
          projects={[{ id: 'P1', nome: 'Projeto 1' }]}
          invalidOverrides={[]}
          userActor="analista@empresa.com"
          showToast={showToast}
        />,
      );
      await Promise.resolve();
    });

    const registerButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Registrar evento'));
    expect(registerButton).toBeTruthy();

    await act(async () => {
      registerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const formHeading = [...container.querySelectorAll('h4')]
      .find((node) => node.textContent.includes('Novo evento de obra - ER-10'));
    const form = formHeading?.parentElement;
    expect(form).toBeTruthy();

    const stageSelect = form.querySelector('select');
    const descriptionField = form.querySelector('textarea');
    expect(stageSelect).toBeTruthy();
    expect(descriptionField).toBeTruthy();

    await act(async () => {
      setNativeValue(stageSelect, 'Em andamento');
      stageSelect.dispatchEvent(new Event('change', { bubbles: true }));
      setNativeValue(descriptionField, 'Equipe mobilizada no talude');
      descriptionField.dispatchEvent(new Event('input', { bubbles: true }));
      descriptionField.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const saveButton = [...form.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Salvar evento'));
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(saveErosionManualFollowupEventMock).toHaveBeenCalledWith(
      erosion,
      {
        tipoEvento: 'obra',
        obraEtapa: 'Em andamento',
        descricao: 'Equipe mobilizada no talude',
      },
      {
        updatedBy: 'analista@empresa.com',
        inspections: [{ id: 'V1' }],
      },
    );
    expect(showToast).toHaveBeenCalledWith('Evento de obra registrado.', 'success');
  });
});

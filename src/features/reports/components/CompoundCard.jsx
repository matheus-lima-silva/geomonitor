import { useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Select } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import ArchivedDeliveriesPanel from './ArchivedDeliveriesPanel';
import DeliveryCallout from './DeliveryCallout';
import {
  buildCompoundWorkspaceOrder,
  fmt,
  getTranslatedStatus,
  isPendingExecutionStatus,
  getStatusLabel,
  tone,
} from '../utils/reportUtils';

// Card que representa UM relatorio na lista. Extraido de CompoundsTab.jsx para
// reduzir o arquivo gigante e facilitar testes.
// Diferencas chave vs. implementacao anterior:
//   - Acoes do rodape reduzidas a 1 botao primary ("Gerar Relatorio").
//   - Preflight roda automaticamente dentro do modal de confirmacao.
//   - Toggle opcional de coordenadas dentro do modal (substitui "Gerar com coordenadas").
//   - Quando outputDocxMediaId existe, mostra DeliveryCallout no lugar da barra de acoes.
//   - Botao "Abrir / Editar" acima da lista abre o wizard em modo edit.
export default function CompoundCard({
  compound,
  workspaceLabelsById,
  compoundPreflights,
  busy,
  onTrash,
  onGenerate,
  onOpenEdit,
  onDownloadDocx,
  onUploadDelivery,
  compoundDownloadFileName,
  archiveRefreshToken = 0,
  showToast = () => {},
}) {
  const [confirmGenerate, setConfirmGenerate] = useState(null);
  const [genWithCoords, setGenWithCoords] = useState(
    !!compound?.sharedTextsJson?.includeTowerCoordinates,
  );
  const [genCoordFormat, setGenCoordFormat] = useState(
    compound?.sharedTextsJson?.towerCoordinateFormat || 'decimal',
  );

  function openGenerateModal() {
    setGenWithCoords(!!compound?.sharedTextsJson?.includeTowerCoordinates);
    setGenCoordFormat(compound?.sharedTextsJson?.towerCoordinateFormat || 'decimal');
    setConfirmGenerate(true);
  }

  const hasDocx = Boolean(compound.outputDocxMediaId);
  const shared = compound.sharedTextsJson || {};
  const elab = Array.isArray(shared.elaboradores) ? shared.elaboradores : [];
  const rev = Array.isArray(shared.revisores) ? shared.revisores : [];
  const preflight = compoundPreflights?.[compound.id] || null;
  const warnings = Array.isArray(preflight?.warnings) ? preflight.warnings : [];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="text-slate-800">{compound.nome || compound.id}</strong>
          <p className="mt-1 mb-0 text-xs text-slate-500">
            {Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0} workspace(s)
            {' • '}Atualizado: {fmt(compound.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone(compound.status)}`}>
            {getTranslatedStatus(compound.status)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenEdit?.(compound)}
            data-testid={`compound-edit-${compound.id}`}
          >
            <AppIcon name="edit" size={14} /> Abrir / Editar
          </Button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Mover para lixeira"
            onClick={() => onTrash?.(compound)}
            disabled={busy === `compound-trash:${compound.id}`}
          >
            <AppIcon name="trash-2" size={14} />
          </button>
        </div>
      </div>

      {/* Workspace tags */}
      {(Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0) === 0 ? (
        <div>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
            Sem workspaces vinculados
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {buildCompoundWorkspaceOrder(compound).map((wsId) => (
            <span key={wsId} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {workspaceLabelsById.get(wsId) || wsId}
            </span>
          ))}
        </div>
      )}

      {/* Assinaturas (read-only aqui; edicao via wizard) */}
      {elab.length > 0 || rev.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
          {elab.length > 0 ? (
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                Elaboradores
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {elab.map((snap, i) => (
                  <div key={`elab-${i}`} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="font-medium">{snap.nome}</span>
                    {snap.profissao ? <span className="text-xs text-slate-500">{snap.profissao}</span> : null}
                    {snap.registro ? <span className="text-xs text-slate-400">{snap.registro}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {rev.length > 0 ? (
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                Revisores
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {rev.map((snap, i) => (
                  <div key={`rev-${i}`} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="font-medium">{snap.nome}</span>
                    {snap.profissao ? <span className="text-xs text-slate-500">{snap.profissao}</span> : null}
                    {snap.registro ? <span className="text-xs text-slate-400">{snap.registro}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Progresso de execucao */}
      {isPendingExecutionStatus(compound.status) ? (
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <AppIcon name="loader" size={12} className="animate-spin" />
            {getStatusLabel(compound.status)}
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full animate-pulse w-full" />
          </div>
        </div>
      ) : null}

      {/* Erro */}
      {compound.lastError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {compound.lastError}
        </div>
      ) : null}

      {/* Warnings do preflight (se houver, aparecem inline) */}
      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex flex-col gap-1">
          <span className="font-semibold">Avisos do preflight:</span>
          {warnings.map((w) => (
            <span key={w}>• {w}</span>
          ))}
        </div>
      ) : null}

      {/* CTA pos-geracao vs. barra de acoes */}
      {hasDocx ? (
        <>
          <DeliveryCallout
            compound={compound}
            compoundDownloadFileName={compoundDownloadFileName}
            onDownloadDocx={onDownloadDocx}
            onUploadDelivery={onUploadDelivery}
            onRegenerate={() => openGenerateModal()}
            busy={busy}
            refreshToken={archiveRefreshToken}
            showToast={showToast}
          />
          <ArchivedDeliveriesPanel
            compoundId={compound.id}
            compoundName={compound.nome}
            refreshToken={archiveRefreshToken}
            showToast={showToast}
          />
        </>
      ) : (
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button
            onClick={openGenerateModal}
            disabled={busy === `compound-generate:${compound.id}`}
            data-testid={`compound-generate-${compound.id}`}
          >
            <AppIcon name="file-text" />
            {busy === `compound-generate:${compound.id}` ? 'Enfileirando...' : 'Gerar Relatório'}
          </Button>
        </div>
      )}

      {/* Modal de confirmacao de geracao (com toggle de coords) */}
      <Modal
        open={Boolean(confirmGenerate)}
        onClose={() => setConfirmGenerate(null)}
        title="Gerar relatório"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setConfirmGenerate(null)}>
              <AppIcon name="close" /> Cancelar
            </Button>
            <Button
              onClick={() => {
                onGenerate?.(compound, {
                  ensureTowerCoordinates: !!genWithCoords,
                  towerCoordinateFormat: genCoordFormat || 'decimal',
                });
                setConfirmGenerate(null);
              }}
              disabled={busy === `compound-generate:${compound.id}`}
            >
              <AppIcon name="file-text" /> Confirmar
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-slate-700">
            Deseja enfileirar a geração do relatório{' '}
            <strong>{compound.nome || compound.id}</strong>? O documento será processado em
            segundo plano.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={genWithCoords}
              onChange={(event) => setGenWithCoords(event.target.checked)}
            />
            Incluir coordenadas das torres antes de cada grupo de fotos
          </label>
          {genWithCoords ? (
            <Select
              id="compound-gen-coord-format"
              label="Formato da coordenada"
              value={genCoordFormat}
              onChange={(event) => setGenCoordFormat(event.target.value)}
            >
              <option value="decimal">Decimal</option>
              <option value="dms">Sexagesimal / GMS</option>
              <option value="utm">UTM</option>
            </Select>
          ) : null}
        </div>
      </Modal>
    </article>
  );
}

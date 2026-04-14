/**
 * Estado persistido da importacao em lote de fotos por workspace.
 *
 * Uso: ao importar 775 fotos via "Importar Subpastas por Torre", se o processo
 * falhar parcialmente, o usuario pode re-selecionar a mesma pasta e o sistema
 * pula as fotos ja enviadas. Evita duplicatas no backend em caso de erro parcial.
 *
 * Nao usa hash criptografico — o fingerprint por (webkitRelativePath + size) eh
 * invariante para re-selecao da mesma pasta e suficiente neste contexto.
 */

const STORAGE_KEY_PREFIX = 'report_workspace_import:';

function storageKey(workspaceId) {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * Gera fingerprint estavel para um File.
 * Combina o caminho relativo (ou nome) com o tamanho em bytes.
 */
export function fingerprintFile(file) {
  if (!file) return '';
  const path = String(file.webkitRelativePath || file.name || '').trim();
  const size = Number.isFinite(file.size) ? file.size : 0;
  return `${path}::${size}`;
}

/**
 * Le o estado persistido da importacao de um workspace.
 * Retorna null se nao houver registro ou o JSON for invalido.
 */
export function readImportState(workspaceId) {
  const storage = safeStorage();
  const key = String(workspaceId || '').trim();
  if (!storage || !key) return null;

  try {
    const raw = storage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      completedFingerprints: Array.isArray(parsed.completedFingerprints) ? parsed.completedFingerprints : [],
      failedFingerprints: Array.isArray(parsed.failedFingerprints) ? parsed.failedFingerprints : [],
      updatedAt: String(parsed.updatedAt || ''),
    };
  } catch {
    return null;
  }
}

/**
 * Escreve o estado persistido de importacao de um workspace.
 */
export function writeImportState(workspaceId, state) {
  const storage = safeStorage();
  const key = String(workspaceId || '').trim();
  if (!storage || !key) return;

  const payload = {
    completedFingerprints: Array.isArray(state?.completedFingerprints) ? state.completedFingerprints : [],
    failedFingerprints: Array.isArray(state?.failedFingerprints) ? state.failedFingerprints : [],
    updatedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(storageKey(key), JSON.stringify(payload));
  } catch {
    // Disco cheio ou modo privado — tolerar silenciosamente. O pior caso
    // eh re-subir fotos no proximo clique, que o usuario ja sabe tratar.
  }
}

/**
 * Remove o registro de importacao de um workspace. Chamar ao concluir com sucesso
 * total (zero falhas) para nao deixar lixo no localStorage.
 */
export function clearImportState(workspaceId) {
  const storage = safeStorage();
  const key = String(workspaceId || '').trim();
  if (!storage || !key) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    // idem
  }
}

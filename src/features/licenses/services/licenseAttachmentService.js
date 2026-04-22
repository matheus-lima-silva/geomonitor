import { API_BASE_URL, getAuthToken } from '../../../utils/serviceFactory';
import {
  createMediaUpload,
  uploadMediaBinary,
  completeMediaUpload,
  downloadMediaAsset,
} from '../../../services/mediaService';
import { computeFileSha256 } from '../../../services/reportArchiveService';
import { triggerBlobDownload } from '../../reports/utils/reportUtils';

// Service de anexos de LO (2 slots fixos: documentoLO, planoGerenciamento).
// Camada fina que orquestra o fluxo de upload em 4 passos e expoe list/delete/
// download usando os helpers existentes em mediaService/reportArchiveService/
// reportUtils — nao reimplementa plumbing nenhum.

export const LICENSE_ATTACHMENT_SLOTS = ['documentoLO', 'planoGerenciamento'];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const PDF_MIME = 'application/pdf';

async function request(url, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data?.message || 'Erro na API de anexos da LO.');
    err.status = response.status;
    err.code = data?.code;
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listAttachments(licenseId) {
  const id = String(licenseId || '').trim();
  if (!id) return [];
  const res = await request(`${API_BASE_URL}/licenses/${encodeURIComponent(id)}/attachments`, {
    method: 'GET',
  });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function deleteAttachment(licenseId, slot) {
  const id = String(licenseId || '').trim();
  const s = String(slot || '').trim();
  if (!id || !s) throw new Error('licenseId e slot obrigatorios.');
  await request(`${API_BASE_URL}/licenses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(s)}`, {
    method: 'DELETE',
  });
}

async function attachToSlot(licenseId, slot, mediaAssetId) {
  const res = await request(`${API_BASE_URL}/licenses/${encodeURIComponent(licenseId)}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ data: { slot, mediaAssetId } }),
  });
  return res?.data || null;
}

/**
 * Orquestra o fluxo completo de upload de um PDF para um slot da LO.
 * 1. cria media + pega signed upload URL
 * 2. PUT do binario
 * 3. marca como ready
 * 4. vincula o mediaAssetId ao slot da LO
 */
export async function uploadAttachment(licenseId, slot, file) {
  if (!licenseId) throw new Error('licenseId obrigatorio.');
  if (!LICENSE_ATTACHMENT_SLOTS.includes(slot)) {
    throw new Error(`Slot invalido: ${slot}.`);
  }
  if (!file) throw new Error('Arquivo nao selecionado.');
  if (file.type !== PDF_MIME) {
    const err = new Error('Apenas PDF e aceito.');
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }
  if (file.size > MAX_SIZE_BYTES) {
    const err = new Error('Arquivo excede 50 MB.');
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }

  const created = await createMediaUpload({
    fileName: file.name,
    contentType: PDF_MIME,
    sizeBytes: file.size,
    purpose: 'license_document',
    linkedResourceType: 'operating_license',
    linkedResourceId: licenseId,
  });
  const mediaId = created?.data?.id;
  const uploadDescriptor = created?.data?.upload;
  if (!mediaId || !uploadDescriptor) {
    throw new Error('Falha ao preparar upload da media.');
  }

  await uploadMediaBinary(uploadDescriptor, file);

  const sha256 = await computeFileSha256(file);
  await completeMediaUpload({
    id: mediaId,
    sha256,
    storedSizeBytes: file.size,
  });

  return attachToSlot(licenseId, slot, mediaId);
}

export async function downloadAttachment(mediaAssetId, fileName) {
  if (!mediaAssetId) throw new Error('mediaAssetId obrigatorio.');
  const { blob } = await downloadMediaAsset(mediaAssetId);
  triggerBlobDownload(fileName || 'documento.pdf', blob);
}

// Hook headless de upload de midia: encapsula o fluxo em 3 passos do
// mediaService (createMediaUpload -> uploadMediaBinary -> completeMediaUpload
// com sha256), mesmo encadeamento ja usado por licenseAttachmentService e
// DeliveryUploadModal — nao reimplementa plumbing nenhum, so o orquestra numa
// forma reutilizavel por componente (upload multiplo, estado de progresso).

import { useCallback, useRef, useState } from 'react';
import {
  completeMediaUpload,
  createMediaUpload,
  uploadMediaBinary,
} from '@app/services/mediaService';
import { computeFileSha256 } from '@app/services/reportArchiveService';

// Mesma whitelist de imagem do backend (backend/utils/uploadValidation.js).
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

export function useMediaUpload({ purpose, linkedResourceType }) {
  const [uploading, setUploading] = useState(false);
  const pendingRef = useRef(0);

  const uploadFile = useCallback(async (file, { linkedResourceId } = {}) => {
    if (!file) throw new Error('Arquivo não selecionado.');
    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      throw new Error('Formato não aceito — envie JPEG, PNG, WEBP ou HEIC.');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error('Arquivo excede 50 MB.');
    }

    pendingRef.current += 1;
    setUploading(true);
    try {
      const created = await createMediaUpload({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        purpose,
        linkedResourceType,
        linkedResourceId,
      });
      const mediaId = created?.data?.id;
      const uploadDescriptor = created?.data?.upload;
      if (!mediaId || !uploadDescriptor) {
        throw new Error('Falha ao preparar o upload da imagem.');
      }

      await uploadMediaBinary(uploadDescriptor, file);

      const sha256 = await computeFileSha256(file);
      await completeMediaUpload({ id: mediaId, sha256, storedSizeBytes: file.size });

      return mediaId;
    } finally {
      pendingRef.current -= 1;
      if (pendingRef.current <= 0) setUploading(false);
    }
  }, [purpose, linkedResourceType]);

  return { uploadFile, uploading };
}

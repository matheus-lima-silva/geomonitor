const { z } = require('zod');

// Payload da sub-action POST /api/report-compounds/:id/deliver.
// Cria o snapshot + entry em report_archives. Nao recebe arquivo aqui —
// upload do PDF/DOCX final e feito em duas etapas subsequentes:
//  (1) POST /api/media/upload-url (padrao existente)
//  (2) POST /api/report-archives/:id/attach-delivered
const deliverCompoundSchema = z.object({
    data: z.object({
        notes: z.string().optional(),
    }).passthrough().optional().default({}),
    meta: z.object({ updatedBy: z.string().optional() }).passthrough().optional(),
});

// Payload de POST /api/report-archives/:id/attach-delivered.
// Informa o media_asset que ja foi carregado via signed URL + sha256 do
// arquivo para verificacao de integridade.
const attachDeliveredSchema = z.object({
    data: z.object({
        mediaId: z.string().trim().min(1, 'mediaId obrigatorio.'),
        sha256: z.string().trim().min(1, 'sha256 obrigatorio.'),
        notes: z.string().optional(),
    }).passthrough(),
    meta: z.object({ updatedBy: z.string().optional() }).passthrough().optional(),
});

module.exports = {
    deliverCompoundSchema,
    attachDeliveredSchema,
};

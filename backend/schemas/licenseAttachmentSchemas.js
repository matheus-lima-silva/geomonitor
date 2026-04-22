const { z } = require('zod');

const LICENSE_ATTACHMENT_SLOTS = ['documentoLO', 'planoGerenciamento'];

const attachmentBodySchema = z.object({
    slot: z.enum(LICENSE_ATTACHMENT_SLOTS),
    mediaAssetId: z.string().trim().min(1, 'mediaAssetId e obrigatorio.'),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const licenseAttachmentAttachSchema = z.object({
    data: attachmentBodySchema,
    meta: metaSchema,
});

module.exports = {
    LICENSE_ATTACHMENT_SLOTS,
    licenseAttachmentAttachSchema,
};

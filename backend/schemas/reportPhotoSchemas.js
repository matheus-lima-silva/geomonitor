const { z } = require('zod');

const metaSchema = z.object({
    updatedBy: z.string().trim().optional(),
}).passthrough().optional();

// POST /report-workspaces/:id/photos/:photoId/crop-footer
// Corta `pixels` absolutos OU `percent` (fracao 0..0.4) da altura. Calibracao
// das fotos do Timestamp Camera (1920x1080): 45 px = ultima linha da marca.
const cropFooterSchema = z.object({
    data: z.object({
        pixels: z.coerce.number().int().min(1).max(400).optional(),
        percent: z.coerce.number().gt(0).max(0.4).optional(),
    }).refine((value) => value.pixels !== undefined || value.percent !== undefined, {
        message: 'Informe pixels (1..400) ou percent (0..0.4).',
        path: ['pixels'],
    }),
    meta: metaSchema,
});

// POST /report-workspaces/:id/photos/:photoId/crop-footer/undo
const cropUndoSchema = z.object({
    data: z.object({}).passthrough().optional(),
    meta: metaSchema,
}).passthrough();

// POST /report-workspaces/:id/photos/crop-footer-batch
const cropFooterBatchSchema = z.object({
    data: z.object({
        photoIds: z.array(z.string().trim().min(1)).min(1).max(200),
        pixels: z.coerce.number().int().min(1).max(400).optional(),
        percent: z.coerce.number().gt(0).max(0.4).optional(),
        skipCropped: z.boolean().optional(),
    }).refine((value) => value.pixels !== undefined || value.percent !== undefined, {
        message: 'Informe pixels (1..400) ou percent (0..0.4).',
        path: ['pixels'],
    }),
    meta: metaSchema,
});

// POST /report-workspaces/:id/photos/purge-crop-backups
const purgeCropBackupsSchema = z.object({
    data: z.object({
        days: z.coerce.number().int().min(0).max(3650).optional(),
    }).passthrough().optional(),
    meta: metaSchema,
}).passthrough();

module.exports = {
    cropFooterSchema,
    cropFooterBatchSchema,
    cropUndoSchema,
    purgeCropBackupsSchema,
};

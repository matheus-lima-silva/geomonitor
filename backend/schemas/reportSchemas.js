const { z } = require('zod');

const slotSchema = z.object({
    id: z.string().trim().optional(),
    label: z.string().trim().optional(),
    projectId: z.string().trim().optional(),
    assetCount: z.coerce.number().int().nonnegative().optional(),
}).passthrough();

const preflightDataSchema = z.object({
    workspaceId: z.string().trim().optional(),
    slots: z.array(slotSchema).optional().default([]),
}).passthrough();

const generateDataSchema = z.object({
    id: z.string().trim().optional(),
    workspaceId: z.string().trim().min(1, 'workspaceId e obrigatorio.'),
    nome: z.string().trim().optional(),
    slots: z.array(slotSchema).optional().default([]),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const reportPreflightSchema = z.object({
    data: preflightDataSchema,
    meta: metaSchema,
});

const reportGenerateSchema = z.object({
    data: generateDataSchema,
    meta: metaSchema,
});

module.exports = {
    reportPreflightSchema,
    reportGenerateSchema,
};

const { z } = require('zod');

// Cobre apenas os endpoints de create/update de workspace. Endpoints de fotos,
// organize, reorder, kmz etc. mantem validacao manual — sao muito especificos
// e mudam constantemente. Prioridade foi fechar mass assignment no nivel raiz
// do workspace.

const slotSchema = z.object({
    id: z.string().trim().optional(),
    label: z.string().trim().optional(),
    projectId: z.string().trim().optional(),
    status: z.string().trim().optional(),
    assetCount: z.coerce.number().int().nonnegative().optional(),
}).passthrough();

const workspaceDataSchema = z.object({
    id: z.string().trim().optional(),
    nome: z.string().trim().optional(),
    descricao: z.string().optional(),
    projectId: z.string().trim().optional(),
    status: z.string().trim().optional(),
    slots: z.array(slotSchema).optional(),
    draftState: z.record(z.string(), z.any()).optional(),
    photoSortMode: z.string().optional(),
    importedAt: z.string().optional(),
    lastGeneratedAt: z.string().optional(),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const workspaceCreateSchema = z.object({
    data: workspaceDataSchema,
    meta: metaSchema,
});

const workspaceUpdateSchema = z.object({
    data: workspaceDataSchema,
    meta: metaSchema,
});

module.exports = {
    workspaceCreateSchema,
    workspaceUpdateSchema,
};

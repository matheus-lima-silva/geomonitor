const { z } = require('zod');

const INSPECTION_STATUS = ['aberta', 'concluida', 'cancelada', 'em_andamento'];

const detalheDiaSchema = z.object({
    data: z.string().optional(),
    observacoes: z.string().optional(),
}).passthrough();

const inspectionDataSchema = z.object({
    id: z.string().trim().optional(), // opcional no create (generateId produz um)
    projetoId: z.string().trim().min(1, 'projetoId e obrigatorio.'),
    dataInicio: z.string().trim().min(1, 'dataInicio e obrigatoria.'),
    dataFim: z.string().trim().optional(),
    status: z.enum(INSPECTION_STATUS).optional().default('aberta'),
    detalhesDias: z.array(detalheDiaSchema).optional().default([]),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const inspectionCreateSchema = z.object({
    data: inspectionDataSchema,
    meta: metaSchema,
});

const inspectionUpdateSchema = z.object({
    data: inspectionDataSchema.partial().extend({
        projetoId: z.string().trim().min(1).optional(),
    }),
    meta: metaSchema,
});

module.exports = {
    inspectionCreateSchema,
    inspectionUpdateSchema,
};

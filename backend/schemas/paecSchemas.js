const { z } = require('zod');

// Schemas do modulo PAEC. Envelope padrao { data, meta } (backend/CLAUDE.md).
// O catalogo de campos vive no manifest do template (gerado pelo tokenizer);
// aqui validamos apenas a FORMA — chaves de campo sao TEXT livre para que uma
// revisao nova do modelo nao exija deploy.

const metaSchema = z.object({
    updatedBy: z.string().optional(),
}).optional();

const PLANT_TYPES = ['UHE', 'PCH', 'CGH', 'Subestacao'];

const savePaecPlantSchema = z.object({
    data: z.object({
        name: z.string().trim().min(1, 'Nome da usina e obrigatorio'),
        projectId: z.string().trim().optional().nullable(),
        plantType: z.enum(PLANT_TYPES).optional().nullable(),
        installedCapacityMw: z.coerce.number().min(0).optional().nullable(),
        version: z.coerce.number().int().optional(),
        copyFromId: z.string().trim().optional(),
        fields: z.record(z.string(), z.string()).optional().default({}),
        // Blocos tabulares (Fase 2): { listKey: [ {colKey: valor, ...}, ... ] }
        // conforme manifest.blocks[].columns. Linha replace-on-save integral.
        listItems: z.record(z.string(), z.array(z.record(z.string(), z.string())))
            .optional()
            .default({}),
    }),
    meta: metaSchema,
});

// Manifest gerado por worker/tools/paec_tokenizer.py — validacao estrutural
// minima (o conteudo detalhado e contrato do tokenizer, nao da API).
const manifestSchema = z.object({
    templateName: z.string().optional(),
    revisionLabel: z.string().optional(),
    fields: z.array(z.object({
        key: z.string().min(1),
        label: z.string(),
        section: z.string().nullable().optional(),
        type: z.string(),
        required: z.boolean().optional(),
        sampleValue: z.string().optional(),
        occurrences: z.array(z.object({}).passthrough()).optional(),
    }).passthrough()),
    blocks: z.array(z.object({ key: z.string().min(1) }).passthrough()).default([]),
    sections: z.array(z.object({}).passthrough()).default([]),
    imageSlots: z.array(z.object({}).passthrough()).default([]),
}).passthrough();

const registerPaecTemplateSchema = z.object({
    data: z.object({
        name: z.string().trim().default('PAEC AXIA'),
        revisionLabel: z.string().trim().min(1, 'Revisao e obrigatoria'),
        tokenizedDocxMediaId: z.string().trim().min(1, 'Media do template tokenizado e obrigatoria'),
        sourceDocxMediaId: z.string().trim().optional().nullable(),
        manifest: manifestSchema,
    }),
    meta: metaSchema,
});

module.exports = {
    PLANT_TYPES,
    savePaecPlantSchema,
    registerPaecTemplateSchema,
};

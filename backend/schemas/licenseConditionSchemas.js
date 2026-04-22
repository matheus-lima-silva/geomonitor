const { z } = require('zod');

const CONDITION_TIPO_OPTIONS = [
    'processos_erosivos',
    'prad',
    'supressao',
    'fauna',
    'emergencia',
    'comunicacao',
    'compensacao',
    'geral',
    'outro',
];

const PERIODICITY_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'];

const conditionBaseSchema = z.object({
    id: z.string().trim().optional(),
    licenseId: z.string().trim().min(1).optional(), // injetado do path em rota nested
    numero: z.string().trim().min(1, 'numero e obrigatorio.'),
    titulo: z.string().trim().optional().default(''),
    texto: z.string().trim().min(1, 'texto e obrigatorio.'),
    tipo: z.enum(CONDITION_TIPO_OPTIONS).optional().default('geral'),
    prazo: z.string().trim().optional().default(''),
    periodicidadeRelatorio: z.union([z.enum(PERIODICITY_OPTIONS), z.literal('')]).optional().default(''),
    mesesEntrega: z.array(z.coerce.number().int().min(1).max(12)).optional().default([]),
    ordem: z.coerce.number().int().optional().default(0),
    parecerTecnicoRef: z.string().trim().optional().default(''),
    payload: z.record(z.any()).optional().default({}),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const licenseConditionCreateSchema = z.object({
    data: conditionBaseSchema,
    meta: metaSchema,
});

const licenseConditionUpdateSchema = z.object({
    data: conditionBaseSchema.partial().extend({
        numero: z.string().trim().min(1).optional(),
        texto: z.string().trim().min(1).optional(),
    }),
    meta: metaSchema,
});

const licenseConditionBulkReplaceSchema = z.object({
    data: z.array(conditionBaseSchema).max(200),
    meta: metaSchema,
});

module.exports = {
    CONDITION_TIPO_OPTIONS,
    PERIODICITY_OPTIONS,
    licenseConditionCreateSchema,
    licenseConditionUpdateSchema,
    licenseConditionBulkReplaceSchema,
};

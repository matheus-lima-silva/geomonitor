const { z } = require('zod');

// Config global do Relatorio Mensal (singleton por usuario): equipe + contrato.

const teamMemberSchema = z.object({
    id: z.string().trim().optional(),
    name: z.string().trim().max(200).optional().default(''),
});

const contratoSchema = z.object({
    numero: z.string().trim().max(100).optional().default(''),
    objeto: z.string().trim().max(500).optional().default(''),
    contratante: z.string().trim().max(300).optional().default(''),
    contratada: z.string().trim().max(300).optional().default(''),
});

const settingsDataSchema = z.object({
    team: z.array(teamMemberSchema).optional().default([]),
    contrato: contratoSchema.optional().default({}),
});

const metaSchema = z.object({ updatedBy: z.string().optional() }).optional();

const saveMonthlyReportSettingsSchema = z.object({
    data: settingsDataSchema,
    meta: metaSchema,
});

module.exports = {
    saveMonthlyReportSettingsSchema,
};

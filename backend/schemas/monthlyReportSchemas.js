const { z } = require('zod');

// Categorias de atividade — mesmas chaves do design handoff (estado.js).
const CATEGORY_VALUES = ['vistoria', 'doc', 'relatorio', 'geo', 'reuniao', 'outro'];
const QUADRO_STYLES = ['preenchido', 'marcador', 'barra'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const activitySchema = z
    .object({
        id: z.string().trim().optional(),
        category: z.enum(CATEGORY_VALUES),
        description: z.string().trim().min(1, 'Descricao da atividade e obrigatoria.'),
        startDate: z.string().regex(ISO_DATE, 'startDate deve ser YYYY-MM-DD.'),
        endDate: z.string().regex(ISO_DATE, 'endDate deve ser YYYY-MM-DD.'),
    })
    .refine((a) => a.endDate >= a.startDate, {
        message: 'endDate deve ser maior ou igual a startDate.',
        path: ['endDate'],
    });

const projectSchema = z.object({
    id: z.string().trim().optional(),
    name: z.string().trim().max(300).optional().default(''),
    description: z.string().optional().default(''),
    sortOrder: z.coerce.number().int().optional(),
});

const engineerSchema = z.object({
    id: z.string().trim().optional(),
    name: z.string().trim().max(200).optional().default(''),
    sortOrder: z.coerce.number().int().optional(),
    activities: z.array(activitySchema).optional().default([]),
    projects: z.array(projectSchema).optional().default([]),
});

const holidaySchema = z.object({
    date: z.string().regex(ISO_DATE),
    name: z.string().trim().optional().default(''),
});

const monthlyReportDataSchema = z.object({
    refYear: z.coerce.number().int().min(2000).max(2100),
    refMonth: z.coerce.number().int().min(0).max(11),
    authorName: z.string().trim().optional().default(''),
    status: z.enum(['draft', 'final']).optional().default('draft'),
    version: z.coerce.number().int().optional(),
    intro: z.string().optional().default(''),
    conclusao: z.string().optional().default(''),
    quadroStyle: z.enum(QUADRO_STYLES).optional().default('marcador'),
    holidays: z.array(holidaySchema).optional().default([]),
    engineers: z.array(engineerSchema).optional().default([]),
});

const metaSchema = z.object({ updatedBy: z.string().optional() }).optional();

// Envelope { data, meta } — mesma convencao dos demais routers.
const saveMonthlyReportSchema = z.object({
    data: monthlyReportDataSchema,
    meta: metaSchema,
});

const byPeriodQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(0).max(11),
});

module.exports = {
    CATEGORY_VALUES,
    QUADRO_STYLES,
    saveMonthlyReportSchema,
    byPeriodQuerySchema,
};

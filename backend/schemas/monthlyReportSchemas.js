const { z } = require('zod');

// Categorias de atividade — mesmas chaves do prototipo (relatorio_mensal.html).
const CATEGORY_VALUES = ['vistoria', 'doc', 'relatorio', 'geo', 'reuniao', 'outro'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const projectSchema = z.object({
    id: z.string().trim().optional(),
    linkedProjectId: z.string().trim().nullish(),
    name: z.string().trim().max(300).optional().default(''),
    description: z.string().optional().default(''),
    collapsed: z.boolean().optional().default(false),
    sortOrder: z.coerce.number().int().optional(),
});

const activitySchema = z
    .object({
        id: z.string().trim().optional(),
        projectId: z.string().trim().nullish(),
        category: z.enum(CATEGORY_VALUES),
        description: z.string().trim().min(1, 'Descricao da atividade e obrigatoria.'),
        startDate: z.string().regex(ISO_DATE, 'startDate deve ser YYYY-MM-DD.'),
        endDate: z.string().regex(ISO_DATE, 'endDate deve ser YYYY-MM-DD.'),
    })
    .refine((a) => a.endDate >= a.startDate, {
        message: 'endDate deve ser maior ou igual a startDate.',
        path: ['endDate'],
    });

const holidayOverrideSchema = z.object({
    date: z.string().regex(ISO_DATE),
    name: z.string().trim().optional().default(''),
});

const monthlyReportDataSchema = z.object({
    refYear: z.coerce.number().int().min(2000).max(2100),
    refMonth: z.coerce.number().int().min(0).max(11),
    authorName: z.string().trim().optional().default(''),
    status: z.enum(['draft', 'final']).optional().default('draft'),
    version: z.coerce.number().int().optional(),
    projects: z.array(projectSchema).optional().default([]),
    activities: z.array(activitySchema).optional().default([]),
    holidayOverrides: z.array(holidayOverrideSchema).optional().default([]),
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
    saveMonthlyReportSchema,
    byPeriodQuerySchema,
};

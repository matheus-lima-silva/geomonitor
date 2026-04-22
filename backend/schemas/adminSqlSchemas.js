const { z } = require('zod');

const sqlExecuteDataSchema = z.object({
    sql: z.string().min(1, 'SQL e obrigatorio.').max(5000, 'SQL muito longo (max 5000 chars).'),
}).strict();

const sqlExecuteSchema = z.object({
    data: sqlExecuteDataSchema,
}).passthrough();

const snippetNameSchema = z.string().trim().min(1, 'Nome e obrigatorio.').max(100, 'Nome muito longo (max 100).');
const snippetTextSchema = z.string().trim().min(1, 'SQL e obrigatorio.').max(5000, 'SQL muito longo (max 5000 chars).');
const snippetDescriptionSchema = z.string().trim().max(500, 'Descricao muito longa (max 500).').nullable().optional();

const sqlSnippetCreateSchema = z.object({
    data: z.object({
        name: snippetNameSchema,
        sqlText: snippetTextSchema,
        description: snippetDescriptionSchema,
    }).strict(),
}).passthrough();

const sqlSnippetUpdateSchema = z.object({
    data: z.object({
        name: snippetNameSchema.optional(),
        sqlText: snippetTextSchema.optional(),
        description: snippetDescriptionSchema,
    }).strict(),
}).passthrough();

module.exports = {
    sqlExecuteSchema,
    sqlSnippetCreateSchema,
    sqlSnippetUpdateSchema,
};

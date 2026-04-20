const { z } = require('zod');

const sqlExecuteDataSchema = z.object({
    sql: z.string().min(1, 'SQL e obrigatorio.').max(5000, 'SQL muito longo (max 5000 chars).'),
}).strict();

const sqlExecuteSchema = z.object({
    data: sqlExecuteDataSchema,
}).passthrough();

module.exports = {
    sqlExecuteSchema,
};

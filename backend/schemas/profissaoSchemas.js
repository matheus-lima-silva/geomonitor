const { z } = require('zod');

const profissaoCreateSchema = z.object({
    id: z.string().trim().min(1, 'id e obrigatorio.').max(64),
    nome: z.string().trim().min(1, 'nome e obrigatorio.').max(120),
}).strict();

module.exports = {
    profissaoCreateSchema,
};

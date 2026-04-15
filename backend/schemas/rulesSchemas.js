const { z } = require('zod');

// A config de regras tem uma arvore aninhada dinamica para pontos de criticidade
// (cada chave e uma faixa/classe com {descricao, pontos, tipos}). Nao vale a pena
// enumerar cada chave — o que importa e fechar o TOP LEVEL de `data` para nao
// aceitar campos arbitrarios (mass assignment). Internamente usamos passthrough.

const pontoEntrySchema = z.object({
    descricao: z.string().optional(),
    pontos: z.number().optional(),
    tipos: z.array(z.string()).optional(),
}).passthrough();

const pontoGroupSchema = z.record(z.string(), pontoEntrySchema);

const faixaSchema = z.object({
    codigo: z.string(),
    classe: z.string(),
    min: z.number(),
    max: z.number().or(z.literal(Infinity)),
}).passthrough();

const solucaoSchema = z.object({
    tipo_medida: z.string().optional(),
    solucoes: z.array(z.string()).optional(),
}).passthrough();

const criticalidadeSchema = z.object({
    pontos: z.record(z.string(), pontoGroupSchema).optional(),
    faixas: z.array(faixaSchema).optional(),
    solucoes_por_criticidade: z.record(z.string(), solucaoSchema).optional(),
}).passthrough();

// TOP LEVEL strict-ish: whitelist dos campos editaveis. Qualquer campo fora daqui
// e rejeitado pelo .strict() — previne mass assignment com campos tipo isAdmin.
const rulesDataSchema = z.object({
    criticalidade: criticalidadeSchema.optional(),
    // Alias legado usado por migracoes antigas; ainda aceito em leitura.
    criticalityV2: criticalidadeSchema.optional(),
    // Campos derivados / metadata que o backend pode aceitar persistir.
    faixas: z.array(faixaSchema).optional(),
    pontos: z.record(z.string(), pontoGroupSchema).optional(),
    solucoes_por_criticidade: z.record(z.string(), solucaoSchema).optional(),
    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
}).strict();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const rulesUpdateSchema = z.object({
    data: rulesDataSchema,
    meta: metaSchema,
});

module.exports = {
    rulesUpdateSchema,
};

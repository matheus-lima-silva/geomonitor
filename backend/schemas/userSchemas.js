const { z } = require('zod');

const PERFIL_OPTIONS = ['Administrador', 'Admin', 'Gerente', 'Editor', 'Utilizador', 'Visualizador'];
const STATUS_OPTIONS = ['Ativo', 'Pendente', 'Inativo', 'Bloqueado'];

const userDataSchema = z.object({
    id: z.string().trim().min(1, 'id do usuario e obrigatorio.'),
    nome: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    perfil: z.enum(PERFIL_OPTIONS).optional(),
    status: z.enum(STATUS_OPTIONS).optional(),
    telefone: z.string().trim().optional(),
    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
    createdAt: z.string().optional(),
}).passthrough();

// Update pode ter id vazio (vem do :id no path)
const userUpdateDataSchema = userDataSchema.partial().extend({
    id: z.string().trim().optional(),
});

const bootstrapDataSchema = z.object({
    nome: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    perfil: z.enum(PERFIL_OPTIONS).optional(),
    telefone: z.string().trim().optional(),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const userCreateSchema = z.object({
    data: userDataSchema,
    meta: metaSchema,
});

const userUpdateSchema = z.object({
    data: userUpdateDataSchema,
    meta: metaSchema,
});

const userBootstrapSchema = z.object({
    data: bootstrapDataSchema.optional().default({}),
    meta: metaSchema,
});

// Signatarios pessoais
const signatorySchema = z.object({
    nome: z.string().trim().min(1, 'nome e obrigatorio.'),
    profissao_id: z.string().trim().nullable().optional(),
    registro_conselho: z.string().optional().default(''),
    registro_estado: z.string().optional().default(''),
    registro_numero: z.string().optional().default(''),
    registro_sufixo: z.string().optional().default(''),
}).strict();

const signatoryUpdateSchema = signatorySchema.partial();

module.exports = {
    userCreateSchema,
    userUpdateSchema,
    userBootstrapSchema,
    signatorySchema,
    signatoryUpdateSchema,
    PERFIL_OPTIONS,
    STATUS_OPTIONS,
};

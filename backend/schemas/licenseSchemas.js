const { z } = require('zod');

const SPHERE_OPTIONS = ['Federal', 'Estadual'];
const STATUS_OPTIONS = ['ativa', 'inativa', 'vencida', 'suspensa'];
const PERIODICITY_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'];

const coberturaRowSchema = z.object({
    projetoId: z.string().trim().min(1),
    torres: z.array(z.string().trim()).optional().default([]),
    descricaoEscopo: z.string().trim().optional(),
}).passthrough();

const licenseDataSchema = z.object({
    id: z.string().trim().optional(),
    numero: z.string().trim().min(1, 'numero e obrigatorio.'),
    orgaoAmbiental: z.string().trim().min(1, 'orgaoAmbiental e obrigatorio.'),
    esfera: z.enum(SPHERE_OPTIONS).optional().default('Federal'),
    uf: z.string().trim().optional().default(''),
    descricao: z.string().optional().default(''),
    inicioVigencia: z.string().optional(),
    fimVigencia: z.string().optional(),
    status: z.enum(STATUS_OPTIONS).optional().default('ativa'),
    periodicidadeRelatorio: z.enum(PERIODICITY_OPTIONS).optional(),
    mesesEntregaRelatorio: z.array(z.coerce.number().int().min(1).max(12)).optional(),
    anoBaseBienal: z.coerce.string().optional().default(''),
    exigeAcompanhamentoErosivo: z.boolean().optional().default(true),
    cobertura: z.array(coberturaRowSchema).optional().default([]),
    observacoes: z.string().optional().default(''),
}).passthrough();

const metaSchema = z.object({ updatedBy: z.string().optional() }).passthrough().optional();

const licenseCreateSchema = z.object({
    data: licenseDataSchema,
    meta: metaSchema,
});

const licenseUpdateSchema = z.object({
    data: licenseDataSchema.partial().extend({
        numero: z.string().trim().min(1).optional(),
    }),
    meta: metaSchema,
});

module.exports = {
    licenseCreateSchema,
    licenseUpdateSchema,
};

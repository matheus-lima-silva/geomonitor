const { z } = require('zod');

// Os schemas abaixo validam apenas o envelope { data, meta } que o crudFactory
// espera. Campos opcionais e desconhecidos sao tolerados com .passthrough() pois
// o modelo evolui rapido e o backend ja normaliza via repositorio.

const PERIODICITY_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'];

const linhaCoordenadaSchema = z.object({
    latitude: z.coerce.string(),
    longitude: z.coerce.string(),
    altitude: z.coerce.string().optional(),
}).passthrough();

const torreCoordenadaSchema = z.object({
    id: z.coerce.string().optional(),
    latitude: z.coerce.number().or(z.string()).optional(),
    longitude: z.coerce.number().or(z.string()).optional(),
}).passthrough();

const projectDataSchema = z.object({
    id: z.string().trim().min(1, 'id do projeto e obrigatorio.'),
    nome: z.string().trim().min(1, 'nome e obrigatorio.'),
    tipo: z.string().trim().default('Linha de Transmissão').optional(),
    tensao: z.coerce.string().optional().default(''),
    extensao: z.coerce.string().optional().default(''),
    torres: z.coerce.string().optional().default(''),
    periodicidadeRelatorio: z.enum(PERIODICITY_OPTIONS).optional(),
    mesesEntregaRelatorio: z.array(z.coerce.number().int().min(1).max(12)).optional(),
    anoBaseBienal: z.coerce.string().optional().default(''),
    torresCoordenadas: z.array(torreCoordenadaSchema).optional(),
    linhaCoordenadas: z.array(linhaCoordenadaSchema).optional(),
    linhaFonteKml: z.string().optional().default(''),
    dataCadastro: z.string().optional(),
}).passthrough();

const projectUpdateDataSchema = projectDataSchema.partial().extend({
    id: z.string().trim().optional(),
});

const metaSchema = z.object({
    updatedBy: z.string().optional(),
}).passthrough().optional();

const projectCreateSchema = z.object({
    data: projectDataSchema,
    meta: metaSchema,
});

const projectUpdateSchema = z.object({
    data: projectUpdateDataSchema,
    meta: metaSchema,
});

module.exports = {
    projectCreateSchema,
    projectUpdateSchema,
};

const { z } = require('zod');

// Erosao tem muitos campos tecnicos com regras de calculo de criticidade. Nao
// vale a pena duplicar toda a validacao aqui — validateErosionTechnicalFields
// continua responsavel pelo valor semantico. Este schema existe para:
// (1) fechar mass assignment no top-level (rejeitar campos nao esperados),
// (2) garantir tipos basicos dos campos mais comuns.

// Campos numericos do formulario chegam como string (''), number ou null:
// normalizeErosionTechnicalFields/parseDecimal devolvem null quando o campo fica
// em branco, e buildCriticalityInputFromErosion repassa esse null no payload do
// /simulate (chamado dentro do handleSave). .optional() aceita undefined mas NAO
// null, entao um campo numerico vazio derrubava o save inteiro com VALIDATION_ERROR.
// .nullish() aceita null e undefined.
const numericLike = z.union([z.string(), z.number()]).nullish();

const locationSchema = z.object({
    latitude: numericLike,
    longitude: numericLike,
}).passthrough().optional();

const impactoViaSchema = z.object({
    tipo: z.string().optional(),
    detalhes: z.record(z.string(), z.any()).optional(),
}).passthrough().optional().nullable();

const fotoPrincipalSchema = z.object({
    photoId: z.string().trim().min(1),
    workspaceId: z.string().trim().min(1),
    mediaAssetId: z.string().trim().min(1),
    caption: z.string().max(500).optional(),
    sortOrder: z.number().int().min(0).max(5),
});

const fotosPrincipaisSchema = z.array(fotoPrincipalSchema)
    .max(6, 'fotosPrincipais aceita no maximo 6 itens.')
    .refine((list) => new Set(list.map((f) => f.sortOrder)).size === list.length, {
        message: 'fotosPrincipais nao pode ter sortOrder duplicado.',
    })
    .refine((list) => new Set(list.map((f) => f.photoId)).size === list.length, {
        message: 'fotosPrincipais nao pode ter photoId duplicado.',
    })
    .optional();

const erosionDataSchema = z.object({
    id: z.string().trim().optional(),
    projetoId: z.string().trim().optional(),
    projectId: z.string().trim().optional(),
    vistoriaId: z.string().trim().optional(),
    vistoriaIds: z.array(z.string().trim()).optional(),
    status: z.string().trim().optional(),
    registroHistorico: z.boolean().optional(),
    intervencaoRealizada: z.string().optional(),
    tiposFeicao: z.array(z.string()).optional(),
    tipo: z.string().optional(),
    usosSolo: z.array(z.string()).optional(),
    usoSoloOutro: z.string().optional(),
    saturacaoPorAgua: z.string().optional(),
    tipoSolo: z.string().optional(),
    profundidadeMetros: numericLike,
    declividadeGraus: numericLike,
    distanciaEstruturaMetros: numericLike,
    sinaisAvanco: z.boolean().optional(),
    vegetacaoInterior: z.boolean().optional(),
    presencaAguaFundo: z.string().optional(),
    impactoVia: impactoViaSchema,
    dimensionamento: z.string().optional(),
    medidaPreventiva: z.string().optional(),
    fotosLinks: z.array(z.string()).optional(),
    fotosPrincipais: fotosPrincipaisSchema,
    backfillEstimado: z.boolean().optional(),
    latitude: numericLike,
    longitude: numericLike,
    locationCoordinates: locationSchema,
    localContexto: z.any().optional(),
    criticalidade: z.any().optional(),
    criticality: z.any().optional(),
    alertsAtivos: z.array(z.any()).optional(),
    historicoCriticidade: z.array(z.any()).optional(),
    acompanhamentosResumo: z.array(z.any()).optional(),
    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
    createdAt: z.string().optional(),
}).passthrough(); // passthrough em erosoes para nao quebrar callers legados ate migrar campo a campo

const metaSchema = z.object({
    updatedBy: z.string().optional(),
    merge: z.boolean().optional(),
    skipAutoFollowup: z.boolean().optional(),
    origem: z.string().optional(),
    rulesConfig: z.any().optional(),
}).passthrough().optional();

const erosionSaveSchema = z.object({
    data: erosionDataSchema,
    meta: metaSchema,
});

const erosionSimulateSchema = z.object({
    data: erosionDataSchema,
    meta: metaSchema,
});

const erosionFichaCadastroSchema = z.object({
    projectId: z.string().trim().min(1, 'projectId e obrigatorio.'),
    erosionIds: z.array(z.string().trim()).optional().default([]),
}).passthrough();

module.exports = {
    erosionSaveSchema,
    erosionSimulateSchema,
    erosionFichaCadastroSchema,
};

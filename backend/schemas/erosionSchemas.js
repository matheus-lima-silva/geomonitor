const { z } = require('zod');

// Erosao tem muitos campos tecnicos com regras de calculo de criticidade. Nao
// vale a pena duplicar toda a validacao aqui — validateErosionTechnicalFields
// continua responsavel pelo valor semantico. Este schema existe para:
// (1) fechar mass assignment no top-level (rejeitar campos nao esperados),
// (2) garantir tipos basicos dos campos mais comuns.

const locationSchema = z.object({
    latitude: z.union([z.string(), z.number()]).optional(),
    longitude: z.union([z.string(), z.number()]).optional(),
}).passthrough().optional();

const impactoViaSchema = z.object({
    tipo: z.string().optional(),
    detalhes: z.record(z.string(), z.any()).optional(),
}).passthrough().optional().nullable();

const dimensionamentoSchema = z.object({
    comprimento: z.union([z.string(), z.number()]).optional(),
    largura: z.union([z.string(), z.number()]).optional(),
    profundidade: z.union([z.string(), z.number()]).optional(),
}).passthrough().optional();

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
    profundidadeMetros: z.union([z.string(), z.number()]).optional(),
    declividadeGraus: z.union([z.string(), z.number()]).optional(),
    distanciaEstruturaMetros: z.union([z.string(), z.number()]).optional(),
    sinaisAvanco: z.array(z.string()).optional(),
    vegetacaoInterior: z.string().optional(),
    presencaAguaFundo: z.string().optional(),
    impactoVia: impactoViaSchema,
    dimensionamento: dimensionamentoSchema,
    medidaPreventiva: z.string().optional(),
    fotosLinks: z.array(z.string()).optional(),
    fotosPrincipais: fotosPrincipaisSchema,
    backfillEstimado: z.boolean().optional(),
    latitude: z.union([z.string(), z.number()]).optional(),
    longitude: z.union([z.string(), z.number()]).optional(),
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

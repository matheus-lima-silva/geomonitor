const { z } = require('zod');

// Tracados de acesso por torre (Fase 1b). Coordenadas GeoJSON [lon, lat].
const MAX_LINE_VERTICES = 20000;
const MAX_PREVIEW_FEATURES = 3000;
const MAX_PREVIEW_VERTICES = 400000;

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const lineString = z.object({
    type: z.literal('LineString'),
    coordinates: z.array(lonLat).min(2).max(MAX_LINE_VERTICES),
});

const sourceSchema = z.object({
    tipo: z.enum(['arquivo', 'trilha', 'fotos']).optional(),
    arquivo: z.string().max(300).optional(),
    formato: z.enum(['kml', 'kmz', 'gpx']).optional(),
    feicao: z.string().max(300).optional(),
    importadoEm: z.string().optional(),
}).passthrough();

const segmentSchema = z.object({
    tipo: z.enum(['asfalto', 'terra', 'acesso']),
    inferido: z.boolean().optional(),
    manual: z.boolean().optional(),
    comprimentoM: z.number().nonnegative(),
    coordinates: z.array(lonLat).min(2).max(MAX_LINE_VERTICES),
});

const previewSchema = z.object({
    data: z.object({
        features: z.array(z.object({
            id: z.string().max(100),
            name: z.string().max(300).optional(),
            geometry: lineString,
        })).min(1).max(MAX_PREVIEW_FEATURES)
            .refine(
                (features) => features.reduce((sum, f) => sum + f.geometry.coordinates.length, 0) <= MAX_PREVIEW_VERTICES,
                { message: `O arquivo passa de ${MAX_PREVIEW_VERTICES} vertices; divida em partes.` },
            ),
        source: sourceSchema.optional(),
    }),
});

const accessItem = z.object({
    towerNumber: z.string().trim().max(50).nullish(),
    kind: z.enum(['acesso', 'rota_guia']),
    name: z.string().max(300).optional(),
    geometry: lineString,
    segments: z.array(segmentSchema).max(2000),
    source: sourceSchema.optional(),
}).refine((item) => item.kind === 'rota_guia' || Boolean(item.towerNumber), {
    message: 'Acesso precisa de torre.',
    path: ['towerNumber'],
});

const createSchema = z.object({
    data: z.object({
        items: z.array(accessItem).min(1).max(MAX_PREVIEW_FEATURES),
        replaceIds: z.array(z.string().max(100)).max(MAX_PREVIEW_FEATURES).optional(),
    }),
});

const updateSchema = z.object({
    data: z.object({
        towerNumber: z.string().trim().max(50).nullish(),
        kind: z.enum(['acesso', 'rota_guia']),
        name: z.string().max(300).optional(),
        segments: z.array(segmentSchema).max(2000),
    }).refine((item) => item.kind === 'rota_guia' || Boolean(item.towerNumber), {
        message: 'Acesso precisa de torre.',
        path: ['towerNumber'],
    }),
});

module.exports = {
    towerAccessPreviewSchema: previewSchema,
    towerAccessCreateSchema: createSchema,
    towerAccessUpdateSchema: updateSchema,
};

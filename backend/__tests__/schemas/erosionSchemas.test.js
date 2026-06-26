const { erosionSaveSchema, erosionSimulateSchema } = require('../../schemas/erosionSchemas');
const {
    normalizeErosionTechnicalFields,
    buildCriticalityInputFromErosion,
} = require('../../utils/erosionUtils_dist');

function makeFoto(overrides = {}) {
    return {
        photoId: 'RWP-1',
        workspaceId: 'RW-1',
        mediaAssetId: 'MA-1',
        caption: 'Vista',
        sortOrder: 0,
        ...overrides,
    };
}

describe('erosionSaveSchema.fotosPrincipais', () => {
    it('aceita payload minimo sem fotosPrincipais', () => {
        const result = erosionSaveSchema.safeParse({ data: { id: 'ERS-1' } });
        expect(result.success).toBe(true);
    });

    it('aceita ate 6 fotos com sortOrder unico', () => {
        const fotos = [0, 1, 2, 3, 4, 5].map((i) => makeFoto({
            photoId: `RWP-${i}`,
            sortOrder: i,
        }));
        const result = erosionSaveSchema.safeParse({ data: { fotosPrincipais: fotos } });
        expect(result.success).toBe(true);
        expect(result.data.data.fotosPrincipais).toHaveLength(6);
    });

    it('rejeita array com mais de 6 itens', () => {
        const fotos = [0, 1, 2, 3, 4, 5, 6].map((i) => makeFoto({
            photoId: `RWP-${i}`,
            sortOrder: i % 6,
        }));
        const result = erosionSaveSchema.safeParse({ data: { fotosPrincipais: fotos } });
        expect(result.success).toBe(false);
    });

    it('rejeita sortOrder duplicado', () => {
        const fotos = [
            makeFoto({ photoId: 'RWP-A', sortOrder: 0 }),
            makeFoto({ photoId: 'RWP-B', sortOrder: 0 }),
        ];
        const result = erosionSaveSchema.safeParse({ data: { fotosPrincipais: fotos } });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((issue) => issue.message.includes('sortOrder'))).toBe(true);
    });

    it('rejeita photoId duplicado', () => {
        const fotos = [
            makeFoto({ photoId: 'RWP-X', sortOrder: 0 }),
            makeFoto({ photoId: 'RWP-X', sortOrder: 1 }),
        ];
        const result = erosionSaveSchema.safeParse({ data: { fotosPrincipais: fotos } });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((issue) => issue.message.includes('photoId'))).toBe(true);
    });

    it('rejeita sortOrder fora da faixa 0..5', () => {
        const fotos = [makeFoto({ sortOrder: 6 })];
        const result = erosionSaveSchema.safeParse({ data: { fotosPrincipais: fotos } });
        expect(result.success).toBe(false);
    });

    it('rejeita foto sem campos obrigatorios', () => {
        const result = erosionSaveSchema.safeParse({
            data: {
                fotosPrincipais: [{ photoId: '', workspaceId: 'RW-1', mediaAssetId: 'MA-1', sortOrder: 0 }],
            },
        });
        expect(result.success).toBe(false);
    });

    it('aceita foto sem caption (opcional)', () => {
        const result = erosionSaveSchema.safeParse({
            data: {
                fotosPrincipais: [{
                    photoId: 'RWP-1',
                    workspaceId: 'RW-1',
                    mediaAssetId: 'MA-1',
                    sortOrder: 0,
                }],
            },
        });
        expect(result.success).toBe(true);
    });
});

describe('erosionSaveSchema campos tecnicos (contrato do frontend)', () => {
    // Regressao: o hardening Zod (ec062fe) declarou estes campos com tipos que nao
    // batiam com o que o frontend envia, causando "Dados invalidos." ao salvar/simular.
    it('aceita sinaisAvanco e vegetacaoInterior como boolean', () => {
        const ok = erosionSaveSchema.safeParse({
            data: { sinaisAvanco: true, vegetacaoInterior: false },
        });
        expect(ok.success).toBe(true);
        expect(ok.data.data.sinaisAvanco).toBe(true);
        expect(ok.data.data.vegetacaoInterior).toBe(false);
    });

    it('aceita dimensionamento como string de texto livre', () => {
        const result = erosionSaveSchema.safeParse({
            data: { dimensionamento: 'Premissas e medidas preliminares.' },
        });
        expect(result.success).toBe(true);
        expect(result.data.data.dimensionamento).toBe('Premissas e medidas preliminares.');
    });

    it('aceita payload realista do wizard (booleans + dimensionamento string + fotosPrincipais)', () => {
        const result = erosionSaveSchema.safeParse({
            data: {
                id: 'ERS-1',
                projetoId: 'PRJ-1',
                torreRef: '45',
                sinaisAvanco: false,
                vegetacaoInterior: true,
                presencaAguaFundo: 'nao',
                dimensionamento: 'Texto livre',
                tiposFeicao: ['vocoroca'],
                usosSolo: ['pastagem'],
                fotosPrincipais: [makeFoto()],
            },
            meta: { merge: true, updatedBy: 'eng@empresa.com' },
        });
        expect(result.success).toBe(true);
    });

    it('rejeita sinaisAvanco como array de strings (tipo antigo incorreto)', () => {
        const result = erosionSaveSchema.safeParse({
            data: { sinaisAvanco: ['sim'] },
        });
        expect(result.success).toBe(false);
    });
});

describe('erosionDataSchema campos numericos em branco (null)', () => {
    // Regressao: parseDecimal devolve null para campo numerico vazio e
    // buildCriticalityInputFromErosion repassa esse null no payload do /simulate
    // (chamado dentro do handleSave). Com .optional() (que nao aceita null) qualquer
    // erosao nova com profundidade/declividade/distancia em branco caia em
    // VALIDATION_ERROR, abortando o save. Os campos numericos devem aceitar null.
    it('aceita null nos campos numericos e de coordenada', () => {
        const result = erosionSaveSchema.safeParse({
            data: {
                profundidadeMetros: null,
                declividadeGraus: null,
                distanciaEstruturaMetros: null,
                latitude: null,
                longitude: null,
            },
        });
        expect(result.success).toBe(true);
    });

    it('ainda aceita string e number nos campos numericos', () => {
        const result = erosionSaveSchema.safeParse({
            data: { profundidadeMetros: '1.5', declividadeGraus: 30, distanciaEstruturaMetros: '' },
        });
        expect(result.success).toBe(true);
    });

    it('aceita o payload real do /simulate quando os numericos ficam em branco', () => {
        // Reproduz exatamente o que o frontend envia em handleSave: form com
        // localizacao preenchida mas numericos vazios -> parseDecimal => null.
        const rawForm = {
            status: 'Ativa',
            tiposFeicao: ['sulco'],
            usosSolo: ['pasto'],
            saturacaoPorAgua: 'nao',
            tipoSolo: 'argiloso',
            presencaAguaFundo: 'nao',
            sinaisAvanco: false,
            vegetacaoInterior: false,
            dimensionamento: 'Talude de 5m.',
            profundidadeMetros: '',
            declividadeGraus: '',
            distanciaEstruturaMetros: '',
            localContexto: { localTipo: 'base_torre', estruturaProxima: 'torre' },
            latitude: '-22.5',
            longitude: '-43.2',
            locationCoordinates: { latitude: '-22.5', longitude: '-43.2' },
        };
        const criticalityInput = buildCriticalityInputFromErosion(
            normalizeErosionTechnicalFields(rawForm),
        );
        expect(criticalityInput.profundidadeMetros).toBeNull();

        const result = erosionSimulateSchema.safeParse({
            data: criticalityInput,
            meta: { rulesConfig: {} },
        });
        expect(result.success).toBe(true);
    });
});

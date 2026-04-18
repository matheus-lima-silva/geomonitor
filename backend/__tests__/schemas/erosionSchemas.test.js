const { erosionSaveSchema } = require('../../schemas/erosionSchemas');

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

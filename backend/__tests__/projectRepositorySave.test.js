// projectRepository.save deve, apos salvar, reconstruir project_geometries — e
// uma falha na geometria (projecao derivada) NAO pode quebrar o save do projeto.
const mockBaseSave = jest.fn(async (payload) => ({ ...payload, id: payload.id }));
const mockBase = {
    save: mockBaseSave,
    list: jest.fn(),
    getById: jest.fn(),
    remove: jest.fn(),
    listByProject: jest.fn(),
    countByProject: jest.fn(),
};
jest.mock('../repositories/createDocumentTableRepository', () => jest.fn(() => mockBase));

const mockUpsert = jest.fn(async () => {});
jest.mock('../repositories/projectGeometryRepository', () => ({
    upsertFromProject: mockUpsert,
    getByProject: jest.fn(),
    remove: jest.fn(),
}));

const projectRepository = require('../repositories/projectRepository');

describe('projectRepository.save', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        mockBaseSave.mockClear();
        mockUpsert.mockClear();
        mockUpsert.mockResolvedValue(undefined);
        // Silencia o console.error esperado do caminho de falha da reconstrucao de geometria.
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    test('salva via base e reconstroi a geometria com o id salvo', async () => {
        const saved = await projectRepository.save({ id: 'P1', nome: 'x' }, { merge: true });

        expect(mockBaseSave).toHaveBeenCalledWith({ id: 'P1', nome: 'x' }, { merge: true });
        expect(mockUpsert).toHaveBeenCalledWith('P1');
        expect(saved.id).toBe('P1');
    });

    test('falha ao reconstruir geometria NAO quebra o save', async () => {
        mockUpsert.mockRejectedValueOnce(new Error('postgis down'));
        const saved = await projectRepository.save({ id: 'P2' }, {});

        expect(saved.id).toBe('P2');
        expect(mockUpsert).toHaveBeenCalledWith('P2');
        expect(consoleErrorSpy).toHaveBeenCalled(); // a falha da geometria foi logada
    });

    test('expoe os metodos do repositorio base', () => {
        expect(typeof projectRepository.list).toBe('function');
        expect(typeof projectRepository.getById).toBe('function');
        expect(typeof projectRepository.remove).toBe('function');
        expect(typeof projectRepository.listByProject).toBe('function');
    });
});

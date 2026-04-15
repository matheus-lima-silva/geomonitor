// Valida helpers de paginacao HATEOAS sem precisar do app inteiro.
const {
    generatePaginationLinks,
    createPaginatedHateoasResponse,
} = require('../../utils/hateoas');

function makeReq(path = 'users', query = {}) {
    return {
        protocol: 'https',
        get: () => 'api.example.com',
        query,
        originalUrl: `/api/${path}`,
    };
}

describe('generatePaginationLinks', () => {
    it('primeira pagina nao tem prev, tem next', () => {
        const req = makeReq('users');
        const links = generatePaginationLinks(req, {
            page: 1, limit: 10, total: 100, collectionPath: 'users',
        });
        expect(links.self.href).toContain('page=1');
        expect(links.first.href).toContain('page=1');
        expect(links.last.href).toContain('page=10');
        expect(links.next.href).toContain('page=2');
        expect(links.prev).toBeUndefined();
    });

    it('ultima pagina nao tem next, tem prev', () => {
        const req = makeReq('users');
        const links = generatePaginationLinks(req, {
            page: 10, limit: 10, total: 100, collectionPath: 'users',
        });
        expect(links.next).toBeUndefined();
        expect(links.prev.href).toContain('page=9');
        expect(links.last.href).toContain('page=10');
    });

    it('pagina intermediaria tem next e prev', () => {
        const req = makeReq('users');
        const links = generatePaginationLinks(req, {
            page: 5, limit: 10, total: 100, collectionPath: 'users',
        });
        expect(links.next.href).toContain('page=6');
        expect(links.prev.href).toContain('page=4');
    });

    it('total zero resulta em totalPages 1', () => {
        const req = makeReq('users');
        const links = generatePaginationLinks(req, {
            page: 1, limit: 10, total: 0, collectionPath: 'users',
        });
        expect(links.first.href).toContain('page=1');
        expect(links.last.href).toContain('page=1');
        expect(links.next).toBeUndefined();
    });

    it('preserva outros query params mas nao page/limit', () => {
        const req = makeReq('users', { page: 2, limit: 10, filter: 'active', sort: 'name' });
        const links = generatePaginationLinks(req, {
            page: 2, limit: 10, total: 50, collectionPath: 'users',
        });
        expect(links.self.href).toContain('filter=active');
        expect(links.self.href).toContain('sort=name');
        expect(links.self.href).toContain('page=2');
        expect(links.self.href).toContain('limit=10');
    });

    it('todas as URLs sao baseadas em API_BASE_URL', () => {
        process.env.API_BASE_URL = 'https://custom.api/v1';
        const req = makeReq('users');
        const links = generatePaginationLinks(req, {
            page: 1, limit: 10, total: 100, collectionPath: 'users',
        });
        expect(links.self.href).toContain('https://custom.api/v1/users');
        delete process.env.API_BASE_URL;
    });
});

describe('createPaginatedHateoasResponse', () => {
    it('envelopa items com _links + pagination', () => {
        const req = makeReq('users');
        const items = [
            { id: 'U-1', nome: 'Alice' },
            { id: 'U-2', nome: 'Bob' },
        ];
        const envelope = createPaginatedHateoasResponse(req, items, {
            entityType: 'users',
            page: 1,
            limit: 10,
            total: 25,
        });

        expect(envelope.data).toHaveLength(2);
        expect(envelope.data[0]._links.self).toBeDefined();
        expect(envelope.data[0]._links.update).toBeDefined();
        expect(envelope.data[0]._links.delete).toBeDefined();
        expect(envelope.pagination).toEqual({
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
        });
        expect(envelope._links.next.href).toContain('page=2');
    });

    it('funciona com lista vazia', () => {
        const req = makeReq('users');
        const envelope = createPaginatedHateoasResponse(req, [], {
            entityType: 'users',
            page: 1,
            limit: 10,
            total: 0,
        });
        expect(envelope.data).toEqual([]);
        expect(envelope.pagination.total).toBe(0);
        expect(envelope._links.next).toBeUndefined();
    });
});

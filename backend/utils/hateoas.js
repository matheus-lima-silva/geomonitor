function resolveApiBaseUrl(req) {
    return process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}/api`;
}

function buildApiHref(baseUrl, resourcePath) {
    return `${baseUrl}/${String(resourcePath || '').replace(/^\/+/, '')}`;
}

/**
 * Utility function to generate standard RESTful HATEOAS links for an entity.
 * Uses API_BASE_URL env var to prevent Host Header Injection.
 */
function generateHateoasLinks(req, entityType, id) {
    const baseUrl = resolveApiBaseUrl(req);
    const itemPath = `${entityType}/${id}`;

    return {
        self: { href: buildApiHref(baseUrl, itemPath), method: 'GET' },
        update: { href: buildApiHref(baseUrl, itemPath), method: 'PUT' },
        delete: { href: buildApiHref(baseUrl, itemPath), method: 'DELETE' },
        collection: { href: buildApiHref(baseUrl, entityType), method: 'GET' }
    };
}

function generateSingletonHateoasLinks(req, resourcePath) {
    const baseUrl = resolveApiBaseUrl(req);
    const normalizedPath = String(resourcePath || '').replace(/^\/+/, '');

    return {
        self: { href: buildApiHref(baseUrl, normalizedPath), method: 'GET' },
        update: { href: buildApiHref(baseUrl, normalizedPath), method: 'PUT' }
    };
}

/**
 * Enhanced HATEOAS wrapper to standardize API responses.
 */
function createHateoasResponse(req, data, entityType, id) {
    return {
        ...data,
        id,
        _links: generateHateoasLinks(req, entityType, id)
    };
}

function createSingletonHateoasResponse(req, data, resourcePath) {
    return {
        ...data,
        _links: generateSingletonHateoasLinks(req, resourcePath)
    };
}

/**
 * Gera links de paginacao (first, prev, next, last) para respostas de coleccao.
 * Preserva os query params atuais do request, exceto `page` e `limit`.
 */
function generatePaginationLinks(req, { page, limit, total, collectionPath }) {
    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 50);
    const totalItems = Math.max(0, Number(total) || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const baseUrl = resolveApiBaseUrl(req);
    const normalizedPath = String(collectionPath || '').replace(/^\/+/, '');
    const base = buildApiHref(baseUrl, normalizedPath);

    // Preserva query params existentes, exceto page/limit que sao recalculados.
    const otherParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query || {})) {
        if (key === 'page' || key === 'limit') continue;
        if (value == null) continue;
        if (Array.isArray(value)) {
            value.forEach((v) => otherParams.append(key, String(v)));
        } else {
            otherParams.append(key, String(value));
        }
    }

    function buildHref(targetPage) {
        const params = new URLSearchParams(otherParams);
        params.set('page', String(targetPage));
        params.set('limit', String(pageSize));
        return `${base}?${params.toString()}`;
    }

    const links = {
        self: { href: buildHref(currentPage), method: 'GET' },
        first: { href: buildHref(1), method: 'GET' },
        last: { href: buildHref(totalPages), method: 'GET' },
    };

    if (currentPage > 1) {
        links.prev = { href: buildHref(currentPage - 1), method: 'GET' };
    }
    if (currentPage < totalPages) {
        links.next = { href: buildHref(currentPage + 1), method: 'GET' };
    }

    return links;
}

/**
 * Envelopa uma lista paginada no formato padronizado com _links de paginacao
 * e _links por item. Use em GET de colecoes.
 */
function createPaginatedHateoasResponse(req, items, { entityType, page, limit, total, collectionPath }) {
    const resolvedCollectionPath = collectionPath || entityType;
    const pagination = {
        page: Math.max(1, Number(page) || 1),
        limit: Math.max(1, Number(limit) || 50),
        total: Math.max(0, Number(total) || 0),
    };
    pagination.totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

    const hydrated = (Array.isArray(items) ? items : []).map((item) =>
        createHateoasResponse(req, item, entityType, item.id),
    );

    return {
        data: hydrated,
        pagination,
        _links: generatePaginationLinks(req, {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            collectionPath: resolvedCollectionPath,
        }),
    };
}

function createResourceHateoasResponse(req, data, resourcePath, options = {}) {
    const baseUrl = resolveApiBaseUrl(req);
    const normalizedPath = String(resourcePath || '').replace(/^\/+/, '');
    const normalizedCollectionPath = String(
        options.collectionPath || normalizedPath.split('/').slice(0, -1).join('/'),
    ).replace(/^\/+/, '');

    const links = {
        self: { href: buildApiHref(baseUrl, normalizedPath), method: 'GET' },
    };

    if (normalizedCollectionPath) {
        links.collection = { href: buildApiHref(baseUrl, normalizedCollectionPath), method: 'GET' };
    }

    if (options.allowUpdate !== false) {
        links.update = { href: buildApiHref(baseUrl, normalizedPath), method: 'PUT' };
    }

    if (options.allowDelete !== false) {
        links.delete = { href: buildApiHref(baseUrl, normalizedPath), method: 'DELETE' };
    }

    if (options.extraLinks && typeof options.extraLinks === 'object') {
        Object.assign(links, options.extraLinks);
    }

    return {
        ...data,
        _links: links,
    };
}

module.exports = {
    resolveApiBaseUrl,
    generateHateoasLinks,
    generateSingletonHateoasLinks,
    generatePaginationLinks,
    createHateoasResponse,
    createSingletonHateoasResponse,
    createResourceHateoasResponse,
    createPaginatedHateoasResponse,
};

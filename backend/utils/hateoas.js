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
    createHateoasResponse,
    createSingletonHateoasResponse,
    createResourceHateoasResponse,
};

/**
 * Utility function to generate standard RESTful HATEOAS links for an entity.
 * Uses API_BASE_URL env var to prevent Host Header Injection.
 */
function generateHateoasLinks(req, entityType, id) {
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}/api`;

    return {
        self: { href: `${baseUrl}/${entityType}/${id}`, method: 'GET' },
        update: { href: `${baseUrl}/${entityType}/${id}`, method: 'PUT' },
        delete: { href: `${baseUrl}/${entityType}/${id}`, method: 'DELETE' },
        collection: { href: `${baseUrl}/${entityType}`, method: 'GET' }
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

module.exports = {
    generateHateoasLinks,
    createHateoasResponse
};

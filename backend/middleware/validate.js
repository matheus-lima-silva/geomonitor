const { ZodError } = require('zod');

/**
 * Middleware factory para validar req.body contra um schema Zod.
 * Retorna 400 com detalhes dos erros quando a validacao falha.
 * Substitui req.body pela versao parseada (com coercoes aplicadas).
 *
 * Uso:
 *   router.post('/', validateBody(myZodSchema), handler);
 */
function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body ?? {});
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Dados invalidos.',
                    errors: (error.issues || error.errors || []).map((e) => ({
                        path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
                        message: e.message,
                        code: e.code,
                    })),
                });
            }
            return next(error);
        }
    };
}

/**
 * Variante que valida req.query. Util para paginacao e filtros.
 */
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req.query ?? {});
            // Object.defineProperty necessario pois req.query e getter em Express 5.
            Object.defineProperty(req, 'query', {
                value: parsed,
                writable: true,
                configurable: true,
                enumerable: true,
            });
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Parametros de query invalidos.',
                    errors: (error.issues || error.errors || []).map((e) => ({
                        path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
                        message: e.message,
                        code: e.code,
                    })),
                });
            }
            return next(error);
        }
    };
}

module.exports = {
    validateBody,
    validateQuery,
};

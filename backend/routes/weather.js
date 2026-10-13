// Proxy do Open-Meteo para sugerir o clima dos dias da vistoria. O navegador nao
// alcanca o Open-Meteo direto (CSP `connect-src 'self'`), entao o backend busca,
// classifica (utils/weatherClassify) e guarda em cache (utils/openMeteo).
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser } = require('../utils/authMiddleware');
const { createResourceHateoasResponse } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateQuery } = require('../middleware/validate');
const { weatherDailyQuerySchema } = require('../schemas/weatherSchemas');
const { fetchDailyWeather, WeatherUpstreamError } = require('../utils/openMeteo');

router.get('/daily', verifyToken, requireActiveUser, validateQuery(weatherDailyQuerySchema), asyncHandler(async (req, res) => {
    const { lat, lon, start, end } = req.query;
    let result;
    try {
        result = await fetchDailyWeather({ lat, lon, start, end });
    } catch (error) {
        if (error instanceof WeatherUpstreamError) {
            return res.status(error.status).json({ status: 'error', code: error.code, message: error.message });
        }
        throw error;
    }
    return res.status(200).json({
        status: 'success',
        data: createResourceHateoasResponse(req, result, 'weather/daily', {
            allowUpdate: false,
            allowDelete: false,
            collectionPath: 'weather',
        }),
    });
}));

module.exports = router;

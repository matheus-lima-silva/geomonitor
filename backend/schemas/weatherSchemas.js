const { z } = require('zod');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 92;

function dayDiff(start, end) {
    return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

// Query de GET /api/weather/daily: ponto + intervalo de datas (max 92 dias).
const weatherDailyQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    start: z.string().regex(ISO_DATE, 'start deve ser YYYY-MM-DD'),
    end: z.string().regex(ISO_DATE, 'end deve ser YYYY-MM-DD'),
}).refine((q) => !Number.isNaN(Date.parse(`${q.start}T00:00:00Z`)) && !Number.isNaN(Date.parse(`${q.end}T00:00:00Z`)), {
    message: 'Datas invalidas.',
}).refine((q) => dayDiff(q.start, q.end) >= 0, {
    message: 'end deve ser igual ou posterior a start.',
}).refine((q) => dayDiff(q.start, q.end) <= MAX_RANGE_DAYS, {
    message: `Intervalo maximo de ${MAX_RANGE_DAYS} dias.`,
});

module.exports = { weatherDailyQuerySchema, MAX_RANGE_DAYS };

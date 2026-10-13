// Cliente do Open-Meteo (https://open-meteo.com, uso nao comercial sem chave)
// para o clima diario de um ponto em um intervalo de datas.
//
// - Historico (ERA5, atraso de ~5 dias): archive-api.open-meteo.com/v1/archive
// - Dias recentes: api.open-meteo.com/v1/forecast com `past_days`
//
// O navegador nao chama o Open-Meteo direto (CSP de producao `connect-src 'self'`);
// a rota /api/weather/daily usa este modulo. Cache em memoria porque o historico
// nao muda e a mesma campanha e consultada varias vezes.

const { classifyWeather } = require('./weatherClassify');

const ARCHIVE_URL = process.env.OPEN_METEO_ARCHIVE_URL || 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_URL = process.env.OPEN_METEO_FORECAST_URL || 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = Number(process.env.OPEN_METEO_TIMEOUT_MS) || 5000;
const ARCHIVE_DELAY_DAYS = 6; // ERA5 publica com ~5 dias de atraso; margem de 1.
const MAX_RANGE_DAYS = 92;
const CACHE_TTL_ARCHIVE_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_FORECAST_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const DAILY_FIELDS = 'weather_code,precipitation_sum,precipitation_hours,temperature_2m_max,temperature_2m_min';
const TIMEZONE = 'America/Sao_Paulo';

const cache = new Map();

class WeatherUpstreamError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'WeatherUpstreamError';
        this.status = status;
        this.code = code;
    }
}

function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function cacheKey(source, lat, lon, start, end) {
    return `${source}|${Number(lat).toFixed(2)}|${Number(lon).toFixed(2)}|${start}|${end}`;
}

function readCache(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
    }
    return hit.value;
}

function writeCache(key, value, ttlMs) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function resetWeatherCache() {
    cache.clear();
}

/** Decide a fonte: archive para intervalos ja consolidados, forecast (past_days) para o recente. */
function resolveSource({ start, end, now = new Date() }) {
    const endDate = parseIsoDate(end);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const archiveCutoff = new Date(today.getTime() - ARCHIVE_DELAY_DAYS * 86_400_000);
    if (endDate && endDate < archiveCutoff) return 'archive';
    return 'forecast';
}

function buildUrl({ source, lat, lon, start, end, now = new Date() }) {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        daily: DAILY_FIELDS,
        timezone: TIMEZONE,
    });
    if (source === 'archive') {
        params.set('start_date', start);
        params.set('end_date', end);
        return `${ARCHIVE_URL}?${params.toString()}`;
    }
    const startDate = parseIsoDate(start);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const pastDays = Math.min(MAX_RANGE_DAYS, Math.max(1, daysBetween(startDate, today) + 1));
    params.set('past_days', String(pastDays));
    params.set('forecast_days', '1');
    return `${FORECAST_URL}?${params.toString()}`;
}

function mapDays(payload, { start, end }) {
    const daily = payload?.daily || {};
    const times = Array.isArray(daily.time) ? daily.time : [];
    const pick = (field, index) => {
        const list = daily[field];
        const value = Array.isArray(list) ? list[index] : null;
        return value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);
    };
    const out = [];
    for (let i = 0; i < times.length; i += 1) {
        const date = String(times[i] || '').slice(0, 10);
        if (!date || date < start || date > end) continue;
        const day = {
            date,
            weatherCode: pick('weather_code', i),
            precipitationSum: pick('precipitation_sum', i),
            precipitationHours: pick('precipitation_hours', i),
            tMax: pick('temperature_2m_max', i),
            tMin: pick('temperature_2m_min', i),
        };
        const { clima, reason } = classifyWeather(day);
        out.push({ ...day, clima, reason });
    }
    return out;
}

/**
 * Clima diario classificado para um ponto e um intervalo (datas ISO, max 92 dias).
 * Lanca WeatherUpstreamError com status 504 (timeout) ou 502 (upstream).
 */
async function fetchDailyWeather({ lat, lon, start, end, now = new Date(), fetchImpl = global.fetch }) {
    const source = resolveSource({ start, end, now });
    const key = cacheKey(source, lat, lon, start, end);
    const cached = readCache(key);
    if (cached) return { ...cached, cached: true };

    const url = buildUrl({ source, lat, lon, start, end, now });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
        response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new WeatherUpstreamError('Timeout ao consultar o Open-Meteo.', 504, 'WEATHER_TIMEOUT');
        }
        throw new WeatherUpstreamError('Falha ao consultar o Open-Meteo.', 502, 'WEATHER_UPSTREAM');
    } finally {
        clearTimeout(timeoutId);
    }
    if (!response.ok) {
        throw new WeatherUpstreamError(`Open-Meteo respondeu com status ${response.status}.`, 502, 'WEATHER_UPSTREAM');
    }
    let payload;
    try {
        payload = await response.json();
    } catch (_err) {
        throw new WeatherUpstreamError('Resposta invalida do Open-Meteo (JSON malformado).', 502, 'WEATHER_UPSTREAM');
    }

    const result = {
        source,
        latitude: Number.isFinite(Number(payload?.latitude)) ? Number(payload.latitude) : Number(lat),
        longitude: Number.isFinite(Number(payload?.longitude)) ? Number(payload.longitude) : Number(lon),
        timezone: payload?.timezone || TIMEZONE,
        start,
        end,
        days: mapDays(payload, { start, end }),
    };
    writeCache(key, result, source === 'archive' ? CACHE_TTL_ARCHIVE_MS : CACHE_TTL_FORECAST_MS);
    return { ...result, cached: false };
}

module.exports = {
    ARCHIVE_DELAY_DAYS,
    MAX_RANGE_DAYS,
    WeatherUpstreamError,
    buildUrl,
    fetchDailyWeather,
    mapDays,
    parseIsoDate,
    resetWeatherCache,
    resolveSource,
    toIsoDate,
};

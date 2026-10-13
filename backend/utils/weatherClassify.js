// Classifica o dia meteorologico do Open-Meteo (codigo WMO + precipitacao) nas
// quatro opcoes de clima do diario da vistoria: Sol, Parcialmente Nublado,
// Nublado, Chuva. Calibrado na campanha BMDOPR set/2026 (21/09 codigo 3 ->
// Nublado; 22-24/09 chuvisco 51/55 com 1-3,4 mm -> Chuva).

const CLIMA_OPTIONS = Object.freeze(['Sol', 'Parcialmente Nublado', 'Nublado', 'Chuva']);

const RAIN_CODES = new Set([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99]);
const DRIZZLE_CODES = new Set([51, 53, 55, 56, 57]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FOG_CODES = new Set([45, 48]);

function toFinite(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function formatMm(value) {
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm`;
}

function formatHours(value) {
    const rounded = Math.round(value);
    return `${rounded} h`;
}

/**
 * @param {{ weatherCode?: number, precipitationSum?: number, precipitationHours?: number }} day
 * @returns {{ clima: string|null, reason: string }}
 */
function classifyWeather(day = {}) {
    const code = toFinite(day.weatherCode);
    const mm = toFinite(day.precipitationSum);
    const hours = toFinite(day.precipitationHours);
    const mmText = mm !== null ? formatMm(mm) : '';
    const hoursText = hours !== null && hours > 0 ? formatHours(hours) : '';
    const precipText = [hoursText, mmText].filter(Boolean).join(', ');

    const heavyRain = code !== null && RAIN_CODES.has(code);
    const drizzle = code !== null && DRIZZLE_CODES.has(code);
    const wet = (mm !== null && mm >= 1) || heavyRain || (drizzle && hours !== null && hours >= 2);
    if (wet) {
        const kind = heavyRain ? (code >= 95 ? 'tempestade' : 'chuva') : (drizzle ? 'chuvisco' : 'chuva');
        return { clima: 'Chuva', reason: precipText ? `${kind} ${precipText}` : kind };
    }
    if (code === null) {
        return { clima: null, reason: '' };
    }
    if (code === 0) return { clima: 'Sol', reason: 'ceu limpo' };
    if (code === 1) return { clima: 'Sol', reason: 'predominio de sol' };
    if (code === 2) return { clima: 'Parcialmente Nublado', reason: 'parcialmente nublado' };
    if (code === 3) return { clima: 'Nublado', reason: 'encoberto' };
    if (FOG_CODES.has(code)) return { clima: 'Nublado', reason: 'nevoeiro' };
    if (drizzle) return { clima: 'Nublado', reason: precipText ? `chuvisco leve ${precipText}` : 'chuvisco leve' };
    if (SNOW_CODES.has(code)) return { clima: 'Chuva', reason: 'neve' };
    return { clima: null, reason: '' };
}

module.exports = { CLIMA_OPTIONS, classifyWeather };

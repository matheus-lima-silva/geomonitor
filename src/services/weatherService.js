import { API_BASE_URL } from '../utils/serviceFactory';
import { fetchWithHateoas } from '../utils/apiClient';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Clima diario classificado (Sol / Parcialmente Nublado / Nublado / Chuva) para
 * um ponto e um intervalo de datas, via proxy do backend (`GET /api/weather/daily`,
 * Open-Meteo). Devolve `[{ date, clima, reason, weatherCode, precipitationSum,
 * precipitationHours, tMax, tMin }]`.
 */
export async function fetchDailyWeather({ lat, lon, start, end } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Coordenada invalida para consultar o clima.');
  }
  const startIso = String(start || '').trim();
  const endIso = String(end || startIso).trim();
  if (!ISO_DATE.test(startIso) || !ISO_DATE.test(endIso)) {
    throw new Error('Periodo invalido para consultar o clima.');
  }
  const params = new URLSearchParams({
    lat: latitude.toFixed(5),
    lon: longitude.toFixed(5),
    start: startIso,
    end: endIso,
  });
  const link = { href: `${API_BASE_URL}/weather/daily?${params.toString()}`, method: 'GET' };
  const response = await fetchWithHateoas(link, null, API_BASE_URL);
  const days = Array.isArray(response?.data?.days) ? response.data.days : [];
  return days;
}

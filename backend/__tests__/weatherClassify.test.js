const { classifyWeather, CLIMA_OPTIONS } = require('../utils/weatherClassify');
const { buildUrl, mapDays, resolveSource } = require('../utils/openMeteo');

describe('classifyWeather', () => {
    test('casos reais da campanha BMDOPR set/2026', () => {
        // 21/09 codigo 3 sem chuva; 22/09 chuvisco 55, 6 h, 2 mm; 24/09 chuvisco 51, 6 h, 1 mm.
        expect(classifyWeather({ weatherCode: 3, precipitationSum: 0, precipitationHours: 0 })).toEqual({ clima: 'Nublado', reason: 'encoberto' });
        expect(classifyWeather({ weatherCode: 55, precipitationSum: 2, precipitationHours: 6 })).toEqual({ clima: 'Chuva', reason: 'chuvisco 6 h, 2 mm' });
        expect(classifyWeather({ weatherCode: 55, precipitationSum: 3.4, precipitationHours: 11 }).clima).toBe('Chuva');
        expect(classifyWeather({ weatherCode: 51, precipitationSum: 1, precipitationHours: 6 }).clima).toBe('Chuva');
    });

    test('tabela WMO: limpo, parcial, encoberto, nevoeiro, chuva, tempestade', () => {
        expect(classifyWeather({ weatherCode: 0, precipitationSum: 0 })).toEqual({ clima: 'Sol', reason: 'ceu limpo' });
        expect(classifyWeather({ weatherCode: 1, precipitationSum: 0 }).clima).toBe('Sol');
        expect(classifyWeather({ weatherCode: 2, precipitationSum: 0 }).clima).toBe('Parcialmente Nublado');
        expect(classifyWeather({ weatherCode: 45, precipitationSum: 0 }).clima).toBe('Nublado');
        expect(classifyWeather({ weatherCode: 63, precipitationSum: 12.5, precipitationHours: 4 })).toEqual({ clima: 'Chuva', reason: 'chuva 4 h, 12,5 mm' });
        expect(classifyWeather({ weatherCode: 95, precipitationSum: 0.4, precipitationHours: 1 }).reason).toContain('tempestade');
    });

    test('chuvisco leve (< 2 h e < 1 mm) e nublado, nao chuva; codigo ausente devolve null', () => {
        expect(classifyWeather({ weatherCode: 51, precipitationSum: 0.3, precipitationHours: 1 })).toEqual({ clima: 'Nublado', reason: 'chuvisco leve 1 h, 0,3 mm' });
        expect(classifyWeather({ weatherCode: 2, precipitationSum: 1.2, precipitationHours: 2 }).clima).toBe('Chuva');
        expect(classifyWeather({})).toEqual({ clima: null, reason: '' });
        expect(classifyWeather({ weatherCode: 123 })).toEqual({ clima: null, reason: '' });
        for (const option of CLIMA_OPTIONS) expect(typeof option).toBe('string');
    });
});

describe('openMeteo helpers', () => {
    const now = new Date('2026-10-12T15:00:00Z');

    test('resolveSource: intervalo consolidado usa archive, recente usa forecast', () => {
        expect(resolveSource({ start: '2026-09-21', end: '2026-09-24', now })).toBe('archive');
        expect(resolveSource({ start: '2026-10-06', end: '2026-10-10', now })).toBe('forecast');
        expect(resolveSource({ start: '2026-10-01', end: '2026-10-05', now })).toBe('archive');
    });

    test('buildUrl monta archive com start/end e forecast com past_days', () => {
        const archive = buildUrl({ source: 'archive', lat: -20.074, lon: -44.826, start: '2026-09-21', end: '2026-09-24', now });
        expect(archive).toContain('archive-api.open-meteo.com/v1/archive?');
        expect(archive).toContain('start_date=2026-09-21');
        expect(archive).toContain('end_date=2026-09-24');
        expect(archive).toContain('timezone=America%2FSao_Paulo');
        expect(archive).toContain('daily=weather_code%2Cprecipitation_sum%2Cprecipitation_hours');

        const forecast = buildUrl({ source: 'forecast', lat: -20, lon: -44, start: '2026-10-08', end: '2026-10-10', now });
        expect(forecast).toContain('api.open-meteo.com/v1/forecast?');
        expect(forecast).toContain('past_days=5');
        expect(forecast).toContain('forecast_days=1');
    });

    test('mapDays recorta ao intervalo e classifica', () => {
        const payload = {
            daily: {
                time: ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'],
                weather_code: [3, 0, 55, 2],
                precipitation_sum: [0, 0, 2, 0.2],
                precipitation_hours: [0, 0, 6, 1],
                temperature_2m_max: [25, 28, 24, 27],
                temperature_2m_min: [15, 16, 17, 15],
            },
        };
        const days = mapDays(payload, { start: '2026-10-08', end: '2026-10-09' });
        expect(days.map((d) => d.date)).toEqual(['2026-10-08', '2026-10-09']);
        expect(days[0]).toMatchObject({ clima: 'Sol', weatherCode: 0, tMax: 28, tMin: 16 });
        expect(days[1]).toMatchObject({ clima: 'Chuva', reason: 'chuvisco 6 h, 2 mm' });
    });
});

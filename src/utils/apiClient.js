import { getAuthToken } from './serviceFactory';

export function isNetworkFailureError(error) {
    const message = String(error?.message || '').trim();
    const normalized = message.toLowerCase();
    return error?.name === 'TypeError'
        || normalized.includes('failed to fetch')
        || normalized.includes('networkerror')
        || normalized.includes('network request failed')
        || normalized.includes('load failed');
}

export async function extractApiErrorMessage(response, fallbackMessage = 'Erro de API.') {
    try {
        const errorData = await response.json();
        if (errorData?.message) return errorData.message;
    } catch {
        // Ignore JSON parsing errors and try text.
    }

    try {
        const text = await response.text();
        if (String(text || '').trim()) return String(text).trim();
    } catch {
        // Ignore text parsing errors.
    }

    return fallbackMessage;
}

export function normalizeRequestError(error, fallbackMessage) {
    const message = String(error?.message || '').trim();
    const isNetworkFailure = isNetworkFailureError(error);

    if (isNetworkFailure) {
        return new Error(fallbackMessage);
    }

    return error instanceof Error ? error : new Error(message || fallbackMessage);
}

function rewriteHateoasHref(href, preferredBaseUrl) {
    const rawHref = String(href || '').trim();
    const rawBase = String(preferredBaseUrl || '').trim();
    if (!rawHref || !rawBase) return rawHref;

    try {
        const targetUrl = new URL(rawHref);
        const preferredUrl = new URL(rawBase);

        targetUrl.protocol = preferredUrl.protocol;
        targetUrl.host = preferredUrl.host;

        return targetUrl.toString();
    } catch {
        return rawHref;
    }
}

export async function fetchWithHateoas(hateoasLink, body = null, preferredBaseUrl = '') {
    if (!hateoasLink || !hateoasLink.href || !hateoasLink.method) {
        throw new Error('Link HATEOAS inválido ou ação não permitida.');
    }

    const token = await getAuthToken();
    if (!token) throw new Error('Usuário não autenticado.');

    const options = {
        method: hateoasLink.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const requestUrl = rewriteHateoasHref(hateoasLink.href, preferredBaseUrl);

    if (body && (hateoasLink.method === 'POST' || hateoasLink.method === 'PUT')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(requestUrl, options);

        if (!response.ok) {
            const message = await extractApiErrorMessage(response, 'Erro de API.');
            throw new Error(message);
        }

        return response.json();
    } catch (error) {
        throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.');
    }
}

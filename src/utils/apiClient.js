import { auth } from '../firebase/config';

export async function fetchWithHateoas(hateoasLink, body = null) {
    if (!hateoasLink || !hateoasLink.href || !hateoasLink.method) {
        throw new Error('Link HATEOAS inválido ou ação não permitida.');
    }

    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Usuário não autenticado.');

    const options = {
        method: hateoasLink.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (body && (hateoasLink.method === 'POST' || hateoasLink.method === 'PUT')) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(hateoasLink.href, options);

    if (!response.ok) {
        let message = 'Erro de API.';
        try {
            const errorData = await response.json();
            if (errorData?.message) message = errorData.message;
        } catch { /* ignored */ }
        throw new Error(message);
    }

    return response.json();
}

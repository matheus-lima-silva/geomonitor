// Registra uma revisao do modelo PAEC na API: sobe o tokenized.docx (e
// opcionalmente o modelo marcado original) para o storage de midia, cria o
// paec_template com o manifest e o ativa.
//
// Fala com a API rodando (nao com o banco direto) usando o WORKER_API_TOKEN —
// as rotas POST /api/paec/templates e /activate aceitam requireAdminOrWorker.
//
// Uso:
//   GEOMONITOR_API_URL=http://localhost:8080 WORKER_API_TOKEN=... \
//   node backend/scripts/registerPaecTemplate.js \
//     --dir worker/assets/paec/rev10 \
//     --revision "OOSEMB.PL.003.2026 REV 10" \
//     [--name "PAEC AXIA"] [--source caminho/do/modelo-marcado.docx] [--no-activate]

const fs = require('fs');
const path = require('path');

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function parseArgs(argv) {
    const args = { name: 'PAEC AXIA', activate: true };
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--dir') args.dir = argv[++i];
        else if (arg === '--revision') args.revision = argv[++i];
        else if (arg === '--name') args.name = argv[++i];
        else if (arg === '--source') args.source = argv[++i];
        else if (arg === '--no-activate') args.activate = false;
        else throw new Error(`Argumento desconhecido: ${arg}`);
    }
    if (!args.dir || !args.revision) {
        throw new Error('Uso: --dir <pasta com tokenized.docx e manifest.json> --revision "<label>"');
    }
    return args;
}

function apiConfig() {
    const baseUrl = String(process.env.GEOMONITOR_API_URL || '').replace(/\/$/, '');
    const token = String(process.env.WORKER_API_TOKEN || '');
    if (!baseUrl || !token) {
        throw new Error('GEOMONITOR_API_URL e WORKER_API_TOKEN devem estar configurados.');
    }
    return { baseUrl, token };
}

async function api(config, method, route, body, headers = {}) {
    const res = await fetch(`${config.baseUrl}${route}`, {
        method,
        headers: {
            'x-worker-token': config.token,
            ...(body && !(body instanceof Buffer) ? { 'content-type': 'application/json' } : {}),
            ...headers,
        },
        body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
    if (!res.ok) {
        throw new Error(`${method} ${route} -> ${res.status}: ${text.slice(0, 300)}`);
    }
    return payload;
}

async function uploadDocx(config, filePath, purpose) {
    const content = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const created = await api(config, 'POST', '/api/media/upload-url', {
        data: {
            fileName,
            contentType: DOCX_CONTENT_TYPE,
            sizeBytes: content.length,
            purpose,
            linkedResourceType: 'paec_template',
        },
    });
    const media = created.data || {};
    const upload = media.upload || {};
    if (!media.id || !upload.href) {
        throw new Error(`upload-url nao retornou descriptor valido para ${fileName}`);
    }

    const uploadUrl = upload.href.startsWith('http') ? upload.href : `${config.baseUrl}${upload.href}`;
    const uploadHeaders = { 'content-type': DOCX_CONTENT_TYPE, ...(upload.headers || {}) };
    if (upload.href.startsWith('/')) uploadHeaders['x-worker-token'] = config.token;
    const putRes = await fetch(uploadUrl, { method: upload.method || 'PUT', headers: uploadHeaders, body: content });
    if (!putRes.ok) {
        throw new Error(`PUT do binario de ${fileName} falhou: ${putRes.status} ${await putRes.text()}`);
    }

    const crypto = require('crypto');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    await api(config, 'POST', '/api/media/complete', {
        data: { id: media.id, storedSizeBytes: content.length, sha256 },
    });

    console.log(`  media ${purpose}: ${media.id} (${(content.length / 1024 / 1024).toFixed(1)} MB)`);
    return media.id;
}

async function main() {
    const args = parseArgs(process.argv);
    const config = apiConfig();

    const tokenizedPath = path.join(args.dir, 'tokenized.docx');
    const manifestPath = path.join(args.dir, 'manifest.json');
    if (!fs.existsSync(tokenizedPath) || !fs.existsSync(manifestPath)) {
        throw new Error(`Esperado tokenized.docx e manifest.json em ${args.dir}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    console.log(`Registrando template PAEC "${args.name}" — ${args.revision}`);
    const tokenizedDocxMediaId = await uploadDocx(config, tokenizedPath, 'paec_template_tokenized');
    const sourceDocxMediaId = args.source
        ? await uploadDocx(config, args.source, 'paec_template_source')
        : null;

    const created = await api(config, 'POST', '/api/paec/templates', {
        data: {
            name: args.name,
            revisionLabel: args.revision,
            tokenizedDocxMediaId,
            sourceDocxMediaId,
            manifest,
        },
    });
    const templateId = created.data?.id;
    console.log(`  template registrado: ${templateId} (draft)`);

    if (args.activate) {
        await api(config, 'POST', `/api/paec/templates/${templateId}/activate`);
        console.log('  template ATIVADO');
    }
    console.log('OK');
}

main().catch((err) => {
    console.error(`ERRO: ${err.message}`);
    process.exit(1);
});

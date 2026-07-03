// Aplica um seed de ficha PAEC (backend/scripts/seed/*.json) na API: cria a
// usina vinculada ao template ativo ou, se ja existir, atualiza a ficha via
// PUT versionado. Os seeds foram extraidos dos PAECs antigos Furnas 2021
// (PCH Anta, UHE Simplicio) — valores legados como ponto de partida; campos
// organizacionais AXIA ficam vazios de proposito e aparecem como pendencia
// na ficha (fase 6 do plano do modulo).
//
// As rotas de /api/paec/plants exigem JWT de editor (nao aceitam
// x-worker-token), entao o script autentica via /api/auth/login.
//
// Uso:
//   GEOMONITOR_API_URL=http://localhost:8080 \
//   GEOMONITOR_EMAIL=... GEOMONITOR_PASSWORD=... \
//   node backend/scripts/seedPaecPlant.js --seed backend/scripts/seed/paec_pch_anta.json

const fs = require('fs');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i += 1) {
        if (argv[i] === '--seed') args.seed = argv[++i];
        else throw new Error(`Argumento desconhecido: ${argv[i]}`);
    }
    if (!args.seed) throw new Error('Uso: --seed <caminho do seed .json>');
    return args;
}

function apiConfig() {
    const baseUrl = String(process.env.GEOMONITOR_API_URL || '').replace(/\/$/, '');
    const email = String(process.env.GEOMONITOR_EMAIL || '');
    const password = String(process.env.GEOMONITOR_PASSWORD || '');
    if (!baseUrl || !email || !password) {
        throw new Error('GEOMONITOR_API_URL, GEOMONITOR_EMAIL e GEOMONITOR_PASSWORD devem estar configurados.');
    }
    return { baseUrl, email, password };
}

async function api(config, method, route, body) {
    const res = await fetch(`${config.baseUrl}${route}`, {
        method,
        headers: {
            ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
    return { status: res.status, payload };
}

async function login(config) {
    const { status, payload } = await api(config, 'POST', '/api/auth/login', {
        email: config.email,
        password: config.password,
    });
    if (status !== 200 || !payload?.accessToken) {
        throw new Error(`Login falhou (${status}): ${JSON.stringify(payload).slice(0, 200)}`);
    }
    config.token = payload.accessToken;
}

async function main() {
    const args = parseArgs(process.argv);
    const config = apiConfig();
    const seed = JSON.parse(fs.readFileSync(args.seed, 'utf-8'));

    await login(config);
    console.log(`Aplicando seed "${seed.name}"...`);

    const data = {
        name: seed.name,
        plantType: seed.plantType || null,
        installedCapacityMw: seed.installedCapacityMw ?? null,
        fields: seed.fields || {},
        listItems: seed.listItems || {},
        sectionFlags: seed.sectionFlags || {},
        assets: seed.assets || {},
    };

    const created = await api(config, 'POST', '/api/paec/plants', { data });
    if (created.status === 201) {
        console.log(`  ficha criada: ${created.payload.data.id}`);
    } else if (created.status === 409 && created.payload?.code === 'NAME_EXISTS') {
        const list = await api(config, 'GET', '/api/paec/plants');
        const existing = (list.payload?.data || []).find(
            (p) => String(p.name).toLowerCase() === seed.name.toLowerCase(),
        );
        if (!existing) throw new Error(`409 NAME_EXISTS mas a ficha "${seed.name}" nao apareceu na lista.`);
        const updated = await api(config, 'PUT', `/api/paec/plants/${existing.id}`, {
            data: { ...data, version: existing.version },
        });
        if (updated.status !== 200) {
            throw new Error(`PUT falhou (${updated.status}): ${JSON.stringify(updated.payload).slice(0, 300)}`);
        }
        console.log(`  ficha existente atualizada: ${existing.id} (v${existing.version} -> v${updated.payload.data.version})`);
    } else {
        throw new Error(`POST falhou (${created.status}): ${JSON.stringify(created.payload).slice(0, 300)}`);
    }

    const fieldCount = Object.keys(data.fields).length;
    const listCounts = Object.entries(data.listItems).map(([k, v]) => `${k}=${v.length}`).join(', ');
    console.log(`  ${fieldCount} campos, itens: ${listCounts}`);
    console.log('OK — abra a ficha no portal pra revisar as pendencias residuais (dados organizacionais AXIA atuais).');
}

main().catch((err) => {
    console.error(`ERRO: ${err.message}`);
    process.exit(1);
});

#!/usr/bin/env node
// Carrega as vias publicas do OpenStreetMap (Overpass API) em volta das torres
// dos empreendimentos, para pintar os tracados de acesso por trecho (Fase 1b,
// docs/plans/erosao-acessos-geodados.md). Dados (c) OpenStreetMap contributors, ODbL.
//
// Grade fixa de ladrilhos (alinhada em multiplos de --tile graus): entram so as
// celulas com torre a ate --margin graus, e celulas compartilhadas por varios
// empreendimentos sao consultadas uma vez. Cada ladrilho e uma consulta ao
// Overpass; vias sao gravadas por osm_id (upsert) e cada ladrilho fica registrado
// em osm_road_loads. Ladrilhos ja carregados sao pulados (retomada), salvo --refresh.
//
// Uso (no homelab roda dentro do container da API, cwd /app):
//   node scripts/loadOsmRoads.js --projects=ARAPCA,CAMPCA        # dry-run: so lista os ladrilhos
//   node scripts/loadOsmRoads.js --projects=ARAPCA,CAMPCA --apply
//   node scripts/loadOsmRoads.js --all --apply
//
// Flags:
//   --projects=A,B   empreendimentos (ids)
//   --all            todos os empreendimentos com torres
//   --apply          consulta o Overpass e grava (sem isso, so lista)
//   --refresh        recarrega tambem os ladrilhos ja carregados
//   --tile=0.2       tamanho do ladrilho em graus
//   --margin=0.03    margem em graus em volta das torres (~3 km)
//   --endpoint=URL   servidor Overpass (default: espelho mail.ru, depois overpass-api.de e kumi.systems)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { projectRepository, osmRoadRepository } = require('../repositories');
const { tilesAroundTowers, tileKey, buildOverpassQuery, parseOverpassWays } = require('../utils/osmRoads');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}
const hasFlag = (name) => process.argv.includes(`--${name}`);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Ordem importa: o primeiro que responder e usado. Em 2026-11 o overpass-api.de
// e o kumi.systems devolviam 502/504 com frequencia; o espelho mail.ru respondia.
const DEFAULT_ENDPOINTS = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];
const RETRY_STATUS = new Set([429, 502, 503, 504]);

async function fetchOnce(endpoint, query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'geomonitor-osm-loader/1.0' },
            body: `data=${encodeURIComponent(query)}`,
            signal: controller.signal,
        });
        if (!response.ok) {
            const error = new Error(`Overpass (${endpoint}) respondeu ${response.status}`);
            error.retryable = RETRY_STATUS.has(response.status);
            throw error;
        }
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError' || error.cause) error.retryable = true;
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/** Tenta cada servidor ate 3 vezes, com espera crescente em sobrecarga (429/5xx). */
async function fetchOverpass(endpoints, query) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        for (const endpoint of endpoints) {
            try {
                return await fetchOnce(endpoint, query);
            } catch (error) {
                lastError = error;
                if (!error.retryable) throw error;
                console.warn(`  ${error.message}; tentando de novo`);
            }
        }
        await sleep(20000 * attempt);
    }
    throw lastError;
}

async function main() {
    const apply = hasFlag('apply');
    const tileSize = Number(argValue('tile')) || 0.2;
    const margin = Number(argValue('margin')) || 0.03;
    const endpoints = argValue('endpoint') ? [argValue('endpoint')] : DEFAULT_ENDPOINTS;
    const wanted = argValue('projects').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!hasFlag('all') && wanted.length === 0) {
        throw new Error('Informe --projects=A,B ou --all.');
    }

    const projects = (await projectRepository.list())
        .filter((p) => hasFlag('all') || wanted.includes(String(p.id).toUpperCase()));
    const towers = projects.flatMap((p) => (Array.isArray(p.torresCoordenadas) ? p.torresCoordenadas : [])
        .map((t) => ({ longitude: t?.longitude, latitude: t?.latitude, projectId: p.id })));
    const tiles = tilesAroundTowers(towers, tileSize, margin);
    const loaded = new Set(hasFlag('refresh') ? [] : (await osmRoadRepository.listLoadedBboxes()).map(tileKey));
    const pending = tiles.filter((tile) => !loaded.has(tile.key));
    console.log(`${projects.length} empreendimento(s), ${towers.length} torre(s): ${tiles.length} ladrilho(s) de ${tileSize} grau, ${tiles.length - pending.length} ja carregado(s), ${pending.length} a carregar`);
    if (!apply) {
        console.log('dry-run: nada gravado (use --apply)');
        return;
    }

    let totalWays = 0;
    const startedAt = Date.now();
    for (const [index, tile] of pending.entries()) {
        const json = await fetchOverpass(endpoints, buildOverpassQuery(tile));
        const roads = parseOverpassWays(json);
        await osmRoadRepository.upsertMany(roads);
        await osmRoadRepository.recordLoad({ ...tile, projectIds: tile.projectIds, ways: roads.length });
        totalWays += roads.length;
        const elapsedMin = (Date.now() - startedAt) / 60000;
        const etaMin = (elapsedMin / (index + 1)) * (pending.length - index - 1);
        console.log(`ladrilho ${index + 1}/${pending.length} (${tile.key}, ${tile.projectIds.join(' ')}): ${roads.length} vias; faltam ~${Math.round(etaMin)} min`);
        await sleep(2000); // gentileza com o servidor publico do Overpass
    }
    console.log(`ok: ${totalWays} vias gravadas em ${pending.length} ladrilho(s)`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});

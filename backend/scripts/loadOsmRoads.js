#!/usr/bin/env node
// Carrega as vias publicas do OpenStreetMap (Overpass API) na area dos
// empreendimentos, para pintar os tracados de acesso por trecho (Fase 1b,
// docs/plans/erosao-acessos-geodados.md). Dados (c) OpenStreetMap contributors, ODbL.
//
// Para cada empreendimento: envelope das torres + margem, dividido em ladrilhos;
// cada ladrilho e uma consulta ao Overpass. Vias sao gravadas por osm_id (upsert),
// entao recarregar atualiza sem duplicar. Cada ladrilho fica registrado em
// osm_road_loads.
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
//   --tile=0.4       tamanho do ladrilho em graus
//   --margin=0.03    margem em graus em volta das torres (~3 km)
//   --endpoint=URL   servidor Overpass (default: overpass-api.de, com espelho kumi.systems)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { projectRepository, osmRoadRepository } = require('../repositories');
const { projectBbox, tilesForBbox, buildOverpassQuery, parseOverpassWays } = require('../utils/osmRoads');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}
const hasFlag = (name) => process.argv.includes(`--${name}`);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const DEFAULT_ENDPOINTS = [
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
    const tileSize = Number(argValue('tile')) || 0.4;
    const margin = Number(argValue('margin')) || 0.03;
    const endpoints = argValue('endpoint') ? [argValue('endpoint')] : DEFAULT_ENDPOINTS;
    const wanted = argValue('projects').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!hasFlag('all') && wanted.length === 0) {
        throw new Error('Informe --projects=A,B ou --all.');
    }

    const projects = (await projectRepository.list())
        .filter((p) => hasFlag('all') || wanted.includes(String(p.id).toUpperCase()));
    let totalWays = 0;
    for (const project of projects) {
        const bbox = projectBbox(project.torresCoordenadas, margin);
        if (!bbox) {
            console.log(`[${project.id}] sem torres com coordenadas, pulando`);
            continue;
        }
        const tiles = tilesForBbox(bbox, tileSize);
        console.log(`[${project.id}] ${tiles.length} ladrilho(s) em ${bbox.minLon.toFixed(3)},${bbox.minLat.toFixed(3)} .. ${bbox.maxLon.toFixed(3)},${bbox.maxLat.toFixed(3)}`);
        if (!apply) continue;
        for (const [index, tile] of tiles.entries()) {
            const json = await fetchOverpass(endpoints, buildOverpassQuery(tile));
            const roads = parseOverpassWays(json);
            await osmRoadRepository.upsertMany(roads);
            await osmRoadRepository.recordLoad({ ...tile, projectIds: [project.id], ways: roads.length });
            totalWays += roads.length;
            console.log(`[${project.id}] ladrilho ${index + 1}/${tiles.length}: ${roads.length} vias`);
            await sleep(2000); // gentileza com o servidor publico do Overpass
        }
    }
    console.log(apply ? `ok: ${totalWays} vias gravadas` : 'dry-run: nada gravado (use --apply)');
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});

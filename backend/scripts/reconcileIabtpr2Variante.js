'use strict';

// Reconciliacao one-off: substitui o trecho 604-644 da IABTPR2 pelas torres da variante
// (ITATPR_C2_VARIANTE_TORRES) e faz o backfill das tags de torre na curadoria (fotos,
// erosao e a vistoria de maio), conforme decisao do usuario. Ver
// .claude/plans/crystalline-growing-crayon.md.
//
// NAO conecta no banco: e um GERADOR de SQL. Recebe os dados atuais (project torres e payload
// da vistoria, capturados via psql) e emite uma transacao SQL idempotente. Por padrao termina
// em ROLLBACK (dry-run, com SELECTs de verificacao); com --commit termina em COMMIT.
//
//   node reconcileIabtpr2Variante.js \
//     --current-project tmp/project.json \
//     --current-inspection tmp/inspection.json \
//     [--commit] > tmp/reconcile.sql
//
// O resumo vai para stderr; o SQL para stdout.

const fs = require('node:fs');
const path = require('node:path');
const { TAG_MAP, remapTag, remapInspectionPayload } = require('./lib/remapTowerTags');

const PROJECT_ID = 'IABTPR2';
const WORKSPACE_ID = 'RW-1782133784072';
const INSPECTION_ID = 'VS-IABTPR2-07052026-0001';
const SEGMENT = { from: 604, to: 644 };
const VARIANTE_PATH = path.join(__dirname, 'data', 'variante-itatpr-c2-torres.json');
const ACTOR = 'reconcile-iabtpr2';

function parseArgs(argv) {
  const out = { commit: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--commit') out.commit = true;
    else if (a === '--current-project') out.project = argv[++i];
    else if (a === '--current-inspection') out.inspection = argv[++i];
    else throw new Error(`Argumento desconhecido: ${a}`);
  }
  if (!out.project || !out.inspection) {
    throw new Error('Uso: --current-project <json> --current-inspection <json> [--commit]');
  }
  return out;
}

function towerBase(numero) {
  const m = String(numero == null ? '' : numero).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function towerSuffix(numero) {
  const m = String(numero == null ? '' : numero).match(/^\D*\d+(.*)$/);
  return m ? m[1] : '';
}

function compareTowers(a, b) {
  const ba = towerBase(a.numero);
  const bb = towerBase(b.numero);
  if (ba !== bb) return (ba ?? Infinity) - (bb ?? Infinity);
  return towerSuffix(a.numero).localeCompare(towerSuffix(b.numero));
}

// dollar-quote seguro para literal jsonb
function dollar(tag, value) {
  const json = JSON.stringify(value);
  if (json.includes(`$${tag}$`)) throw new Error('Colisao de dollar-quote — troque o tag.');
  return `$${tag}$${json}$${tag}$::jsonb`;
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function main() {
  const args = parseArgs(process.argv);
  const stamp = new Date().toISOString();

  // 1. Torres da variante (artefato revisado) -> shape do banco { numero, origem, lat, lon }.
  const varianteRaw = JSON.parse(fs.readFileSync(VARIANTE_PATH, 'utf8')).towers;
  const varianteTowers = varianteRaw.map((t) => ({
    numero: String(t.numero),
    origem: 'kml',
    latitude: Number(t.latitude),
    longitude: Number(t.longitude),
  }));

  // 2. Torres atuais do projeto.
  const currentTowers = JSON.parse(fs.readFileSync(args.project, 'utf8'));
  if (!Array.isArray(currentTowers)) throw new Error('current-project deve ser um array de torres.');

  // 3. Remove o trecho [from,to] e concatena a variante.
  const removed = currentTowers.filter((t) => {
    const b = towerBase(t.numero);
    return b !== null && b >= SEGMENT.from && b <= SEGMENT.to;
  });
  const kept = currentTowers.filter((t) => {
    const b = towerBase(t.numero);
    return !(b !== null && b >= SEGMENT.from && b <= SEGMENT.to);
  });

  // Sanidade: nenhuma torre da variante colide com as mantidas.
  const keptSet = new Set(kept.map((t) => String(t.numero)));
  const collisions = varianteTowers.filter((t) => keptSet.has(String(t.numero)));
  if (collisions.length) {
    throw new Error(`Colisao variante x mantidas: ${collisions.map((t) => t.numero).join(', ')}`);
  }

  const newTowers = kept.concat(varianteTowers).sort(compareTowers);

  // 4. Sanidade: todos os destinos do TAG_MAP existem na variante.
  const varianteNums = new Set(varianteTowers.map((t) => String(t.numero)));
  const missingTargets = Object.values(TAG_MAP).filter((v) => !varianteNums.has(v));
  if (missingTargets.length) {
    throw new Error(`Destinos do mapa ausentes na variante: ${missingTargets.join(', ')}`);
  }

  // 5. Payload da vistoria remapeado.
  const inspectionPayload = JSON.parse(fs.readFileSync(args.inspection, 'utf8'));
  const { payload: newInspection, changes: inspChanges } = remapInspectionPayload(inspectionPayload);

  // ---- resumo (stderr) ----
  const log = (...m) => process.stderr.write(m.join(' ') + '\n');
  log(`[reconcile ${PROJECT_ID}] modo: ${args.commit ? 'APPLY (COMMIT)' : 'DRY-RUN (ROLLBACK)'}`);
  log(`torres atuais: ${currentTowers.length} | removidas no trecho ${SEGMENT.from}-${SEGMENT.to}: ${removed.length} | variante: ${varianteTowers.length} | novo total: ${newTowers.length}`);
  log(`removidas: ${removed.map((t) => t.numero).join(', ')}`);
  log(`backfill de tags (mapa): ${Object.entries(TAG_MAP).map(([k, v]) => `${k}->${v}`).join(', ')}`);
  log(`mudancas na vistoria ${INSPECTION_ID}: ${inspChanges.length}`);
  inspChanges.forEach((c) => log(`  - ${c}`));

  // VALUES para o backfill de fotos/erosoes (pula no-ops).
  const mapValues = Object.entries(TAG_MAP)
    .map(([k, v]) => `(${sqlStr(k)}, ${sqlStr(v)})`)
    .join(', ');

  // ---- SQL (stdout) ----
  const out = [];
  out.push('-- Reconciliacao IABTPR2 / variante ITATPR_C2 — gerado por reconcileIabtpr2Variante.js');
  out.push(`-- ${stamp} — ${args.commit ? 'APPLY' : 'DRY-RUN'}`);
  out.push('SET statement_timeout = 0;');
  out.push('BEGIN;');
  out.push('');
  out.push('-- 1) Projeto: troca torres do trecho pela variante (mantem linhaCoordenadas/restante)');
  out.push(`UPDATE projects SET payload = payload || jsonb_build_object(`);
  out.push(`  'torresCoordenadas', ${dollar('towers', newTowers)},`);
  out.push(`  'torres', ${sqlStr(String(newTowers.length))},`);
  out.push(`  'updatedAt', ${sqlStr(stamp)},`);
  out.push(`  'updatedBy', ${sqlStr(ACTOR)}`);
  out.push(`) WHERE id = ${sqlStr(PROJECT_ID)};`);
  out.push('');
  out.push('-- 2) Reconstroi project_geometries (mesma SQL de projectGeometryRepository.upsertFromProject)');
  out.push(geometryUpsertSql(PROJECT_ID));
  out.push('');
  out.push('-- 3) Backfill tags das fotos do workspace');
  out.push(`UPDATE report_photos rp SET tower_id = m.new_tag, updated_at = now(), updated_by = ${sqlStr(ACTOR)}`);
  out.push(`FROM (VALUES ${mapValues}) AS m(old_tag, new_tag)`);
  out.push(`WHERE rp.workspace_id = ${sqlStr(WORKSPACE_ID)} AND rp.tower_id = m.old_tag;`);
  out.push('');
  out.push('-- 4) Backfill torreRef das erosoes do projeto');
  out.push(`UPDATE erosions e SET payload = jsonb_set(e.payload, '{torreRef}', to_jsonb(m.new_tag::text)), updated_at = now(), updated_by = ${sqlStr(ACTOR)}`);
  out.push(`FROM (VALUES ${mapValues}) AS m(old_tag, new_tag)`);
  out.push(`WHERE e.project_id = ${sqlStr(PROJECT_ID)} AND e.payload->>'torreRef' = m.old_tag;`);
  out.push('');
  out.push('-- 5) Backfill payload da vistoria (remapeado em JS)');
  out.push(`UPDATE inspections SET payload = ${dollar('insp', newInspection)}, updated_at = now(), updated_by = ${sqlStr(ACTOR)}`);
  out.push(`WHERE id = ${sqlStr(INSPECTION_ID)};`);
  out.push('');
  out.push('-- 6) Verificacao (deve dar 0 sobras e os novos casando)');
  out.push(verificationSql());
  out.push('');
  out.push(args.commit ? 'COMMIT;' : 'ROLLBACK;');
  out.push('');

  process.stdout.write(out.join('\n'));
}

function geometryUpsertSql(projectId) {
  return `INSERT INTO project_geometries (project_id, axis, towers, updated_at)
SELECT p.id,
  (SELECT ST_MakeLine(ARRAY_AGG(pt ORDER BY ord)) FROM (
     SELECT ord, ST_SetSRID(ST_MakePoint((e->>'longitude')::float8, (e->>'latitude')::float8), 4326) AS pt
     FROM jsonb_array_elements(p.payload->'linhaCoordenadas') WITH ORDINALITY AS t(e, ord)
     WHERE (e->>'longitude') ~ '^-?[0-9]+(\\.[0-9]+)?$' AND (e->>'latitude') ~ '^-?[0-9]+(\\.[0-9]+)?$'
   ) s HAVING COUNT(*) >= 2)::geography AS axis,
  (SELECT ST_Multi(ST_Collect(ARRAY_AGG(pt))) FROM (
     SELECT ST_SetSRID(ST_MakePoint((e->>'longitude')::float8, (e->>'latitude')::float8), 4326) AS pt
     FROM jsonb_array_elements(p.payload->'torresCoordenadas') AS e
     WHERE (e->>'longitude') ~ '^-?[0-9]+(\\.[0-9]+)?$' AND (e->>'latitude') ~ '^-?[0-9]+(\\.[0-9]+)?$'
   ) s HAVING COUNT(*) >= 1)::geography AS towers,
  NOW()
FROM projects p WHERE p.id = ${sqlStr(projectId)}
ON CONFLICT (project_id) DO UPDATE SET axis = EXCLUDED.axis, towers = EXCLUDED.towers, updated_at = NOW();`;
}

function verificationSql() {
  const oldTags = Object.keys(TAG_MAP).map((k) => sqlStr(k)).join(', ');
  return `\\echo '== fotos com tag antiga remanescente (esperado 0) =='
SELECT count(*) AS fotos_tag_antiga FROM report_photos
WHERE workspace_id = ${sqlStr(WORKSPACE_ID)} AND tower_id IN (${oldTags});
\\echo '== erosoes com torreRef antigo (esperado 0) =='
SELECT count(*) AS erosoes_tag_antiga FROM erosions
WHERE project_id = ${sqlStr(PROJECT_ID)} AND payload->>'torreRef' IN (${oldTags});
\\echo '== total de torres do projeto e contagem do trecho variante =='
SELECT jsonb_array_length(payload->'torresCoordenadas') AS total_torres, payload->>'torres' AS torres_field
FROM projects WHERE id = ${sqlStr(PROJECT_ID)};
\\echo '== fotos por tag (pos-backfill) =='
SELECT tower_id, count(*) FROM report_photos
WHERE workspace_id = ${sqlStr(WORKSPACE_ID)} AND deleted_at IS NULL AND archived_at IS NULL
GROUP BY tower_id ORDER BY tower_id;`;
}

main();

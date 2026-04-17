const {
    postgresStore,
    normalizeText,
    normalizeKey,
    buildMetadata,
} = require('./common');

function hydratePhotoRow(row) {
    return buildMetadata(row.payload, row);
}

function normalizeBooleanQuery(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return null;
    if (['1', 'true', 'yes', 'sim'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nao'].includes(normalized)) return false;
    return null;
}

function parseDateBoundary(value, boundary = 'start') {
    const normalized = normalizeText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
    const suffix = boundary === 'end' ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const parsed = new Date(`${normalized}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPhotoFilterDate(photo = {}) {
    const rawValue = photo.captureAt || photo.createdAt || photo.updatedAt;
    if (!rawValue) return null;
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function listByWorkspace(workspaceId) {
    const normalizedWorkspaceId = normalizeText(workspaceId);
    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                   include_in_report, caption, capture_at, gps_lat, gps_lon,
                   inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                   distance_to_tower_m, curation_status, manual_override,
                   sort_order, import_source, payload, created_at, updated_at, updated_by
            FROM report_photos
            WHERE workspace_id = $1 AND deleted_at IS NULL AND archived_at IS NULL
            ORDER BY sort_order ASC, updated_at DESC, id ASC
        `,
        [normalizedWorkspaceId],
    );

    return result.rows.map((row) => hydratePhotoRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            workspaceId: row.workspace_id,
            projectId: row.project_id,
            mediaAssetId: row.media_asset_id,
            towerId: row.tower_id,
            towerSource: row.tower_source,
            includeInReport: row.include_in_report,
            caption: row.caption,
            captureAt: row.capture_at instanceof Date ? row.capture_at.toISOString() : row.capture_at,
            gpsLat: row.gps_lat,
            gpsLon: row.gps_lon,
            insideRightOfWay: row.inside_right_of_way,
            insideTowerRadius: row.inside_tower_radius,
            distanceToAxisM: row.distance_to_axis_m,
            distanceToTowerM: row.distance_to_tower_m,
            curationStatus: row.curation_status,
            manualOverride: row.manual_override,
            sortOrder: row.sort_order,
            importSource: row.import_source,
        },
    }));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                   include_in_report, caption, capture_at, gps_lat, gps_lon,
                   inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                   distance_to_tower_m, curation_status, manual_override,
                   sort_order, import_source, payload, created_at, updated_at, updated_by
            FROM report_photos
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydratePhotoRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            workspaceId: row.workspace_id,
            projectId: row.project_id,
            mediaAssetId: row.media_asset_id,
            towerId: row.tower_id,
            towerSource: row.tower_source,
            includeInReport: row.include_in_report,
            caption: row.caption,
            captureAt: row.capture_at instanceof Date ? row.capture_at.toISOString() : row.capture_at,
            gpsLat: row.gps_lat,
            gpsLon: row.gps_lon,
            insideRightOfWay: row.inside_right_of_way,
            insideTowerRadius: row.inside_tower_radius,
            distanceToAxisM: row.distance_to_axis_m,
            distanceToTowerM: row.distance_to_tower_m,
            curationStatus: row.curation_status,
            manualOverride: row.manual_override,
            sortOrder: row.sort_order,
            importSource: row.import_source,
        },
    });
}

async function listByProject(projectId, filters = {}) {
    const normalizedProjectId = normalizeKey(projectId);
    const workspaceId = normalizeText(filters.workspaceId);
    const towerId = normalizeText(filters.towerId);
    const importSource = normalizeText(filters.importSource);
    const captionQuery = normalizeText(filters.captionQuery).toLowerCase();
    const dateFrom = parseDateBoundary(filters.dateFrom, 'start');
    const dateTo = parseDateBoundary(filters.dateTo, 'end');
    const ids = String(filters.ids || '').split(',').map((value) => normalizeText(value)).filter(Boolean);

    const clauses = ['project_id = $1', 'deleted_at IS NULL'];
    const params = [normalizedProjectId];
    let index = 2;

    if (workspaceId) {
        clauses.push(`workspace_id = $${index++}`);
        params.push(workspaceId);
    }
    if (towerId) {
        clauses.push(`tower_id = $${index++}`);
        params.push(towerId);
    }
    if (importSource) {
        clauses.push(`LOWER(import_source) = LOWER($${index++})`);
        params.push(importSource);
    }
    const includedOnly = normalizeBooleanQuery(filters.includedOnly);
    if (includedOnly !== null) {
        clauses.push(`include_in_report = $${index++}`);
        params.push(includedOnly);
    }
    const captionMissing = normalizeBooleanQuery(filters.captionMissing);
    if (captionMissing === true) {
        clauses.push(`COALESCE(TRIM(caption), '') = ''`);
    } else if (captionMissing === false) {
        clauses.push(`COALESCE(TRIM(caption), '') <> ''`);
    }
    if (captionQuery) {
        clauses.push(`LOWER(COALESCE(caption, '')) LIKE $${index++}`);
        params.push(`%${captionQuery}%`);
    }
    if (dateFrom) {
        clauses.push(`COALESCE(capture_at, created_at, updated_at) >= $${index++}`);
        params.push(dateFrom.toISOString());
    }
    if (dateTo) {
        clauses.push(`COALESCE(capture_at, created_at, updated_at) <= $${index++}`);
        params.push(dateTo.toISOString());
    }
    if (ids.length > 0) {
        clauses.push(`id = ANY($${index++})`);
        params.push(ids);
    }

    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                   include_in_report, caption, capture_at, gps_lat, gps_lon,
                   inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                   distance_to_tower_m, curation_status, manual_override,
                   sort_order, import_source, payload, created_at, updated_at, updated_by
            FROM report_photos
            WHERE ${clauses.join(' AND ')}
            ORDER BY sort_order ASC, updated_at DESC, id ASC
        `,
        params,
    );

    return result.rows.map((row) => hydratePhotoRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            workspaceId: row.workspace_id,
            projectId: row.project_id,
            mediaAssetId: row.media_asset_id,
            towerId: row.tower_id,
            towerSource: row.tower_source,
            includeInReport: row.include_in_report,
            caption: row.caption,
            captureAt: row.capture_at instanceof Date ? row.capture_at.toISOString() : row.capture_at,
            gpsLat: row.gps_lat,
            gpsLon: row.gps_lon,
            insideRightOfWay: row.inside_right_of_way,
            insideTowerRadius: row.inside_tower_radius,
            distanceToAxisM: row.distance_to_axis_m,
            distanceToTowerM: row.distance_to_tower_m,
            curationStatus: row.curation_status,
            manualOverride: row.manual_override,
            sortOrder: row.sort_order,
            importSource: row.import_source,
        },
    }));
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
        workspaceId: normalizeText(payload?.workspaceId || current?.workspaceId),
        projectId: normalizeKey(payload?.projectId || current?.projectId),
    };

    await postgresStore.query(
        `
            INSERT INTO report_photos (
                id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                include_in_report, caption, capture_at, gps_lat, gps_lon,
                inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                distance_to_tower_m, curation_status, manual_override,
                sort_order, import_source, payload, created_at, updated_at, updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16, $17,
                $18, $19, $20::jsonb, NOW(), NOW(), $21
            )
            ON CONFLICT (id)
            DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                project_id = EXCLUDED.project_id,
                media_asset_id = EXCLUDED.media_asset_id,
                tower_id = EXCLUDED.tower_id,
                tower_source = EXCLUDED.tower_source,
                include_in_report = EXCLUDED.include_in_report,
                caption = EXCLUDED.caption,
                capture_at = EXCLUDED.capture_at,
                gps_lat = EXCLUDED.gps_lat,
                gps_lon = EXCLUDED.gps_lon,
                inside_right_of_way = EXCLUDED.inside_right_of_way,
                inside_tower_radius = EXCLUDED.inside_tower_radius,
                distance_to_axis_m = EXCLUDED.distance_to_axis_m,
                distance_to_tower_m = EXCLUDED.distance_to_tower_m,
                curation_status = EXCLUDED.curation_status,
                manual_override = EXCLUDED.manual_override,
                sort_order = EXCLUDED.sort_order,
                import_source = EXCLUDED.import_source,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            nextPayload.workspaceId,
            nextPayload.projectId,
            normalizeText(nextPayload.mediaAssetId) || null,
            normalizeText(nextPayload.towerId) || null,
            normalizeText(nextPayload.towerSource) || 'manual',
            Boolean(nextPayload.includeInReport),
            normalizeText(nextPayload.caption) || null,
            nextPayload.captureAt ? new Date(nextPayload.captureAt) : null,
            Number.isFinite(Number(nextPayload.gpsLat)) ? Number(nextPayload.gpsLat) : null,
            Number.isFinite(Number(nextPayload.gpsLon)) ? Number(nextPayload.gpsLon) : null,
            nextPayload.insideRightOfWay === true,
            nextPayload.insideTowerRadius === true,
            Number.isFinite(Number(nextPayload.distanceToAxisM)) ? Number(nextPayload.distanceToAxisM) : null,
            Number.isFinite(Number(nextPayload.distanceToTowerM)) ? Number(nextPayload.distanceToTowerM) : null,
            normalizeText(nextPayload.curationStatus) || 'draft',
            nextPayload.manualOverride === true,
            Number.isFinite(Number(nextPayload.sortOrder)) ? Number(nextPayload.sortOrder) : 0,
            normalizeText(nextPayload.importSource) || 'manual',
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

async function countByProject(projectId) {
    const normalizedProjectId = normalizeKey(projectId);
    const result = await postgresStore.query(
        'SELECT COUNT(*)::int AS count FROM report_photos WHERE project_id = $1 AND deleted_at IS NULL',
        [normalizedProjectId],
    );
    return result.rows[0]?.count || 0;
}

async function batchUpdateSortOrder(updates = []) {
    const valid = updates.filter((u) => normalizeText(u.id) && Number.isFinite(Number(u.sortOrder)));
    if (valid.length === 0) return 0;

    const values = valid.map((u, i) => `($${i * 2 + 1}::text, $${i * 2 + 2}::integer)`).join(', ');
    const params = valid.flatMap((u) => [normalizeText(u.id), Number(u.sortOrder)]);

    const result = await postgresStore.query(
        `
            UPDATE report_photos AS rp
            SET sort_order = v.new_order, updated_at = NOW()
            FROM (VALUES ${values}) AS v(id, new_order)
            WHERE rp.id = v.id
        `,
        params,
    );
    return result.rowCount || 0;
}

function hydratePhotoRowFromPg(row) {
    return hydratePhotoRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            workspaceId: row.workspace_id,
            projectId: row.project_id,
            mediaAssetId: row.media_asset_id,
            towerId: row.tower_id,
            towerSource: row.tower_source,
            includeInReport: row.include_in_report,
            caption: row.caption,
            captureAt: row.capture_at instanceof Date ? row.capture_at.toISOString() : row.capture_at,
            gpsLat: row.gps_lat,
            gpsLon: row.gps_lon,
            insideRightOfWay: row.inside_right_of_way,
            insideTowerRadius: row.inside_tower_radius,
            distanceToAxisM: row.distance_to_axis_m,
            distanceToTowerM: row.distance_to_tower_m,
            curationStatus: row.curation_status,
            manualOverride: row.manual_override,
            sortOrder: row.sort_order,
            importSource: row.import_source,
            deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : (row.deleted_at || null),
            archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : (row.archived_at || null),
        },
    });
}

async function listTrashedByWorkspace(workspaceId) {
    const normalizedWorkspaceId = normalizeText(workspaceId);
    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                   include_in_report, caption, capture_at, gps_lat, gps_lon,
                   inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                   distance_to_tower_m, curation_status, manual_override,
                   sort_order, import_source, deleted_at, archived_at, payload, created_at, updated_at, updated_by
            FROM report_photos
            WHERE workspace_id = $1 AND deleted_at IS NOT NULL AND archived_at IS NULL
            ORDER BY deleted_at DESC, id ASC
        `,
        [normalizedWorkspaceId],
    );

    return result.rows.map(hydratePhotoRowFromPg);
}

async function listArchivedByProject(projectId) {
    const normalizedProjectId = normalizeText(projectId);
    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                   include_in_report, caption, capture_at, gps_lat, gps_lon,
                   inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                   distance_to_tower_m, curation_status, manual_override,
                   sort_order, import_source, deleted_at, archived_at, payload, created_at, updated_at, updated_by
            FROM report_photos
            WHERE project_id = $1 AND archived_at IS NOT NULL
            ORDER BY archived_at DESC, id ASC
        `,
        [normalizedProjectId],
    );
    return result.rows.map(hydratePhotoRowFromPg);
}

async function softDelete(photoId) {
    const normalizedId = normalizeText(photoId);
    await postgresStore.query(
        'UPDATE report_photos SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
        [normalizedId],
    );
    return getById(normalizedId);
}

async function restore(photoId) {
    const normalizedId = normalizeText(photoId);
    await postgresStore.query(
        'UPDATE report_photos SET deleted_at = NULL, updated_at = NOW() WHERE id = $1',
        [normalizedId],
    );
    return getById(normalizedId);
}

// Arquiva uma foto da lixeira. Apenas fotos ja em lixeira podem ser
// arquivadas. Retorna null se a foto nao estiver em estado lixeira.
async function archive(photoId) {
    const normalizedId = normalizeText(photoId);
    const result = await postgresStore.query(
        `
            UPDATE report_photos
            SET archived_at = NOW(), deleted_at = NULL, updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NOT NULL AND archived_at IS NULL
            RETURNING id
        `,
        [normalizedId],
    );
    if (result.rowCount === 0) return null;
    return getById(normalizedId);
}

// Devolve foto arquivada para a lixeira. Bloqueia se a foto nao estiver
// arquivada.
async function unarchiveToTrash(photoId) {
    const normalizedId = normalizeText(photoId);
    const result = await postgresStore.query(
        `
            UPDATE report_photos
            SET archived_at = NULL, deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND archived_at IS NOT NULL
            RETURNING id
        `,
        [normalizedId],
    );
    if (result.rowCount === 0) return null;
    return getById(normalizedId);
}

// Arquiva em lote fotos da lixeira mais antigas que N dias. Retorna a
// quantidade efetivamente movida.
async function archiveOlderThanDays(workspaceId, days) {
    const normalizedWorkspaceId = normalizeText(workspaceId);
    const daysNum = Number.isInteger(Number(days)) ? Number(days) : 30;
    const result = await postgresStore.query(
        `
            UPDATE report_photos
            SET archived_at = NOW(), deleted_at = NULL, updated_at = NOW()
            WHERE workspace_id = $1
              AND deleted_at IS NOT NULL
              AND archived_at IS NULL
              AND deleted_at < NOW() - ($2 || ' days')::interval
            RETURNING id
        `,
        [normalizedWorkspaceId, String(daysNum)],
    );
    return { count: result.rowCount || 0 };
}

async function removeAllTrashed(workspaceId) {
    const normalizedWorkspaceId = normalizeText(workspaceId);
    const result = await postgresStore.query(
        `
            DELETE FROM report_photos
            WHERE workspace_id = $1 AND deleted_at IS NOT NULL AND archived_at IS NULL
            RETURNING id, media_asset_id, payload
        `,
        [normalizedWorkspaceId],
    );
    return result.rows.map((row) => ({
        id: row.id,
        mediaAssetId: row.media_asset_id || (row.payload && row.payload.mediaAssetId) || null,
    }));
}

module.exports = {
    listByWorkspace,
    listTrashedByWorkspace,
    listArchivedByProject,
    getById,
    listByProject,
    save,
    softDelete,
    restore,
    archive,
    unarchiveToTrash,
    archiveOlderThanDays,
    removeAllTrashed,
    countByProject,
    batchUpdateSortOrder,
};

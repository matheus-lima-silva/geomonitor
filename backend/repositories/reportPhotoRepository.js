const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    normalizeKey,
    getFirestoreDoc,
    listFirestoreDocs,
    saveFirestoreDoc,
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

async function listByWorkspace(workspaceId) {
    const normalizedWorkspaceId = normalizeText(workspaceId);
    if (!isPostgresBackend()) {
        const rows = await listFirestoreDocs('reportPhotos');
        return rows.filter((row) => normalizeText(row.workspaceId) === normalizedWorkspaceId);
    }

    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, project_id, media_asset_id, tower_id, tower_source,
                   include_in_report, caption, capture_at, gps_lat, gps_lon,
                   inside_right_of_way, inside_tower_radius, distance_to_axis_m,
                   distance_to_tower_m, curation_status, manual_override,
                   sort_order, import_source, payload, created_at, updated_at, updated_by
            FROM report_photos
            WHERE workspace_id = $1
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
    if (!isPostgresBackend()) {
        return getFirestoreDoc('reportPhotos', normalizedId);
    }

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
    if (!isPostgresBackend()) {
        const rows = await listFirestoreDocs('reportPhotos');
        return rows
            .filter((row) => normalizeKey(row.projectId) === normalizedProjectId)
            .filter((row) => !filters.workspaceId || normalizeText(row.workspaceId) === normalizeText(filters.workspaceId))
            .filter((row) => !filters.towerId || normalizeText(row.towerId) === normalizeText(filters.towerId))
            .filter((row) => !filters.importSource || normalizeText(row.importSource).toLowerCase() === normalizeText(filters.importSource).toLowerCase())
            .filter((row) => {
                const includedOnly = normalizeBooleanQuery(filters.includedOnly);
                return includedOnly === null ? true : Boolean(row.includeInReport) === includedOnly;
            })
            .filter((row) => {
                const captionMissing = normalizeBooleanQuery(filters.captionMissing);
                return captionMissing === null ? true : (captionMissing ? !normalizeText(row.caption) : Boolean(normalizeText(row.caption)));
            })
            .filter((row) => {
                const ids = String(filters.ids || '').split(',').map((value) => normalizeText(value)).filter(Boolean);
                return ids.length === 0 ? true : ids.includes(normalizeText(row.id));
            });
    }

    const clauses = ['project_id = $1'];
    const params = [normalizedProjectId];
    let index = 2;

    if (filters.workspaceId) {
        clauses.push(`workspace_id = $${index++}`);
        params.push(normalizeText(filters.workspaceId));
    }
    if (filters.towerId) {
        clauses.push(`tower_id = $${index++}`);
        params.push(normalizeText(filters.towerId));
    }
    if (filters.importSource) {
        clauses.push(`LOWER(import_source) = LOWER($${index++})`);
        params.push(normalizeText(filters.importSource));
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
    const ids = String(filters.ids || '').split(',').map((value) => normalizeText(value)).filter(Boolean);
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

    if (!isPostgresBackend()) {
        return saveFirestoreDoc('reportPhotos', normalizedId, nextPayload, options);
    }

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
    if (!isPostgresBackend()) {
        const rows = await listByProject(normalizedProjectId);
        return rows.length;
    }

    const result = await postgresStore.query(
        'SELECT COUNT(*)::int AS count FROM report_photos WHERE project_id = $1',
        [normalizedProjectId],
    );
    return result.rows[0]?.count || 0;
}

module.exports = {
    listByWorkspace,
    getById,
    listByProject,
    save,
    countByProject,
};

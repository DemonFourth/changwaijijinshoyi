/**
 * Sync Repository - D1 同步数据访问层
 * 提供 pull / push 的数据读写操作
 *
 * 单用户模式：默认 user_id = 'default'
 * 多用户预留：所有操作都支持 user_id 参数
 */

/**
 * 获取云端快照（用于 pull）
 * @param {Object} env - Pages Functions 的环境对象（含 env.DB）
 * @param {string} userId - 用户标识（默认 'default'）
 * @returns {Promise<Object>} 快照数据
 */
export async function getSnapshot(env, userId = 'default') {
    if (!env.DB) {
        return { revision: 0, funds: [], trades: [], sync_meta: null, updated_at: null };
    }

    const result = await env.DB.prepare(`
        SELECT revision, funds_json, trades_json, sync_meta_json, updated_at
        FROM app_snapshot
        WHERE id = 'main' AND user_id = ?
    `).bind(userId).first();

    if (!result) {
        return { revision: 0, funds: [], trades: [], sync_meta: null, updated_at: null };
    }

    return {
        revision: result.revision,
        funds: JSON.parse(result.funds_json || '[]'),
        trades: JSON.parse(result.trades_json || '[]'),
        sync_meta: result.sync_meta_json ? JSON.parse(result.sync_meta_json) : null,
        updated_at: result.updated_at
    };
}

/**
 * 更新云端快照（用于 push），含乐观并发控制
 * @param {Object} env - Pages Functions 的环境对象（含 env.DB）
 * @param {Object} payload - { funds, trades, sync_meta? }
 * @param {string} userId - 用户标识（默认 'default'）
 * @returns {Promise<Object>} { success, revision, error? }
 */
export async function updateSnapshot(env, payload, userId = 'default') {
    if (!env.DB) {
        return { success: false, error: 'DB not available' };
    }

    const { funds, trades, sync_meta } = payload;

    // 乐观并发：先获取当前 revision
    const current = await env.DB.prepare(`
        SELECT revision FROM app_snapshot WHERE id = 'main' AND user_id = ?
    `).bind(userId).first();

    const currentRevision = current && current.revision !== undefined ? current.revision : 0;
    const newRevision = currentRevision + 1;
    const serializedFunds = JSON.stringify(funds);
    const serializedTrades = JSON.stringify(trades);
    const serializedSyncMeta = sync_meta ? JSON.stringify(sync_meta) : null;

    if (!current) {
        await env.DB.prepare(`
            INSERT INTO app_snapshot (id, user_id, revision, funds_json, trades_json, sync_meta_json, updated_at)
            VALUES ('main', ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
            userId,
            newRevision,
            serializedFunds,
            serializedTrades,
            serializedSyncMeta
        ).run();
        return { success: true, revision: newRevision };
    }

    const result = await env.DB.prepare(`
        UPDATE app_snapshot
        SET revision = ?,
            funds_json = ?,
            trades_json = ?,
            sync_meta_json = ?,
            updated_at = datetime('now')
        WHERE id = 'main' AND user_id = ? AND revision = ?
    `).bind(
        newRevision,
        serializedFunds,
        serializedTrades,
        serializedSyncMeta,
        userId,
        currentRevision
    ).run();

    // 乐观锁检查：如果 affectedRows === 0，说明有其他写入并发
    if (result.meta && result.meta.changes === 0) {
        return { success: false, error: 'optimistic_lock_conflict', revision: newRevision };
    }

    return { success: true, revision: newRevision };
}

/**
 * 获取增量变更（用于增量 pull）
 * @param {Object} env - Pages Functions 的环境对象（含 env.DB）
 * @param {number} sinceRevision - 起始 revision
 * @param {string} userId - 用户标识（默认 'default'）
 * @returns {Promise<Object>} { changes, full: boolean } changes 为变更数组，full=true 表示返回了全量快照
 */
export async function getChangesSince(env, sinceRevision, userId = 'default') {
    if (!env.DB || !sinceRevision || sinceRevision <= 0) {
        return { changes: null, full: true };
    }

    try {
        const rows = await env.DB.prepare(`
            SELECT revision, entity_type, sync_id, operation, payload_json, created_at
            FROM change_log
            WHERE revision > ? AND user_id = ?
            ORDER BY revision ASC, id ASC
        `).bind(sinceRevision, userId).all();

        if (rows && rows.results && rows.results.length > 0) {
            return {
                changes: rows.results.map(function (row) {
                    return {
                        revision: row.revision,
                        entityType: row.entity_type,
                        syncId: row.sync_id,
                        operation: row.operation,
                        payload: row.payload_json ? JSON.parse(row.payload_json) : null,
                        createdAt: row.created_at
                    };
                }),
                full: false
            };
        }
    } catch (error) {
        console.error('[SyncRepository] getChangesSince error:', error.message);
    }

    return { changes: null, full: true };
}

/**
 * 记录变更日志（可选，最简版可不调用）
 * @param {Object} env - Pages Functions 的环境对象（含 env.DB）
 * @param {number} revision - revision 号
 * @param {Array} entities - 变更的实体数组
 * @param {string} entityType - 'fund' | 'trade'
 * @param {string} operation - 'upsert' | 'delete'
 * @param {string} userId - 用户标识（默认 'default'）
 */
export async function appendChangeLogs(env, revision, entities, entityType, operation, userId = 'default') {
    if (!env.DB || !entities || entities.length === 0) {
        return;
    }

    for (const entity of entities) {
        await env.DB.prepare(`
            INSERT INTO change_log (revision, user_id, entity_type, sync_id, operation, payload_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            revision,
            userId,
            entityType,
            entity.syncId || null,
            operation,
            JSON.stringify(entity)
        ).run();
    }
}

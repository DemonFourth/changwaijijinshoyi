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
 * 更新云端快照（用于 push）
 * @param {Object} env - Pages Functions 的环境对象（含 env.DB）
 * @param {Object} payload - { funds, trades, sync_meta? }
 * @param {string} userId - 用户标识（默认 'default'）
 * @returns {Promise<number>} 新 revision
 */
export async function updateSnapshot(env, payload, userId = 'default') {
    if (!env.DB) {
        return 0;
    }

    const { funds, trades, sync_meta } = payload;

    // 乐观并发：先获取当前 revision
    const current = await env.DB.prepare(`
        SELECT revision FROM app_snapshot WHERE id = 'main' AND user_id = ?
    `).bind(userId).first();

    const newRevision = (current && current.revision !== undefined ? current.revision : 0) + 1;
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
        return newRevision;
    }

    await env.DB.prepare(`
        UPDATE app_snapshot
        SET revision = ?,
            funds_json = ?,
            trades_json = ?,
            sync_meta_json = ?,
            updated_at = datetime('now')
        WHERE id = 'main' AND user_id = ?
    `).bind(
        newRevision,
        serializedFunds,
        serializedTrades,
        serializedSyncMeta,
        userId
    ).run();

    return newRevision;
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

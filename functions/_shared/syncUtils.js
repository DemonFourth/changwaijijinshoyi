/**
 * Sync Utils - 同步辅助工具
 * 冲突检测、响应包装等通用函数
 */

const TIMESTAMP_FIELDS = new Set([
    'updatedAt', 'createdAt', 'deletedAt', 'lastSyncedAt',
    'updateTime', 'createTime', 'deleteTime'
]);

const SYNC_DYNAMIC_FIELDS = new Set([
    'netValue', 'netValueDate', 'estimatedValue', 'estimatedGrowth',
    'estimatedDate', 'nameSource', 'nameUpdateTime'
]);

function stableStringify(obj) {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) {
        return JSON.stringify(k) + ':' + stableStringify(obj[k]);
    }).join(',') + '}';
}

function isDataChanged(local, cloud, entityType) {
    const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    for (const key of keys) {
        if (TIMESTAMP_FIELDS.has(key)) continue;
        if (SYNC_DYNAMIC_FIELDS.has(key)) continue;
        if (key === 'syncId' || key === 'id') continue;
        if (stableStringify(local[key]) !== stableStringify(cloud[key])) return true;
    }
    return false;
}

/**
 * 校验实体数组的合法性
 * @param {Array} funds - 基金数组
 * @param {Array} trades - 交易数组
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEntities(funds, trades) {
    const errors = [];
    if (!Array.isArray(funds)) {
        errors.push('funds must be an array');
    } else {
        for (const f of funds) {
            if (!f.syncId) errors.push('fund missing syncId: ' + (f.code || 'unknown'));
            if (!f.code) errors.push('fund missing code: ' + (f.syncId || 'unknown'));
            if (!f.name) errors.push('fund missing name: ' + (f.syncId || 'unknown'));
        }
    }
    if (!Array.isArray(trades)) {
        errors.push('trades must be an array');
    } else {
        for (const t of trades) {
            if (!t.syncId) errors.push('trade missing syncId');
            if (!t.fundId) errors.push('trade missing fundId: ' + (t.syncId || 'unknown'));
            if (!t.type) errors.push('trade missing type: ' + (t.syncId || 'unknown'));
        }
    }
    return { valid: errors.length === 0, errors };
}

/**
 * 检测本地与云端数据的冲突
 * 规则：同一实体在 30 天内都被修改过，且实际业务数据有差异，才视为冲突
 *
 * @param {Array} local - 本地实体数组
 * @param {Array} cloud - 云端实体数组
 * @returns {Array} 冲突列表
 */
export function detectConflicts(local, cloud) {
    const conflicts = [];
    const cloudMap = new Map(cloud.map(c => [c.syncId, c]));
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const localEntity of local) {
        const cloudEntity = cloudMap.get(localEntity.syncId);
        if (!cloudEntity) continue;

        const localTime = new Date(localEntity.updatedAt).getTime();
        const cloudTime = new Date(cloudEntity.updatedAt).getTime();
        const localLastSynced = localEntity.lastSyncedAt ? new Date(localEntity.lastSyncedAt).getTime() : 0;
        const cloudLastSynced = cloudEntity.lastSyncedAt ? new Date(cloudEntity.lastSyncedAt).getTime() : 0;

        // lastSyncedAt=0 表示从未同步，不视为"有变更"
        const localModifiedAfterSync = localLastSynced > 0 && localTime > localLastSynced;
        const cloudModifiedAfterSync = cloudLastSynced > 0 && cloudTime > cloudLastSynced;

        if (localModifiedAfterSync && cloudModifiedAfterSync) {
            if (!isDataChanged(localEntity, cloudEntity)) continue;
            conflicts.push({
                entityType: localEntity.entityType || (localEntity.fundId ? 'trade' : 'fund'),
                syncId: localEntity.syncId,
                local: localEntity,
                cloud: cloudEntity
            });
        } else if (localTime > thirtyDaysAgo && cloudTime > thirtyDaysAgo && localTime !== cloudTime) {
            // 首次同步兜底：30 天阈值内且有实际数据差异
            if (!isDataChanged(localEntity, cloudEntity)) continue;
            conflicts.push({
                entityType: localEntity.entityType || (localEntity.fundId ? 'trade' : 'fund'),
                syncId: localEntity.syncId,
                local: localEntity,
                cloud: cloudEntity
            });
        }
    }

    return conflicts;
}

/**
 * 创建 JSON 响应（支持 CORS 反射 Origin）
 * @param {Object} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @param {Request} [request] - 请求对象（用于反射 Origin）
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, request) {
    const origin = request ? request.headers.get('Origin') : null;
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, X-API-Key'
    };
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Vary'] = 'Origin';
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }
    return new Response(JSON.stringify(data), {
        status,
        headers
    });
}

/**
 * 处理 OPTIONS 预检请求（支持 CORS 反射 Origin）
 * @param {Request} [request] - 请求对象（用于反射 Origin）
 * @returns {Response}
 */
export function handleOptions(request) {
    const origin = request ? request.headers.get('Origin') : null;
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, X-API-Key'
    };
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Vary'] = 'Origin';
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }
    return new Response(null, { headers });
}

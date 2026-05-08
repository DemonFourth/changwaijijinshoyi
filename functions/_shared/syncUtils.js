/**
 * Sync Utils - 同步辅助工具
 * 冲突检测、响应包装等通用函数
 */

/**
 * 检测本地与云端数据的冲突
 * 规则：同一实体在 30 天内都被修改过，视为潜在冲突
 *
 * @param {Array} local - 本地实体数组
 * @param {Array} cloud - 云端实体数组
 * @returns {Array} 冲突列表
 */
export function detectConflicts(local, cloud) {
    const conflicts = [];
    const cloudMap = new Map(cloud.map(c => [c.syncId, c]));

    // 30 天前的时间戳
    const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const localEntity of local) {
        const cloudEntity = cloudMap.get(localEntity.syncId);
        if (!cloudEntity) continue;

        const localTime = new Date(localEntity.updatedAt).getTime();
        const cloudTime = new Date(cloudEntity.updatedAt).getTime();

        if (localTime > baseTime && cloudTime > baseTime && localTime !== cloudTime) {
            conflicts.push({
                entityType: localEntity.fundId ? 'trade' : 'fund',
                syncId: localEntity.syncId,
                local: localEntity,
                cloud: cloudEntity
            });
        }
    }

    return conflicts;
}

/**
 * 创建 JSON 响应
 * @param {Object} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @returns {Response}
 */
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Cookie'
        }
    });
}

/**
 * 处理 OPTIONS 预检请求
 * @returns {Response}
 */
export function handleOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Cookie'
        }
    });
}

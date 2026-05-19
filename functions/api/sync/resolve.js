/**
 * Cloudflare Pages Function - /api/sync/resolve
 * 解决同步冲突后重新写入云端
 *
 * Body:
 *   deviceId - 设备标识
 *   baseRevision - 客户端当前 revision
 *   conflicts - 冲突列表
 *   resolution - 解决策略数组（每个冲突选 'cloud' 或 'local'）
 */

import { ensureTables } from '../../_shared/d1Schema.js';
import { getSnapshot, updateSnapshot } from '../../_shared/syncRepository.js';
import { jsonResponse } from '../../_shared/syncUtils.js';
import { checkApiKey, unauthorizedResponse, badRequestResponse } from '../../_shared/authMiddleware.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return jsonResponse({}, 200, request);
    }

    // 鉴权：冲突解决需要 X-Sync-Key
    if (!checkApiKey(env, request)) {
        return unauthorizedResponse('Invalid or missing X-Sync-Key');
    }

    try {
        // 确保表存在
        await ensureTables(env);

        const body = await request.json();
        const { conflicts, resolution, baseRevision } = body;

        // 输入验证
        if (!Array.isArray(conflicts) || conflicts.length === 0) {
            return badRequestResponse('conflicts must be a non-empty array');
        }
        if (!Array.isArray(resolution) || resolution.length !== conflicts.length) {
            return badRequestResponse('resolution must match conflicts length');
        }
        for (const choice of resolution) {
            if (choice !== 'cloud' && choice !== 'local') {
                return badRequestResponse('each resolution must be "cloud" or "local"');
            }
        }
        for (const conflict of conflicts) {
            if (!conflict.syncId || !conflict.entityType) {
                return badRequestResponse('each conflict must have syncId and entityType');
            }
        }

        // 获取当前云端数据
        const current = await getSnapshot(env, 'default');

        // baseRevision 检查：如果云端已变化，拒绝解决
        if (baseRevision !== undefined && current.revision !== baseRevision) {
            return jsonResponse({
                success: false,
                conflict: true,
                error: 'revision_mismatch',
                message: 'Cloud data has changed since conflict detection. Please pull latest data first.'
            }, 409, request);
        }

        let funds = [...current.funds];
        let trades = [...current.trades];

        // 应用解决策略
        for (let i = 0; i < conflicts.length; i++) {
            const conflict = conflicts[i];
            const choice = resolution && resolution[i] === 'cloud' ? conflict.cloud : conflict.local;

            if (conflict.entityType === 'fund') {
                funds = funds.filter(f => f.syncId !== conflict.syncId);
                if (choice) funds.push(choice);
            } else {
                trades = trades.filter(t => t.syncId !== conflict.syncId);
                if (choice) trades.push(choice);
            }
        }

        // 更新快照
        const updateResult = await updateSnapshot(env, { funds, trades }, 'default');
        if (!updateResult.success) {
            return jsonResponse({
                success: false,
                error: updateResult.error
            }, 409, request);
        }

        return jsonResponse({
            success: true,
            revision: updateResult.revision
        }, 200, request);
    } catch (error) {
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, request);
    }
};

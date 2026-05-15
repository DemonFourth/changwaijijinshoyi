/**
 * Cloudflare Pages Function - /api/sync/push
 * 推送本地数据到云端
 *
 * Body:
 *   deviceId - 设备标识
 *   baseRevision - 客户端当前 revision
 *   funds - 基金数组
 *   trades - 交易数组
 */

import { ensureTables } from '../../_shared/d1Schema.js';
import { getSnapshot, updateSnapshot, appendChangeLogs } from '../../_shared/syncRepository.js';
import { detectConflicts, jsonResponse } from '../../_shared/syncUtils.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return jsonResponse({});
    }

    try {
        // 确保表存在（空库自动建表）
        await ensureTables(env);

        const body = await request.json();
        const { deviceId, baseRevision, funds, trades, source } = body;

        // 乐观并发检查
        const current = await getSnapshot(env, 'default');

        if (current.revision !== baseRevision && source !== 'import') {
            // 版本不一致，检测冲突
            const conflicts = detectConflicts(funds, current.funds);
            const tradeConflicts = detectConflicts(trades, current.trades);

            if (conflicts.length > 0 || tradeConflicts.length > 0) {
                return jsonResponse({
                    success: false,
                    conflict: true,
                    conflicts: [...conflicts, ...tradeConflicts]
                });
            }
        }

        // 写入新快照
        const newRevision = await updateSnapshot(env, { funds, trades }, 'default');

        // 记录变更日志（可选）
        await appendChangeLogs(env, newRevision, funds, 'fund', 'upsert', 'default');
        await appendChangeLogs(env, newRevision, trades, 'trade', 'upsert', 'default');

        return jsonResponse({
            success: true,
            revision: newRevision
        });
    } catch (error) {
        return jsonResponse({
            success: false,
            error: error.message
        }, 500);
    }
};

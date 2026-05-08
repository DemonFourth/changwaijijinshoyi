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

export const onRequest = async (context) => {
    const { request, env } = context;

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return jsonResponse({});
    }

    try {
        // 确保表存在
        await ensureTables(env);

        const body = await request.json();
        const { conflicts, resolution } = body;

        // 获取当前云端数据
        const current = await getSnapshot(env, 'default');

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
        const newRevision = await updateSnapshot(env, { funds, trades }, 'default');

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

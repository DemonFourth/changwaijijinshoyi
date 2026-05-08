/**
 * Cloudflare Pages Function - /api/sync/pull
 * 拉取云端数据快照
 *
 * Query params:
 *   deviceId - 设备标识
 *   cloudRevision - 客户端当前 revision
 *   lastPulledAt - 上次拉取时间
 */

import { ensureTables } from '../../_shared/d1Schema.js';
import { getSnapshot } from '../../_shared/syncRepository.js';
import { jsonResponse } from '../../_shared/syncUtils.js';

export const onRequest = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return jsonResponse({});
    }

    try {
        // 确保表存在（空库自动建表）
        await ensureTables(env);

        const deviceId = url.searchParams.get('deviceId') || '';
        const cloudRevision = parseInt(url.searchParams.get('cloudRevision') || '0', 10);

        // 获取云端快照
        const snapshot = await getSnapshot(env, 'default');

        return jsonResponse({
            success: true,
            revision: snapshot.revision,
            funds: snapshot.funds,
            trades: snapshot.trades,
            serverTime: snapshot.updated_at
        });
    } catch (error) {
        return jsonResponse({
            success: false,
            error: error.message
        }, 500);
    }
};

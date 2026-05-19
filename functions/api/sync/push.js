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
import { detectConflicts, jsonResponse, validateEntities } from '../../_shared/syncUtils.js';
import { checkApiKey, unauthorizedResponse } from '../../_shared/authMiddleware.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return jsonResponse({}, 200, request);
    }

    // 鉴权：所有写操作需要 X-Sync-Key
    if (!checkApiKey(env, request)) {
        return unauthorizedResponse('Invalid or missing X-Sync-Key');
    }

    try {
        // 确保表存在（空库自动建表）
        await ensureTables(env);

        // 请求体大小限制：1MB
        const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
        if (contentLength > 1048576) {
            return jsonResponse({
                success: false,
                error: 'payload_too_large',
                message: 'Request body exceeds 1MB limit'
            }, 413, request);
        }

        const body = await request.json();
        const { deviceId, baseRevision, funds, trades } = body;

        // 输入验证
        const validation = validateEntities(funds, trades);
        if (!validation.valid) {
            return jsonResponse({
                success: false,
                error: 'validation_failed',
                details: validation.errors
            }, 400, request);
        }

        // 乐观并发检查
        const current = await getSnapshot(env, 'default');

        if (current.revision !== baseRevision) {
            // 版本不一致，检测冲突
            const conflicts = detectConflicts(funds, current.funds);
            const tradeConflicts = detectConflicts(trades, current.trades);

            if (conflicts.length > 0 || tradeConflicts.length > 0) {
                return jsonResponse({
                    success: false,
                    conflict: true,
                    conflicts: [...conflicts, ...tradeConflicts]
                }, 200, request);
            }

            // 版本不一致但无冲突：合并云端独有的实体到客户端数据
            const clientFundIds = new Set((funds || []).map(f => f.syncId));
            const clientTradeIds = new Set((trades || []).map(t => t.syncId));

            for (const cloudFund of (current.funds || [])) {
                if (!clientFundIds.has(cloudFund.syncId)) {
                    funds.push(cloudFund);
                }
            }
            for (const cloudTrade of (current.trades || [])) {
                if (!clientTradeIds.has(cloudTrade.syncId)) {
                    trades.push(cloudTrade);
                }
            }
        }

        // 写入新快照
        const updateResult = await updateSnapshot(env, { funds, trades }, 'default');
        if (!updateResult.success) {
            return jsonResponse({
                success: false,
                conflict: true,
                error: updateResult.error,
                conflicts: []
            }, 409, request);
        }

        // 记录变更日志（可选）
        await appendChangeLogs(env, updateResult.revision, funds, 'fund', 'upsert', 'default');
        await appendChangeLogs(env, updateResult.revision, trades, 'trade', 'upsert', 'default');

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

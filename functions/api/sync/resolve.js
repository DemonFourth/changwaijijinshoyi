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
import { badRequestResponse } from '../../_shared/authMiddleware.js';

/**
 * 深度清理对象，移除所有 undefined 值
 * 防止 undefined 值导致 JSON 序列化异常或 D1 写入错误
 * 同时保护特殊类型（Date/RegExp/Map/Set 等）不被错误转换
 * @param {any} obj - 待清理的对象
 * @returns {any} 清理后的对象
 */
function cleanEntity(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => cleanEntity(item)).filter(item => item !== undefined);
    }
    // 保护特殊类型：Date, RegExp, Map, Set 等直接返回原值，避免被当作普通对象处理
    if (obj instanceof Date || obj instanceof RegExp || obj instanceof Map || obj instanceof Set) {
        return obj;
    }
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanedValue = cleanEntity(value);
            if (cleanedValue !== undefined) {
                cleaned[key] = cleanedValue;
            }
        }
        return cleaned;
    }
    return obj;
}

export const onRequest = async (context) => {
    const { request, env } = context;

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return jsonResponse({}, 200, request);
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
            // 先检查 conflict 元素本身是否为有效对象，防止 null/undefined 元素导致 TypeError
            if (!conflict || typeof conflict !== 'object') {
                return badRequestResponse('each conflict must be a valid object');
            }
            if (!conflict.syncId || !conflict.entityType) {
                return badRequestResponse('each conflict must have syncId and entityType');
            }
            // 检查 cloud/local 数据是否存在且有效
            if (conflict.cloud && typeof conflict.cloud !== 'object') {
                return badRequestResponse('conflict.cloud must be an object or null');
            }
            if (conflict.local && typeof conflict.local !== 'object') {
                return badRequestResponse('conflict.local must be an object or null');
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
            // 清理 undefined 值，防止 D1 写入错误
            const cleanedChoice = choice ? cleanEntity(choice) : null;

            if (conflict.entityType === 'fund') {
                funds = funds.filter(f => f.syncId !== conflict.syncId);
                if (cleanedChoice) funds.push(cleanedChoice);
            } else {
                trades = trades.filter(t => t.syncId !== conflict.syncId);
                if (cleanedChoice) trades.push(cleanedChoice);
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
        const errorMessage = error && typeof error.message === 'string' ? error.message : String(error || 'unknown error');
        console.error('[Sync/Resolve] Error details:', {
            message: errorMessage,
            stack: error?.stack,
            conflictsCount: conflicts?.length,
            resolutionCount: resolution?.length,
            baseRevision
        });
        // 防御性编程：确保 jsonResponse 不会再次抛出异常
        try {
            return jsonResponse({
                success: false,
                error: errorMessage,
                errorType: error?.name || 'unknown'
            }, 500, request);
        } catch (innerError) {
            // 如果 jsonResponse 也失败，返回最简响应
            return new Response(JSON.stringify({
                success: false,
                error: 'internal_server_error',
                details: errorMessage
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }
};

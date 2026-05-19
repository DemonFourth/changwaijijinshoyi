/**
 * Cloudflare Pages Function - /api/public/trades
 * 获取交易记录（公开读取）/ 添加交易记录（需认证）
 *
 * GET /api/public/trades
 *   - 公开读取，无需认证
 *   - Query params: fundCode (可选，按基金代码过滤)
 *
 * POST /api/public/trades
 *   - 需要 X-API-Key 认证
 *   - Body: { fundCode, date, type, netValue, shares, amount, fee?, remark? }
 */

import { checkApiKey, badRequestResponse, notFoundResponse, internalErrorResponse, handleOptions, generateSyncId, getNowIso } from '../../_shared/authMiddleware.js';
import { getSnapshot, updateSnapshot, appendChangeLogs } from '../../_shared/syncRepository.js';
import { ensureTables } from '../../_shared/d1Schema.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return handleOptions(request);
    }

    if (request.method === 'GET') {
        return handleGet(env, request);
    }

    if (request.method === 'POST') {
        return handlePost(env, request);
    }

    return badRequestResponse('Method not allowed');
};

async function handleGet(env, request) {
    try {
        await ensureTables(env);
        const snapshot = await getSnapshot(env, 'default');

        const url = new URL(request.url);
        const fundCodeFilter = url.searchParams.get('fundCode');

        let trades = (snapshot.trades || []).filter(t => !t.deletedAt);

        if (fundCodeFilter) {
            const fund = (snapshot.funds || []).find(f => f.code === fundCodeFilter && !f.deletedAt);
            if (fund) {
                trades = trades.filter(t => t.fundId === fund.id);
            } else {
                trades = [];
            }
        }

        const now = getNowIso();

        const response = {
            success: true,
            data: trades.map(t => ({
                syncId: t.syncId,
                fundId: t.fundId,
                date: t.date,
                type: t.type,
                netValue: t.netValue,
                shares: t.shares,
                amount: t.amount,
                fee: t.fee,
                remark: t.remark || '',
                dividendMode: t.dividendMode || null,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt
            })),
            meta: {
                total: trades.length,
                filters: fundCodeFilter ? { fundCode: fundCodeFilter } : null,
                timestamp: now
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[Public API] trades list error:', error);
        return internalErrorResponse(error.message);
    }
}

async function handlePost(env, request) {
    if (!checkApiKey(env, request)) {
        return unauthorizedResponse();
    }

    try {
        const body = await request.json();
        const errors = validateTradeRequest(body);

        if (errors.length > 0) {
            return badRequestResponse('Validation failed: ' + errors.join(', '));
        }

        await ensureTables(env);
        const snapshot = await getSnapshot(env, 'default');

        const fund = (snapshot.funds || []).find(f => f.code === body.fundCode && !f.deletedAt);
        if (!fund) {
            return notFoundResponse(`Fund with code '${body.fundCode}' not found`);
        }

        const now = getNowIso();
        const syncId = generateSyncId('trade');

        const newTrade = {
            syncId: syncId,
            fundId: fund.id,
            date: body.date,
            type: body.type,
            netValue: body.netValue,
            shares: body.shares,
            amount: body.amount,
            fee: body.fee || 0,
            remark: body.remark || '',
            dividendMode: body.dividendMode || null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            lastSyncedAt: now
        };

        const trades = [...(snapshot.trades || []), newTrade];
        const updateResult = await updateSnapshot(env, { funds: snapshot.funds, trades: trades }, 'default');
        if (!updateResult.success) {
            return internalErrorResponse('Failed to update snapshot');
        }

        // 记录变更日志
        await appendChangeLogs(env, updateResult.revision, [newTrade], 'trade', 'upsert', 'default');

        const nowIso = getNowIso();

        return new Response(JSON.stringify({
            success: true,
            data: {
                syncId: newTrade.syncId,
                fundId: newTrade.fundId,
                fundCode: body.fundCode,
                date: newTrade.date,
                type: newTrade.type,
                netValue: newTrade.netValue,
                shares: newTrade.shares,
                amount: newTrade.amount,
                fee: newTrade.fee,
                remark: newTrade.remark,
                dividendMode: newTrade.dividendMode,
                createdAt: newTrade.createdAt
            },
            meta: {
                revision: updateResult.revision,
                timestamp: nowIso
            }
        }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[Public API] trades create error:', error);
        if (error instanceof SyntaxError) {
            return badRequestResponse('Invalid JSON body');
        }
        return internalErrorResponse(error.message);
    }
}

function validateTradeRequest(body) {
    const errors = [];

    const EPSILON = 0.0001;
    const isPositive = (v) => v > EPSILON;

    if (!body.fundCode) {
        errors.push('fundCode is required');
    }
    if (!body.date) {
        errors.push('date is required');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        errors.push('date must be in YYYY-MM-DD format');
    }
    if (!body.type) {
        errors.push('type is required');
    } else if (!['buy', 'sell', 'dividend'].includes(body.type)) {
        errors.push('type must be one of: buy, sell, dividend');
    }
    if (body.netValue === undefined || body.netValue === null) {
        errors.push('netValue is required');
    } else if (typeof body.netValue !== 'number' || !isPositive(body.netValue)) {
        errors.push('netValue must be a positive number');
    }
    if (body.shares === undefined || body.shares === null) {
        errors.push('shares is required');
    } else if (typeof body.shares !== 'number' || !isPositive(body.shares)) {
        errors.push('shares must be a positive number');
    }
    if (body.amount === undefined || body.amount === null) {
        errors.push('amount is required');
    } else if (typeof body.amount !== 'number' || !isPositive(body.amount)) {
        errors.push('amount must be a positive number');
    }

    return errors;
}
/**
 * Cloudflare Pages Function - /api/public/trades
 * 获取全部交易记录（可按 fundCode 过滤）
 *
 * Query params:
 *   fundCode - 可选，按基金代码过滤
 */

import { checkApiKey, unauthorizedResponse, internalErrorResponse, handleOptions } from '../../_shared/authMiddleware.js';
import { getSnapshot } from '../../_shared/syncRepository.js';
import { ensureTables } from '../../_shared/d1Schema.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return handleOptions();
    }

    if (!checkApiKey(env, request)) {
        return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const fundCodeFilter = url.searchParams.get('fundCode');

    try {
        await ensureTables(env);
        const snapshot = await getSnapshot(env, 'default');

        let trades = (snapshot.trades || []).filter(t => !t.deletedAt);

        if (fundCodeFilter) {
            const fund = (snapshot.funds || []).find(f => f.code === fundCodeFilter && !f.deletedAt);
            if (fund) {
                trades = trades.filter(t => t.fundId === fund.id);
            } else {
                trades = [];
            }
        }

        const now = new Date().toISOString();

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
};
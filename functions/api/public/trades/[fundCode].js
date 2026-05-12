/**
 * Cloudflare Pages Function - /api/public/trades/[fundCode]
 * 获取指定基金的交易记录
 */

import { checkApiKey, unauthorizedResponse, notFoundResponse, internalErrorResponse, handleOptions } from '../../../_shared/authMiddleware.js';
import { getSnapshot } from '../../../_shared/syncRepository.js';
import { ensureTables } from '../../../_shared/d1Schema.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return handleOptions();
    }

    if (!checkApiKey(env, request)) {
        return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const fundCode = pathParts[pathParts.length - 1];

    if (!fundCode) {
        return notFoundResponse('Fund code is required');
    }

    try {
        await ensureTables(env);
        const snapshot = await getSnapshot(env, 'default');

        const fund = (snapshot.funds || []).find(f => f.code === fundCode && !f.deletedAt);

        if (!fund) {
            return notFoundResponse(`Fund with code '${fundCode}' not found`);
        }

        const trades = (snapshot.trades || [])
            .filter(t => t.fundId === fund.id && !t.deletedAt)
            .map(t => ({
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
            }));

        const now = new Date().toISOString();

        return new Response(JSON.stringify({
            success: true,
            data: {
                fund: {
                    code: fund.code,
                    name: fund.name
                },
                trades: trades
            },
            meta: {
                total: trades.length,
                fundCode: fundCode,
                timestamp: now
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[Public API] trades by fund code error:', error);
        return internalErrorResponse(error.message);
    }
};
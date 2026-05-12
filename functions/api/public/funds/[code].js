/**
 * Cloudflare Pages Function - /api/public/funds/[code]
 * 获取单个基金信息
 */

import { notFoundResponse, internalErrorResponse, handleOptions, getNowIso } from '../../../_shared/authMiddleware.js';
import { getSnapshot } from '../../../_shared/syncRepository.js';
import { ensureTables } from '../../../_shared/d1Schema.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return handleOptions();
    }

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Method not allowed' }
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
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

        const now = getNowIso();

        return new Response(JSON.stringify({
            success: true,
            data: {
                syncId: fund.syncId,
                id: fund.id,
                name: fund.name,
                code: fund.code,
                netValue: fund.netValue,
                estimatedValue: fund.estimatedValue,
                feeTiers: fund.feeTiers,
                createdAt: fund.createdAt,
                updatedAt: fund.updatedAt
            },
            meta: {
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
        console.error('[Public API] fund by code error:', error);
        return internalErrorResponse(error.message);
    }
};
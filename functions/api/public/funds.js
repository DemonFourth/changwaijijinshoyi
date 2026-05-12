/**
 * Cloudflare Pages Function - /api/public/funds
 * 获取全部基金列表
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

    try {
        await ensureTables(env);
        const snapshot = await getSnapshot(env, 'default');

        const funds = (snapshot.funds || []).filter(f => !f.deletedAt);

        const now = new Date().toISOString();

        return new Response(JSON.stringify({
            success: true,
            data: funds.map(f => ({
                syncId: f.syncId,
                id: f.id,
                name: f.name,
                code: f.code,
                netValue: f.netValue,
                estimatedValue: f.estimatedValue,
                feeTiers: f.feeTiers,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt
            })),
            meta: {
                total: funds.length,
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
        console.error('[Public API] funds list error:', error);
        return internalErrorResponse(error.message);
    }
};
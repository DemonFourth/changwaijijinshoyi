/**
 * Auth Middleware - API Key 鉴权中间件
 * 用于 Public API 的单一 API Key 认证
 */

/**
 * 检查 API Key 是否有效
 * @param {Object} env - Pages Functions 环境对象
 * @param {Request} request - 请求对象
 * @returns {boolean} 是否有效
 */
export function checkApiKey(env, request) {
    const validKey = env.PUBLIC_API_KEY;
    if (!validKey) {
        console.error('[Auth] PUBLIC_API_KEY not configured');
        return false;
    }

    const incomingKey = request.headers.get('X-API-Key');
    if (!incomingKey) {
        console.error('[Auth] X-API-Key header missing');
        return false;
    }

    return incomingKey === validKey;
}

/**
 * 返回 401 未授权响应
 * @param {string} message - 错误消息
 * @returns {Response}
 */
export function unauthorizedResponse(message = 'Invalid or missing API Key') {
    return new Response(JSON.stringify({
        success: false,
        error: {
            code: 'UNAUTHORIZED',
            message: message
        }
    }), {
        status: 401,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
    });
}

/**
 * 返回 404 Not Found 响应
 * @param {string} message - 错误消息
 * @returns {Response}
 */
export function notFoundResponse(message = 'Resource not found') {
    return new Response(JSON.stringify({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: message
        }
    }), {
        status: 404,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
    });
}

/**
 * 返回 500 内部错误响应
 * @param {string} message - 错误消息
 * @returns {Response}
 */
export function internalErrorResponse(message = 'Internal server error') {
    return new Response(JSON.stringify({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: message
        }
    }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
    });
}

/**
 * 处理 OPTIONS 预检请求
 * @returns {Response}
 */
export function handleOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
    });
}
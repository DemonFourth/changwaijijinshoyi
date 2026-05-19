/**
 * Auth Middleware - API Key 鉴权中间件
 * 读取操作公开，写入操作需认证
 */

/**
 * 检查 API Key 是否有效（用于写入操作）
 * 支持 X-API-Key（Public API）和 X-Sync-Key（Sync API）两种请求头
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

    const incomingKey = request.headers.get('X-API-Key') || request.headers.get('X-Sync-Key');
    if (!incomingKey) {
        console.error('[Auth] API Key header missing');
        return false;
    }

    return incomingKey === validKey;
}

/**
 * 检查是否为写入操作（POST/PUT/PATCH/DELETE）
 * @param {Request} request - 请求对象
 * @returns {boolean}
 */
export function isWriteMethod(request) {
    const method = request.method.toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
    });
}

/**
 * 返回 400 错误请求响应
 * @param {string} message - 错误消息
 * @returns {Response}
 */
export function badRequestResponse(message = 'Bad request') {
    return new Response(JSON.stringify({
        success: false,
        error: {
            code: 'BAD_REQUEST',
            message: message
        }
    }), {
        status: 400,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
    });
}

/**
 * 处理 OPTIONS 预检请求（支持 CORS 反射 Origin）
 * @param {Request} [request] - 请求对象（用于反射 Origin）
 * @returns {Response}
 */
export function handleOptions(request) {
    const origin = request ? request.headers.get('Origin') : null;
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    };
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Vary'] = 'Origin';
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }
    return new Response(null, { headers });
}

/**
 * 生成 syncId
 * @returns {string}
 */
export function generateSyncId(prefix = 'entity') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 获取当前 ISO 时间戳
 * @returns {string}
 */
export function getNowIso() {
    return new Date().toISOString();
}
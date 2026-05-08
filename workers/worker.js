const AUTH_ENABLED = AUTH_ENABLED === 'true';
const APP_PASSWORD = APP_PASSWORD || '';
const SESSION_SECRET = SESSION_SECRET || 'default-secret-change-me';

// 自动建表：首次请求时检查并创建 D1 表
async function ensureTables(env) {
    try {
        // 检查表是否存在
        const check = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='app_snapshot'"
        ).first();

        if (!check) {
            // 创建 app_snapshot 表
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS app_snapshot (
                    id TEXT PRIMARY KEY DEFAULT 'main',
                    revision INTEGER NOT NULL DEFAULT 0,
                    funds_json TEXT NOT NULL DEFAULT '[]',
                    trades_json TEXT NOT NULL DEFAULT '[]',
                    sync_meta_json TEXT,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `).run();

            // 创建 change_log 表
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS change_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    revision INTEGER NOT NULL,
                    entity_type TEXT NOT NULL,
                    sync_id TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    payload_json TEXT,
                    device_id TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `).run();

            // 创建 sync_session 表
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS sync_session (
                    session_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    expires_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
                    ip_hash TEXT,
                    user_agent_hash TEXT
                )
            `).run();

            // 插入初始快照
            await env.DB.prepare(`
                INSERT OR IGNORE INTO app_snapshot (id, revision, funds_json, trades_json)
                VALUES ('main', 0, '[]', '[]')
            `).run();

            console.log('D1 tables auto-created');
        }
    } catch (error) {
        console.error('Auto-table-creation failed:', error.message);
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // CORS 处理
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Cookie'
                }
            });
        }

        // 路由处理
        try {
            // 首次请求自动建表
            await ensureTables(env);

            let response;
            
            if (pathname === '/auth/status') {
                response = handleAuthStatus(request, env);
            } else if (pathname === '/auth/login') {
                response = handleAuthLogin(request, env);
            } else if (pathname === '/auth/logout') {
                response = handleAuthLogout(request, env);
            } else if (pathname === '/sync/pull') {
                response = handleSyncPull(request, env);
            } else if (pathname === '/sync/push') {
                response = handleSyncPush(request, env);
            } else if (pathname === '/sync/resolve') {
                response = handleSyncResolve(request, env);
            } else {
                response = new Response(JSON.stringify({ error: 'Not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 添加 CORS 头
            const corsHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Cookie'
            };
            
            return new Response(response.body, {
                ...response,
                headers: { ...corsHeaders, ...response.headers }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};

function handleAuthStatus(request, env) {
    return new Response(JSON.stringify({
        authEnabled: AUTH_ENABLED,
        authenticated: false
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleAuthLogin(request, env) {
    if (!AUTH_ENABLED) {
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { password } = await request.json();
    
    if (password !== APP_PASSWORD) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Invalid password' 
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 生成简单 session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // 存入 D1
    await env.DB.prepare(`
        INSERT INTO sync_session (session_id, expires_at, last_seen_at)
        VALUES (?, ?, ?)
    `).bind(sessionId, expiresAt, new Date().toISOString()).run();

    return new Response(JSON.stringify({ 
        success: true,
        sessionId
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; Max-Age=${7 * 24 * 60 * 60}`
        }
    });
}

async function handleAuthLogout(request, env) {
    const sessionId = getSessionId(request);
    if (sessionId) {
        await env.DB.prepare(`DELETE FROM sync_session WHERE session_id = ?`)
            .bind(sessionId).run();
    }
    
    return new Response(JSON.stringify({ success: true }), {
        headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': 'session=; Path=/; Max-Age=0'
        }
    });
}

async function handleSyncPull(request, env) {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId') || '';
    const cloudRevision = parseInt(url.searchParams.get('cloudRevision') || '0', 10);

    // 获取云端快照
    const snapshot = await env.DB.prepare(`
        SELECT revision, funds_json, trades_json, sync_meta_json, updated_at
        FROM app_snapshot WHERE id = 'main'
    `).first();

    if (!snapshot) {
        return new Response(JSON.stringify({
            success: true,
            revision: 0,
            funds: [],
            trades: []
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        success: true,
        revision: snapshot.revision,
        funds: JSON.parse(snapshot.funds_json || '[]'),
        trades: JSON.parse(snapshot.trades_json || '[]'),
        serverTime: snapshot.updated_at
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleSyncPush(request, env) {
    const { deviceId, baseRevision, funds, trades } = await request.json();

    // 乐观并发检查
    const current = await env.DB.prepare(`
        SELECT revision FROM app_snapshot WHERE id = 'main'
    `).first();

    if (current.revision !== baseRevision) {
        // 有冲突，获取差异
        const cloudData = await env.DB.prepare(`
            SELECT funds_json, trades_json FROM app_snapshot WHERE id = 'main'
        `).first();

        const cloudFunds = JSON.parse(cloudData.funds_json || '[]');
        const cloudTrades = JSON.parse(cloudData.trades_json || '[]');

        // 简单冲突检测：比较 updatedAt
        const fundConflicts = detectConflicts(funds, cloudFunds);
        const tradeConflicts = detectConflicts(trades, cloudTrades);

        if (fundConflicts.length > 0 || tradeConflicts.length > 0) {
            return new Response(JSON.stringify({
                success: false,
                conflict: true,
                conflicts: [...fundConflicts, ...tradeConflicts]
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // 更新快照
    const newRevision = current.revision + 1;
    await env.DB.prepare(`
        UPDATE app_snapshot 
        SET revision = ?, funds_json = ?, trades_json = ?, updated_at = datetime('now')
        WHERE id = 'main'
    `).bind(newRevision, JSON.stringify(funds), JSON.stringify(trades)).run();

    // 记录变更日志
    for (const fund of funds) {
        await env.DB.prepare(`
            INSERT INTO change_log (revision, entity_type, sync_id, operation, payload_json, device_id)
            VALUES (?, 'fund', ?, 'upsert', ?, ?)
        `).bind(newRevision, fund.syncId, JSON.stringify(fund), deviceId).run();
    }

    for (const trade of trades) {
        await env.DB.prepare(`
            INSERT INTO change_log (revision, entity_type, sync_id, operation, payload_json, device_id)
            VALUES (?, 'trade', ?, 'upsert', ?, ?)
        `).bind(newRevision, trade.syncId, JSON.stringify(trade), deviceId).run();
    }

    return new Response(JSON.stringify({
        success: true,
        revision: newRevision
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleSyncResolve(request, env) {
    const { deviceId, baseRevision, conflicts, resolution } = await request.json();

    // 重新获取当前云端数据
    const current = await env.DB.prepare(`
        SELECT funds_json, trades_json FROM app_snapshot WHERE id = 'main'
    `).first();

    let funds = JSON.parse(current.funds_json || '[]');
    let trades = JSON.parse(current.trades_json || '[]');

    // 应用解决策略
    conflicts.forEach((conflict, index) => {
        const resolved = resolution[index] === 'cloud' ? conflict.cloud : conflict.local;
        
        if (conflict.entityType === 'fund') {
            funds = funds.filter(f => f.syncId !== conflict.syncId);
            if (resolved) funds.push(resolved);
        } else {
            trades = trades.filter(t => t.syncId !== conflict.syncId);
            if (resolved) trades.push(resolved);
        }
    });

    // 更新
    const newRevision = current.revision + 1;
    await env.DB.prepare(`
        UPDATE app_snapshot 
        SET revision = ?, funds_json = ?, trades_json = ?, updated_at = datetime('now')
        WHERE id = 'main'
    `).bind(newRevision, JSON.stringify(funds), JSON.stringify(trades)).run();

    return new Response(JSON.stringify({
        success: true,
        revision: newRevision
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

function detectConflicts(local, cloud) {
    const conflicts = [];
    const cloudMap = new Map(cloud.map(c => [c.syncId, c]));
    const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 简化：30天内修改视为潜在冲突

    for (const localEntity of local) {
        const cloudEntity = cloudMap.get(localEntity.syncId);
        if (!cloudEntity) continue;

        const localTime = new Date(localEntity.updatedAt).getTime();
        const cloudTime = new Date(cloudEntity.updatedAt).getTime();

        if (localTime > baseTime && cloudTime > baseTime && localTime !== cloudTime) {
            conflicts.push({
                entityType: localEntity.fundId ? 'trade' : 'fund',
                syncId: localEntity.syncId,
                local: localEntity,
                cloud: cloudEntity
            });
        }
    }

    return conflicts;
}

function getSessionId(request) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return null;
    
    const match = cookie.match(/session=([^;]+)/);
    return match ? match[1] : null;
}
/**
 * D1 Schema - 建表与初始化
 * 每次请求前调用 ensureTables(env)，空库自动创建所需表
 *
 * 预留说明：
 * - user_id 字段：当前单用户固定使用 'default'；未来多用户时按 user_id 隔离数据
 * - change_log 表：保留以备将来审计需求
 * - sync_session 表：最简版不启用，预留结构
 */

/**
 * 确保 D1 表已创建
 * @param {Object} env - Pages Functions 的环境对象（含 env.DB）
 */
export async function ensureTables(env) {
    if (!env.DB) {
        return;
    }

    try {
        // 检查 app_snapshot 表是否存在
        const check = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='app_snapshot'"
        ).first();

        if (!check) {
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS app_snapshot (
                    id TEXT PRIMARY KEY DEFAULT 'main',
                    user_id TEXT NOT NULL DEFAULT 'default',
                    revision INTEGER NOT NULL DEFAULT 0,
                    funds_json TEXT NOT NULL DEFAULT '[]',
                    trades_json TEXT NOT NULL DEFAULT '[]',
                    sync_meta_json TEXT,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `).run();

            // 创建 change_log 表（预留）
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS change_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    revision INTEGER NOT NULL,
                    user_id TEXT NOT NULL DEFAULT 'default',
                    entity_type TEXT NOT NULL,
                    sync_id TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    payload_json TEXT,
                    device_id TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `).run();

            // 创建 sync_session 表（预留，最简版不启用）
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS sync_session (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'default',
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    expires_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
                    ip_hash TEXT,
                    user_agent_hash TEXT
                )
            `).run();

            // 插入初始快照（仅当表中无数据时）
            const initialCount = await env.DB.prepare(
                "SELECT COUNT(*) AS cnt FROM app_snapshot WHERE id = 'main'"
            ).first();

            if (initialCount && initialCount.cnt === 0) {
                await env.DB.prepare(`
                    INSERT INTO app_snapshot (id, user_id, revision, funds_json, trades_json)
                    VALUES ('main', 'default', 0, '[]', '[]')
                `).run();
            }

            console.log('[D1Schema] tables auto-created');
        }
    } catch (error) {
        console.error('[D1Schema] auto-table-creation failed:', error.stack || error.message);
        throw error;
    }
}

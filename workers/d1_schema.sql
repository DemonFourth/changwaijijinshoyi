-- app_snapshot 表：存储当前业务快照
CREATE TABLE IF NOT EXISTS app_snapshot (
    id TEXT PRIMARY KEY DEFAULT 'main',
    revision INTEGER NOT NULL DEFAULT 0,
    funds_json TEXT NOT NULL DEFAULT '[]',
    trades_json TEXT NOT NULL DEFAULT '[]',
    sync_meta_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- change_log 表：变更日志
CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revision INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    sync_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT,
    device_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- sync_session 表：会话管理
CREATE TABLE IF NOT EXISTS sync_session (
    session_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_hash TEXT,
    user_agent_hash TEXT
);

-- 初始化主快照
INSERT OR IGNORE INTO app_snapshot (id, revision, funds_json, trades_json) 
VALUES ('main', 0, '[]', '[]');
# Cloudflare D1 云同步实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 Cloudflare Workers + D1 的云端同步能力，保持本地优先体验，未部署 Cloudflare 时默认退回纯本地模式

**Architecture:** 前端新增 `CloudflareD1SyncAdapter` 注册到 `SyncAdapterRegistry`，新增 `syncAppService` 协调同步流程；云端提供 Workers API + D1 存储；鉴权采用环境变量控制的密码保护

**Tech Stack:** 原生 JavaScript、LocalStorage、Cloudflare Workers、Cloudflare D1、ESLint

---

## 文件修改清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `js/storage/cloudflareD1SyncAdapter.js` | 云端同步适配器，封装 pull/push/resolve/auth 请求 |
| `js/application/syncAppService.js` | 同步应用服务，协调启动同步、后台推送、冲突处理 |
| `js/modal/syncConflictModalHelper.js` | 冲突处理弹窗 helper |
| `workers/worker.js` | Cloudflare Workers 主脚本 |
| `workers/d1_schema.sql` | D1 数据库建表 SQL |
| `workers/schema.yaml` | D1 数据库 schema 定义（wrangler 部署用） |
| `wrangler.toml` | Cloudflare Workers 配置 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `js/storage/schema.js` | 扩展 syncMeta 默认字段（lastPulledAt/lastPushedAt/cloudRevision/syncStatus/pendingChanges/lastError） |
| `js/storage/migrations.js` | 扩展迁移逻辑，兼容旧的 syncMeta |
| `js/storage/syncAdapterRegistry.js` | Cloudflare provider 注册与回退逻辑 |
| `js/app.js` | 初始化同步服务，启动后台同步 |
| `index.html` | 引入新模块脚本，添加密码页 HTML |
| `css/style.css` | 密码页与同步状态提示样式 |
| `js/toolPage.js` 或设置弹窗 | 增加手动同步与同步状态入口 |
| `tests/syncAdapterRegistry.test.cjs` | 新增 Cloudflare adapter 测试 |
| `tests/cloudflareD1SyncAdapter.test.cjs` | 新增云端同步 adapter 测试 |
| `tests/syncAppService.test.cjs` | 新增同步服务测试 |

---

## 实现任务

### Task 1: 扩展 StorageSchema syncMeta 字段

**Files:**
- Modify: `js/storage/schema.js:1-64`

- [ ] **Step 1: 读取现有 schema.js 并确认字段**

读取 `js/storage/schema.js`，确认当前 `syncMeta` 只有 `provider/deviceId/lastSyncAt`

- [ ] **Step 2: 扩展 createEmptySnapshot 中的 syncMeta**

```js
createEmptySnapshot() {
    return {
        schemaVersion: StorageSchema.VERSION,
        funds: [],
        trades: [],
        syncMeta: {
            provider: 'local',
            deviceId: StorageSchema.generateDeviceId(),
            lastSyncAt: null,
            lastPulledAt: null,
            lastPushedAt: null,
            cloudRevision: 0,
            syncStatus: 'idle',
            pendingChanges: 0,
            lastError: null
        }
    };
},
```

- [ ] **Step 3: 添加 generateDeviceId 工具方法**

```js
generateDeviceId() {
    const key = 'fund_calculator_device_id';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(key, deviceId);
    }
    return deviceId;
},
```

- [ ] **Step 4: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add js/storage/schema.js
git commit -m "feat: 扩展 storageSchema syncMeta 字段"
```

---

### Task 2: 扩展 StorageMigrations 兼容新字段

**Files:**
- Modify: `js/storage/migrations.js:1-27`

- [ ] **Step 1: 读取现有 migrations.js**

- [ ] **Step 2: 扩展 migrateSnapshot 兼容新 syncMeta**

```js
migrateSnapshot(snapshot) {
    if (snapshot && snapshot.schemaVersion === window.StorageSchema.VERSION) {
        const defaultMeta = window.StorageSchema.createEmptySnapshot().syncMeta;
        return {
            ...snapshot,
            funds: Array.isArray(snapshot.funds) 
                ? snapshot.funds.map(fund => window.StorageSchema.createFundEntity(fund)) 
                : [],
            trades: Array.isArray(snapshot.trades) 
                ? snapshot.trades.map(trade => window.StorageSchema.createTradeEntity(trade)) 
                : [],
            syncMeta: {
                ...defaultMeta,
                ...(snapshot.syncMeta || {})
            }
        };
    }

    return StorageMigrations.migrateLegacyData();
},
```

- [ ] **Step 3: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add js/storage/migrations.js
git commit -m "feat: 扩展 migrations 兼容新 syncMeta 字段"
```

---

### Task 3: 创建 CloudflareD1SyncAdapter

**Files:**
- Create: `js/storage/cloudflareD1SyncAdapter.js`

- [ ] **Step 1: 创建云端同步 adapter 文件**

```js
const CloudflareD1SyncAdapter = {
    _config: {
        workerUrl: null,
        timeout: 10000
    },

    init(config = {}) {
        CloudflareD1SyncAdapter._config = {
            ...CloudflareD1SyncAdapter._config,
            ...config
        };
    },

    isConfigured() {
        return !!CloudflareD1SyncAdapter._config.workerUrl;
    },

    getStatus() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return {
                provider: 'cloudflare',
                deviceId: window.LocalStorageAdapter.getSyncMeta().deviceId,
                lastSyncAt: window.LocalStorageAdapter.getSyncMeta().lastSyncAt,
                canPush: false,
                canPull: false,
                configured: false
            };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        return {
            provider: 'cloudflare',
            deviceId: syncMeta.deviceId,
            lastSyncAt: syncMeta.lastSyncAt,
            canPush: true,
            canPull: true,
            configured: true,
            syncStatus: syncMeta.syncStatus || 'idle'
        };
    },

    async checkAuthStatus() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { authEnabled: false, authenticated: false };
        }

        try {
            const response = await CloudflareD1SyncAdapter._request('/auth/status', 'GET');
            return response;
        } catch (error) {
            console.error('Auth status check failed:', error);
            return { authEnabled: false, authenticated: false, error: error.message };
        }
    },

    async login(password) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        try {
            const response = await CloudflareD1SyncAdapter._request('/auth/login', 'POST', { password });
            return response;
        } catch (error) {
            return { success: false, reason: error.message };
        }
    },

    async pull() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        
        try {
            const response = await CloudflareD1SyncAdapter._request('/sync/pull', 'GET', {
                deviceId: syncMeta.deviceId,
                cloudRevision: syncMeta.cloudRevision,
                lastPulledAt: syncMeta.lastPulledAt
            });
            
            if (response.success) {
                window.LocalStorageAdapter.updateSyncMeta({
                    lastPulledAt: new Date().toISOString(),
                    cloudRevision: response.revision,
                    syncStatus: 'idle'
                });
            }
            
            return response;
        } catch (error) {
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'error',
                lastError: error.message
            });
            return { success: false, reason: error.message };
        }
    },

    async push(funds, trades) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        
        try {
            const response = await CloudflareD1SyncAdapter._request('/sync/push', 'POST', {
                deviceId: syncMeta.deviceId,
                baseRevision: syncMeta.cloudRevision,
                funds: funds,
                trades: trades
            });

            if (response.success) {
                window.LocalStorageAdapter.updateSyncMeta({
                    lastPushedAt: new Date().toISOString(),
                    cloudRevision: response.revision,
                    syncStatus: 'idle',
                    pendingChanges: 0
                });
            } else if (response.conflict) {
                window.LocalStorageAdapter.updateSyncMeta({
                    syncStatus: 'conflict'
                });
            }
            
            return response;
        } catch (error) {
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'error',
                lastError: error.message
            });
            return { success: false, reason: error.message };
        }
    },

    async resolve(conflicts, resolution) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        
        try {
            const response = await CloudflareD1SyncAdapter._request('/sync/resolve', 'POST', {
                deviceId: syncMeta.deviceId,
                baseRevision: syncMeta.cloudRevision,
                conflicts: conflicts,
                resolution: resolution
            });

            if (response.success) {
                window.LocalStorageAdapter.updateSyncMeta({
                    lastPushedAt: new Date().toISOString(),
                    cloudRevision: response.revision,
                    syncStatus: 'idle'
                });
            }
            
            return response;
        } catch (error) {
            return { success: false, reason: error.message };
        }
    },

    markSyncComplete(timestamp = new Date().toISOString()) {
        return window.LocalStorageAdapter.updateSyncMeta({
            lastSyncAt: timestamp,
            syncStatus: 'idle'
        });
    },

    async _request(endpoint, method, body = null) {
        const { workerUrl, timeout } = CloudflareD1SyncAdapter._config;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            credentials: 'include'
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const url = workerUrl + endpoint;
            const response = await fetch(url, options);
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
};

ModuleRegistry.register('CloudflareD1SyncAdapter', CloudflareD1SyncAdapter);
```

- [ ] **Step 2: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add js/storage/cloudflareD1SyncAdapter.js
git commit -m "feat: 添加 CloudflareD1SyncAdapter 云端同步适配器"
```

---

### Task 4: 更新 SyncAdapterRegistry 注册 cloudflare provider

**Files:**
- Modify: `js/storage/syncAdapterRegistry.js:1-20`

- [ ] **Step 1: 读取现有 syncAdapterRegistry.js**

- [ ] **Step 2: 修改注册逻辑**

```js
const SyncAdapterRegistry = {
    adapters: {
        local: window.LocalSyncAdapter
    },

    getAdapter(provider = 'local') {
        return SyncAdapterRegistry.adapters[provider] || null;
    },

    registerAdapter(provider, adapter) {
        SyncAdapterRegistry.adapters[provider] = adapter;
    },

    registerCloudflareAdapter() {
        if (typeof window.CloudflareD1SyncAdapter !== 'undefined') {
            SyncAdapterRegistry.registerAdapter('cloudflare', window.CloudflareD1SyncAdapter);
        }
    },

    getCurrentAdapter() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const provider = syncMeta.provider || 'local';
        
        // 如果是 cloudflare 但未配置，回退到 local
        if (provider === 'cloudflare') {
            const adapter = SyncAdapterRegistry.getAdapter('cloudflare');
            if (!adapter || !adapter.isConfigured()) {
                console.warn('Cloudflare sync not configured, falling back to local');
                return SyncAdapterRegistry.getAdapter('local');
            }
        }
        
        return SyncAdapterRegistry.getAdapter(provider) || SyncAdapterRegistry.getAdapter('local');
    }
};

ModuleRegistry.register('SyncAdapterRegistry', SyncAdapterRegistry);
```

- [ ] **Step 3: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add js/storage/syncAdapterRegistry.js
git commit -m "feat: 更新 SyncAdapterRegistry 支持 cloudflare 回退"
```

---

### Task 5: 创建 syncAppService

**Files:**
- Create: `js/application/syncAppService.js`

- [ ] **Step 1: 创建同步应用服务**

```js
const SyncAppService = {
    _syncInProgress: false,
    _pendingChanges: [],

    async init(config = {}) {
        // 初始化 cloudflare adapter
        if (config.workerUrl) {
            window.CloudflareD1SyncAdapter.init({
                workerUrl: config.workerUrl,
                timeout: config.timeout || 10000
            });
            window.SyncAdapterRegistry.registerCloudflareAdapter();
        }

        // 注册同步相关事件
        this._setupEventListeners();
    },

    _setupEventListeners() {
        // 监听基金变更
        EventBus.on(EventType.FUND_ADDED, () => this._onDataChanged());
        EventBus.on(EventType.FUND_UPDATED, () => this._onDataChanged());
        EventBus.on(EventType.FUND_DELETED, () => this._onDataChanged());
        
        // 监听交易变更
        EventBus.on(EventType.TRADE_ADDED, () => this._onDataChanged());
        EventBus.on(EventType.TRADE_UPDATED, () => this._onDataChanged());
        EventBus.on(EventType.TRADE_DELETED, () => this._onDataChanged());
    },

    _onDataChanged() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        window.LocalStorageAdapter.updateSyncMeta({
            pendingChanges: (syncMeta.pendingChanges || 0) + 1,
            syncStatus: 'pending'
        });

        // 防抖：5秒后执行 push
        clearTimeout(this._pushTimeout);
        this._pushTimeout = setTimeout(() => {
            this._executePush();
        }, 5000);
    },

    async startBackgroundSync() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        
        // 检查是否需要密码验证
        const authStatus = await adapter.checkAuthStatus();
        if (authStatus.authEnabled && !authStatus.authenticated) {
            return { needPassword: true, authStatus };
        }

        // 执行 pull
        return await this._executePull();
    },

    async _executePull() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        const status = adapter.getStatus();
        
        if (!status.canPull) {
            return { success: true, reason: 'not_configured' };
        }

        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        const result = await adapter.pull();
        
        if (!result.success) {
            return result;
        }

        // 差异检测与合并
        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const mergeResult = this._mergeData(localSnapshot, result);
        
        if (mergeResult.hasConflicts) {
            return {
                success: true,
                hasConflicts: true,
                conflicts: mergeResult.conflicts
            };
        }

        // 保存合并后的数据
        if (mergeResult.hasChanges) {
            window.LocalStorageAdapter.saveSnapshot(mergeResult.snapshot);
        }

        adapter.markSyncComplete();
        
        return { success: true };
    },

    async _executePush() {
        if (this._syncInProgress) {
            return { success: false, reason: 'sync_in_progress' };
        }

        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        const status = adapter.getStatus();
        
        if (!status.canPush) {
            return { success: true, reason: 'not_configured' };
        }

        this._syncInProgress = true;
        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const result = await adapter.push(localSnapshot.funds, localSnapshot.trades);

        this._syncInProgress = false;

        if (result.conflict) {
            return {
                success: false,
                reason: 'conflict',
                conflicts: result.conflicts
            };
        }

        return result;
    },

    _mergeData(localSnapshot, cloudSnapshot) {
        const localFunds = localSnapshot.funds || [];
        const localTrades = localSnapshot.trades || [];
        const cloudFunds = cloudSnapshot.funds || [];
        const cloudTrades = cloudSnapshot.trades || [];

        const conflicts = [];
        const mergedFunds = this._mergeEntities(localFunds, cloudFunds, 'fund', conflicts);
        const mergedTrades = this._mergeEntities(localTrades, cloudTrades, 'trade', conflicts);

        const hasChanges = mergedFunds.hasChanges || mergedTrades.hasChanges;

        return {
            hasChanges,
            hasConflicts: conflicts.length > 0,
            conflicts,
            snapshot: {
                ...localSnapshot,
                funds: mergedFunds.result,
                trades: mergedTrades.result
            }
        };
    },

    _mergeEntities(localEntities, cloudEntities, entityType, conflicts) {
        const localMap = new Map(localEntities.map(e => [e.syncId, e]));
        const cloudMap = new Map(cloudEntities.map(e => [e.syncId, e]));
        
        const result = [];
        let hasChanges = false;

        // 处理本地实体
        for (const [syncId, localEntity] of localMap) {
            const cloudEntity = cloudMap.get(syncId);

            if (!cloudEntity) {
                // 仅本地存在，保留
                result.push(localEntity);
                continue;
            }

            // 两边都存在，检测冲突
            const localTime = new Date(localEntity.updatedAt).getTime();
            const cloudTime = new Date(cloudEntity.updatedAt).getTime();
            const baseTime = localEntity.lastSyncedAt || 0;

            if (localEntity.updatedAt > baseTime && cloudEntity.updatedAt > baseTime) {
                // 都在基线后修改 -> 冲突
                conflicts.push({
                    entityType,
                    syncId,
                    local: localEntity,
                    cloud: cloudEntity
                });
                result.push(localEntity); // 暂时保留本地版本
                hasChanges = true;
            } else if (cloudEntity.updatedAt > baseTime) {
                // 仅云端修改 -> 采用云端
                result.push(cloudEntity);
                hasChanges = true;
            } else {
                // 仅本地修改 -> 保留本地
                result.push(localEntity);
            }
        }

        // 添加仅云端存在的实体
        for (const [syncId, cloudEntity] of cloudMap) {
            if (!localMap.has(syncId)) {
                result.push(cloudEntity);
                hasChanges = true;
            }
        }

        return { result, hasChanges };
    },

    async resolveConflicts(conflicts, resolutions) {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        
        const resolvedFunds = [];
        const resolvedTrades = [];

        conflicts.forEach((conflict, index) => {
            const resolution = resolutions[index];
            if (resolution === 'local') {
                if (conflict.entityType === 'fund') {
                    resolvedFunds.push(conflict.local);
                } else {
                    resolvedTrades.push(conflict.local);
                }
            } else if (resolution === 'cloud') {
                if (conflict.entityType === 'fund') {
                    resolvedFunds.push(conflict.cloud);
                } else {
                    resolvedTrades.push(conflict.cloud);
                }
            }
        });

        return await adapter.resolve(conflicts, resolutions);
    },

    async manualSync() {
        // 先 pull 再 push
        await this._executePull();
        return await this._executePush();
    },

    async forcePushLocal() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        
        // 强制覆盖：将 cloudRevision 设为 0
        window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: 0 });
        
        return await adapter.push(snapshot.funds, snapshot.trades);
    },

    async forcePullCloud() {
        // 强制拉取：将 cloudRevision 设为 0
        window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: 0 });
        return await this._executePull();
    },

    getSyncStatus() {
        return window.LocalStorageAdapter.getSyncMeta();
    }
};

ModuleRegistry.register('SyncAppService', SyncAppService);
```

- [ ] **Step 2: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add js/application/syncAppService.js
git commit -m "feat: 添加 syncAppService 同步应用服务"
```

---

### Task 6: 创建密码页与同步状态 UI

**Files:**
- Modify: `index.html`, `css/style.css`

- [ ] **Step 1: 在 index.html 添加密码页 HTML**

在 `<div id="app">` 开头添加：

```html
<!-- 密码验证页 -->
<div id="auth-page" class="page hidden">
    <div class="auth-container">
        <h2>请输入访问密码</h2>
        <div class="form-group">
            <input type="password" id="auth-password" placeholder="请输入密码" />
        </div>
        <button id="btn-auth-submit" class="btn btn-primary">确认</button>
        <p id="auth-error" class="error-message hidden"></p>
    </div>
</div>
```

- [ ] **Step 2: 在 style.css 添加密码页样式**

```css
#auth-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: var(--bg-primary);
}

.auth-container {
    background: var(--bg-secondary);
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    text-align: center;
    max-width: 360px;
    width: 100%;
}

.auth-container h2 {
    margin-bottom: 24px;
    color: var(--text-primary);
}

.auth-container .form-group {
    margin-bottom: 20px;
}

.auth-container input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 16px;
    background: var(--bg-primary);
    color: var(--text-primary);
}

.auth-container .btn {
    width: 100%;
    padding: 12px;
    font-size: 16px;
}

.auth-container .error-message {
    margin-top: 16px;
    color: var(--color-danger);
    font-size: 14px;
}
```

- [ ] **Step 3: 添加同步状态提示区域**

在 header 中添加同步状态：

```html
<span id="sync-status" class="sync-status hidden">
    <span class="sync-icon">⟳</span>
    <span class="sync-text">同步中</span>
</span>
```

- [ ] **Step 4: 添加同步状态样式**

```css
.sync-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 12px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
}

.sync-status.syncing .sync-icon {
    animation: spin 1s linear infinite;
}

.sync-status.error {
    background: rgba(220, 53, 69, 0.1);
    color: var(--color-danger);
}

.sync-status.conflict {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
```

- [ ] **Step 5: 提交**

```bash
git add index.html css/style.css
git commit -m "feat: 添加密码页与同步状态 UI"
```

---

### Task 7: 创建冲突处理弹窗 Helper

**Files:**
- Create: `js/modal/syncConflictModalHelper.js`

- [ ] **Step 1: 创建冲突弹窗 helper**

```js
const SyncConflictModalHelper = {
    show(conflicts, onResolve) {
        const modal = document.getElementById('modal-container');
        
        const html = `
            <div class="modal-header">
                <h3>同步冲突</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>检测到 ${conflicts.length} 个冲突，请选择保留的版本：</p>
                <div class="conflict-list">
                    ${conflicts.map((conflict, index) => this._renderConflictItem(conflict, index)).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="btn-conflict-use-local">全部使用本地版本</button>
                <button class="btn btn-secondary" id="btn-conflict-use-cloud">全部使用云端版本</button>
                <button class="btn btn-primary" id="btn-conflict-apply">应用选择</button>
            </div>
        `;

        modal.innerHTML = html;
        modal.classList.add('active');

        this._bindEvents(conflicts, onResolve);
    },

    _renderConflictItem(conflict, index) {
        const entityType = conflict.entityType === 'fund' ? '基金' : '交易';
        const localVersion = conflict.local;
        const cloudVersion = conflict.cloud;

        return `
            <div class="conflict-item" data-index="${index}">
                <div class="conflict-header">
                    <span class="conflict-type">${entityType}</span>
                    <span class="conflict-id">${localVersion.name || localVersion.date}</span>
                </div>
                <div class="conflict-versions">
                    <div class="version local">
                        <label>
                            <input type="radio" name="conflict-${index}" value="local" checked />
                            <strong>本地版本</strong>
                            <span class="version-time">${localVersion.updatedAt}</span>
                        </label>
                        <div class="version-detail">
                            ${this._formatVersionDetail(conflict.entityType, localVersion)}
                        </div>
                    </div>
                    <div class="version cloud">
                        <label>
                            <input type="radio" name="conflict-${index}" value="cloud" />
                            <strong>云端版本</strong>
                            <span class="version-time">${cloudVersion.updatedAt}</span>
                        </label>
                        <div class="version-detail">
                            ${this._formatVersionDetail(conflict.entityType, cloudVersion)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    _formatVersionDetail(type, entity) {
        if (type === 'fund') {
            return `
                <div class="detail-row">名称: ${entity.name}</div>
                <div class="detail-row">代码: ${entity.code}</div>
                <div class="detail-row">备注: ${entity.remark || '-'}</div>
            `;
        } else {
            return `
                <div class="detail-row">日期: ${entity.date}</div>
                <div class="detail-row">类型: ${entity.type}</div>
                <div class="detail-row">金额: ${entity.amount}</div>
                <div class="detail-row">份额: ${entity.shares}</div>
                <div class="detail-row">备注: ${entity.remark || '-'}</div>
            `;
        }
    },

    _bindEvents(conflicts, onResolve) {
        const btnUseLocal = document.getElementById('btn-conflict-use-local');
        const btnUseCloud = document.getElementById('btn-conflict-use-cloud');
        const btnApply = document.getElementById('btn-conflict-apply');
        const btnClose = document.querySelector('.modal-close');

        btnUseLocal?.addEventListener('click', () => {
            const resolutions = conflicts.map(() => 'local');
            onResolve(resolutions);
            this.close();
        });

        btnUseCloud?.addEventListener('click', () => {
            const resolutions = conflicts.map(() => 'cloud');
            onResolve(resolutions);
            this.close();
        });

        btnApply?.addEventListener('click', () => {
            const resolutions = conflicts.map((_, index) => {
                const checked = document.querySelector(`input[name="conflict-${index}"]:checked`);
                return checked?.value || 'local';
            });
            onResolve(resolutions);
            this.close();
        });

        btnClose?.addEventListener('click', () => this.close());
    },

    close() {
        const modal = document.getElementById('modal-container');
        modal.classList.remove('active');
    }
};

ModuleRegistry.register('SyncConflictModalHelper', SyncConflictModalHelper);
```

- [ ] **Step 2: 添加冲突弹窗样式**

在 style.css 添加：

```css
.conflict-list {
    max-height: 400px;
    overflow-y: auto;
}

.conflict-item {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 16px;
    padding: 16px;
    background: var(--bg-primary);
}

.conflict-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
}

.conflict-type {
    font-weight: bold;
    color: var(--text-primary);
}

.conflict-id {
    color: var(--text-secondary);
    font-size: 14px;
}

.conflict-versions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.version {
    padding: 12px;
    border-radius: 6px;
    background: var(--bg-secondary);
}

.version label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 8px;
}

.version-time {
    font-size: 12px;
    color: var(--text-secondary);
    margin-left: auto;
}

.version-detail {
    font-size: 13px;
    color: var(--text-secondary);
}

.detail-row {
    margin-bottom: 4px;
}
```

- [ ] **Step 3: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add js/modal/syncConflictModalHelper.js css/style.css
git commit -m "feat: 添加冲突处理弹窗 helper"
```

---

### Task 8: 在 App.init 中初始化同步服务

**Files:**
- Modify: `js/app.js:1-251`

- [ ] **Step 1: 在 app.js 添加同步初始化逻辑**

在 `App.init()` 方法中，`DataService.init()` 之后添加：

```js
// 初始化同步服务
const workerUrl = Config.get('sync.workerUrl');
await SyncAppService.init({ workerUrl });

// 启动后台同步（不阻塞页面渲染）
setTimeout(async () => {
    try {
        const syncResult = await SyncAppService.startBackgroundSync();
        
        if (syncResult.needPassword) {
            // 需要密码验证，显示密码页
            document.getElementById('auth-page').classList.remove('hidden');
            document.getElementById('page-overview').classList.add('hidden');
        } else if (syncResult.hasConflicts) {
            // 有冲突，显示冲突处理
            SyncConflictModalHelper.show(syncResult.conflicts, async (resolutions) => {
                await SyncAppService.resolveConflicts(syncResult.conflicts, resolutions);
                Overview.refresh();
            });
        } else {
            // 同步完成，刷新页面
            Overview.refresh();
        }
    } catch (error) {
        console.error('Background sync failed:', error);
        // 静默失败，不阻塞用户体验
    }
}, 100);
```

- [ ] **Step 2: 在 app.js 添加密码页事件绑定**

在 `App.init()` 末尾添加：

```js
// 绑定密码页事件
this.setupAuthPage();
```

添加新方法：

```js
setupAuthPage() {
    const btnSubmit = document.getElementById('btn-auth-submit');
    const inputPassword = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');

    btnSubmit?.addEventListener('click', async () => {
        const password = inputPassword.value;
        if (!password) {
            errorMsg.textContent = '请输入密码';
            errorMsg.classList.remove('hidden');
            return;
        }

        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        const result = await adapter.login(password);

        if (result.success) {
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('page-overview').classList.remove('active');
            document.getElementById('page-overview').classList.add('active');
            
            // 登录成功后执行同步
            const syncResult = await SyncAppService.startBackgroundSync();
            if (syncResult.hasConflicts) {
                SyncConflictModalHelper.show(syncResult.conflicts, async (resolutions) => {
                    await SyncAppService.resolveConflicts(syncResult.conflicts, resolutions);
                    Overview.refresh();
                });
            }
        } else {
            errorMsg.textContent = result.reason || '密码错误';
            errorMsg.classList.remove('hidden');
        }
    });

    inputPassword?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSubmit.click();
        }
    });
},
```

- [ ] **Step 3: 在 config.js 添加同步配置项**

在 `js/config.js` 中添加：

```js
'sync.workerUrl': '',
'sync.timeout': 10000,
```

- [ ] **Step 4: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add js/app.js js/config.js
git commit -m "feat: 在 App.init 中集成同步服务与密码页"
```

---

### Task 9: 创建 Cloudflare Workers 后端

**Files:**
- Create: `workers/worker.js`, `workers/d1_schema.sql`, `wrangler.toml`

- [ ] **Step 1: 创建 wrangler.toml 配置**

```toml
name = "fund-calculator-sync"
main = "worker.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { AUTH_ENABLED = "false", APP_PASSWORD = "", SESSION_SECRET = "" }

[[d1_databases]]
binding = "DB"
database_name = "fund-calculator-db"
database_id = "your-database-id"
```

- [ ] **Step 2: 创建 D1 建表 SQL**

```sql
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
```

- [ ] **Step 3: 创建 Workers 主脚本**

```js
const AUTH_ENABLED = AUTH_ENABLED === 'true';
const APP_PASSWORD = APP_PASSWORD || '';
const SESSION_SECRET = SESSION_SECRET || 'default-secret-change-me';

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
```

- [ ] **Step 4: 提交 Workers 代码**

```bash
git add workers/ wrangler.toml
git commit -m "feat: 添加 Cloudflare Workers 云端同步后端"
```

---

### Task 10: 添加同步相关的单元测试

**Files:**
- Create: `tests/cloudflareD1SyncAdapter.test.cjs`, `tests/syncAppService.test.cjs`

- [ ] **Step 1: 创建 CloudflareD1SyncAdapter 测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('CloudflareD1SyncAdapter registers and provides sync methods', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/storage.js'),
        script('js/storage/schema.js'),
        script('js/storage/migrations.js'),
        script('js/storage/localStorageAdapter.js'),
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js'),
        script('js/storage/cloudflareD1SyncAdapter.js')
    ]);

    assert.ok(context.window.CloudflareD1SyncAdapter, 'expected CloudflareD1SyncAdapter to exist');
    assert.equal(typeof context.window.CloudflareD1SyncAdapter.init, 'function');
    assert.equal(typeof context.window.CloudflareD1SyncAdapter.getStatus, 'function');
    assert.equal(typeof context.window.CloudflareD1SyncAdapter.isConfigured, 'function');
});

test('CloudflareD1SyncAdapter returns not_configured when workerUrl not set', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/storage.js'),
        script('js/storage/schema.js'),
        script('js/storage/migrations.js'),
        script('js/storage/localStorageAdapter.js'),
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js'),
        script('js/storage/cloudflareD1SyncAdapter.js')
    ]);

    const status = context.window.CloudflareD1SyncAdapter.getStatus();
    assert.equal(status.configured, false);
    assert.equal(status.canPull, false);
    assert.equal(status.canPush, false);
});
```

- [ ] **Step 2: 创建 syncAppService 测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('SyncAppService exposes sync methods', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/storage.js'),
        script('js/storage/schema.js'),
        script('js/storage/migrations.js'),
        script('js/storage/localStorageAdapter.js'),
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js'),
        script('js/application/syncAppService.js')
    ]);

    assert.ok(context.window.SyncAppService, 'expected SyncAppService to exist');
    assert.equal(typeof context.window.SyncAppService.init, 'function');
    assert.equal(typeof context.window.SyncAppService.startBackgroundSync, 'function');
    assert.equal(typeof context.window.SyncAppService.getSyncStatus, 'function');
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 4: 提交**

```bash
git add tests/cloudflareD1SyncAdapter.test.cjs tests/syncAppService.test.cjs
git commit -m "test: 添加云同步相关单元测试"
```

---

### Task 11: 手动同步入口（可选）

**Files:**
- Modify: `js/toolPage.js` 或设置弹窗

- [ ] **Step 1: 在工具箱添加同步状态与手动同步按钮**

在 toolPage.js 的渲染逻辑中添加同步相关操作：

```js
// 同步状态
const syncStatus = SyncAppService.getSyncStatus();
const syncStatusHtml = `
    <div class="tool-section">
        <h4>云同步状态</h4>
        <div class="sync-info">
            <span class="status-label">状态:</span>
            <span class="status-value">${syncStatus.syncStatus || 'idle'}</span>
        </div>
        <div class="sync-info">
            <span class="status-label">云端版本:</span>
            <span class="status-value">${syncStatus.cloudRevision || 0}</span>
        </div>
        <div class="sync-actions">
            <button class="btn btn-secondary" id="btn-manual-sync">立即同步</button>
            <button class="btn btn-secondary" id="btn-force-push">强制上传本地</button>
            <button class="btn btn-secondary" id="btn-force-pull">强制下载云端</button>
        </div>
    </div>
`;
```

- [ ] **Step 2: 绑定手动同步事件**

```js
document.getElementById('btn-manual-sync')?.addEventListener('click', async () => {
    Utils.showLoading('同步中...');
    const result = await SyncAppService.manualSync();
    Utils.hideLoading();
    
    if (result.success) {
        Utils.showToast('同步成功', 'success');
        Overview.refresh();
    } else if (result.conflict) {
        SyncConflictModalHelper.show(result.conflicts, async (resolutions) => {
            await SyncAppService.resolveConflicts(result.conflicts, resolutions);
            Overview.refresh();
        });
    } else {
        Utils.showToast(result.reason || '同步失败', 'error');
    }
});
```

- [ ] **Step 3: 运行 JS lint 验证**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add js/toolPage.js
git commit -m "feat: 添加手动同步入口到工具箱"
```

---

## 验收标准检查

完成所有任务后，逐项验证：

- [ ] 未部署 Cloudflare Workers / D1 时，应用仍可作为纯本地版本正常运行
- [ ] 本地已有数据时，页面打开无需等待云端即可显示
- [ ] 云端无差异时不打扰用户
- [ ] 云端有差异时能自动合并非冲突记录
- [ ] 云端与本地存在冲突时能提示用户处理
- [ ] 本地删除记录不会在后续同步中被旧数据复活
- [ ] Workers / D1 异常时应用仍可使用本地数据
- [ ] 密码开关关闭时无密码页，开启时必须先通过密码验证
- [ ] 业务页面不直接依赖云端接口实现细节
- [ ] `npm run lint` 通过
- [ ] `npm test` 通过

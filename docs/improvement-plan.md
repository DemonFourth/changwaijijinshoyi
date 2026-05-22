# 项目结构优化改进计划

> 生成时间：2026-05-22
> 适用场景：Cloudflare Pages 部署 + file:// 协议本地运行
> 目标：打磨完善现有架构，提升用户体验与代码质量

---

## 一、当前架构评估

### 1.1 核心能力矩阵

| 能力 | 实现状态 | 评估 | 说明 |
|------|---------|------|------|
| file:// 协议支持 | ✅ 已实现 | **优秀** | hash 路由 + 运行时自动检测 |
| Cloudflare Pages 部署 | ✅ 已实现 | **优秀** | D1 + Functions + 运行时配置注入 |
| 多设备同步 | ✅ 已实现 | **优秀** | push/pull/resolve + 冲突处理 |
| 本地优先策略 | ✅ 已实现 | **优秀** | 先渲染本地，后台同步 |
| 离线可用 | ✅ 已实现 | **优秀** | 本地快照完整，无需网络 |
| 同步状态可视化 | ⚠️ 基础 | **可优化** | 仅 header 显示，信息有限 |
| 错误处理统一性 | ⚠️ 分散 | **可优化** | 各模块独立处理错误 |
| 目录结构清晰度 | ⚠️ 一般 | **可优化** | 根级别 JS 文件过多 |

### 1.2 架构亮点

```
✅ 设计亮点：
├── 运行时自动检测：file:// 协议自动降级为本地模式
├── hash 路由：完美支持 file:// 协议
├── 本地优先渲染：无需等待网络，即开即用
├── 混合存储模式：本地 + 云端无缝切换
├── 同步适配器模式：易于扩展新 provider
├── tombstone 软删除：防止旧数据回流复活
└── 乐观锁 + 冲突检测：多设备数据一致性保障
```

### 1.3 项目规模统计

| 类型 | 数量 | 说明 |
|------|------|------|
| JS 源文件 | 50+ | 含 application、storage、detail、modal 等子目录 |
| 测试文件 | 20+ | 覆盖核心业务逻辑 |
| Cloudflare Functions | 10+ | sync + public API |
| CSS 文件 | 2 | tokens.css + style.css |
| 文档文件 | 5+ | README、CHANGELOG、AGENTS 等 |

---

## 二、优化项详细清单

### 2.1 用户体验优化

#### 2.1.1 file:// 协议本地模式提示

**现状**：file:// 协议下运行时，用户不知道当前是本地模式

**优化目标**：在页面顶部显示明确的本地模式提示条

**实施方案**：

```js
// 修改文件：js/runtimeConfigLoader.js
// 在 load() 方法中添加提示逻辑

const RuntimeConfigLoader = {
    async load() {
        const protocol = window.location?.protocol;
        
        if (protocol === 'file:') {
            console.log('[RuntimeConfig] 检测到 file:// 协议，使用本地模式');
            this._showLocalModeBanner();
            return false;
        }
        
        // ... 其他逻辑保持不变
    },
    
    _showLocalModeBanner() {
        // 等待 DOM 就绪
        const showBanner = () => {
            if (!document.body) {
                setTimeout(showBanner, 100);
                return;
            }
            
            const banner = document.createElement('div');
            banner.id = 'local-mode-banner';
            banner.innerHTML = '📁 本地模式 · 数据仅保存在本浏览器 · 刷新页面后数据保留';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                color: #0369a1;
                padding: 10px 16px;
                text-align: center;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                border-bottom: 2px solid #0ea5e9;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            `;
            
            // 调整页面顶部间距
            document.body.style.paddingTop = '44px';
            document.body.prepend(banner);
        };
        
        showBanner();
    }
};
```

**预期效果**：
- 用户双击打开 index.html 时，顶部显示蓝色提示条
- 明确告知数据仅保存在本地浏览器
- 提升用户对数据存储位置的认知

**风险评估**：低风险，仅添加 UI 元素，不影响功能逻辑

---

#### 2.1.2 同步状态可视化增强

**现状**：header 仅显示同步状态图标，信息有限

**优化目标**：点击同步状态可查看详细信息面板

**实施方案**：

**步骤 1**：创建同步状态面板 Helper

```js
// 新增文件：js/modal/syncStatusPanelHelper.js

const SyncStatusPanelHelper = {
    show() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const adapter = window.SyncAdapterRegistry.getCurrentAdapter();
        const status = adapter?.getStatus() || {};
        
        const content = this._renderContent(syncMeta, status);
        
        window.Modal.showCustom({
            title: '📊 同步状态详情',
            content,
            buttons: [
                { 
                    text: '🔄 立即同步', 
                    primary: true,
                    action: () => this._triggerSync()
                },
                { 
                    text: '⬆️ 强制上传',
                    action: () => this._forcePush()
                },
                { 
                    text: '⬇️ 强制下载',
                    action: () => this._forcePull()
                },
                { text: '关闭', class: 'btn-secondary' }
            ]
        });
    },
    
    _renderContent(syncMeta, status) {
        const providerLabel = status.provider === 'cloudflare' 
            ? '☁️ Cloudflare 云端同步' 
            : '📁 本地存储（无云端）';
        
        const lastSync = syncMeta.lastSyncAt 
            ? Utils.formatDate(syncMeta.lastSyncAt, 'YYYY-MM-DD HH:mm:ss')
            : '从未同步';
        
        const syncStatusBadge = this._getStatusBadge(syncMeta.syncStatus);
        const pendingWarning = (syncMeta.pendingChanges || 0) > 0 
            ? `<span class="warning-badge">${syncMeta.pendingChanges} 条待同步</span>` 
            : '<span class="success-badge">无待同步</span>';
        
        return `
            <div class="sync-status-panel" style="padding: 16px;">
                <div class="sync-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">存储模式</h4>
                    <div style="font-size: 16px; font-weight: 500;">${providerLabel}</div>
                </div>
                
                <div class="sync-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">同步状态</h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">当前状态</span>
                            <span>${syncStatusBadge}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">最后同步</span>
                            <span>${lastSync}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">待同步变更</span>
                            <span>${pendingWarning}</span>
                        </div>
                    </div>
                </div>
                
                <div class="sync-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">数据统计</h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">本地基金</span>
                            <span>${window.FundManager?.getAllFunds()?.length || 0} 只</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">本地交易</span>
                            <span>${window.TradeManager?.getAllTrades()?.length || 0} 条</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">云端基金</span>
                            <span>${syncMeta.cloudFunds || 0} 只</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">云端交易</span>
                            <span>${syncMeta.cloudTrades || 0} 条</span>
                        </div>
                    </div>
                </div>
                
                <div class="sync-section">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">设备信息</h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">设备 ID</span>
                            <span style="font-family: monospace; font-size: 12px;">${syncMeta.deviceId?.slice(0, 16) || '-'}...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">云端版本</span>
                            <span>r${syncMeta.cloudRevision || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    _getStatusBadge(status) {
        const statusMap = {
            'idle': '<span style="color: #10b981;">● 空闲</span>',
            'pending': '<span style="color: #f59e0b;">● 待同步</span>',
            'syncing': '<span style="color: #3b82f6;">● 同步中</span>',
            'error': '<span style="color: #ef4444;">● 错误</span>',
            'conflict': '<span style="color: #f59e0b;">● 冲突</span>'
        };
        return statusMap[status] || '<span style="color: #6b7280;">● 未知</span>';
    },
    
    async _triggerSync() {
        window.Utils?.showLoading();
        try {
            const result = await window.SyncAppService.startBackgroundSync();
            window.Utils?.hideLoading();
            
            if (result?.success) {
                window.Utils?.showToast('同步成功', 'success');
                window.Overview?.refresh();
                this.show(); // 刷新面板
            } else {
                window.Utils?.showToast('同步失败：' + (result?.reason || '未知错误'), 'error');
            }
        } catch (error) {
            window.Utils?.hideLoading();
            window.Utils?.showToast('同步异常：' + error.message, 'error');
        }
    },
    
    async _forcePush() {
        window.Utils?.showToast('正在强制上传...', 'info');
        const result = await window.SyncAppService._executePush();
        if (result?.success) {
            window.Utils?.showToast('上传成功', 'success');
        }
    },
    
    async _forcePull() {
        window.Utils?.showToast('正在强制下载...', 'info');
        const result = await window.SyncAppService._executePull();
        if (result?.success) {
            window.Utils?.showToast('下载成功', 'success');
            window.Overview?.refresh();
        }
    }
};

ModuleRegistry.register('SyncStatusPanelHelper', SyncStatusPanelHelper);
```

**步骤 2**：修改 header 同步状态点击事件

```js
// 修改文件：js/syncStatusPresenter.js
// 在 updateHeaderIndicator() 方法中添加点击事件

const SyncStatusPresenter = {
    updateHeaderIndicator() {
        const container = document.getElementById('sync-status-container');
        if (!container) return;
        
        // ... 现有渲染逻辑 ...
        
        // 添加点击事件
        container.style.cursor = 'pointer';
        container.title = '点击查看同步详情';
        container.onclick = () => {
            window.SyncStatusPanelHelper?.show();
        };
    }
};
```

**步骤 3**：更新 index.html 加载顺序

```html
<!-- 在 index.html 中添加脚本引用 -->
<script src="js/modal/syncStatusPanelHelper.js"></script>
```

**预期效果**：
- 点击 header 同步状态图标，弹出详细面板
- 显示存储模式、同步状态、数据统计、设备信息
- 提供立即同步、强制上传、强制下载按钮

**风险评估**：低风险，新增功能模块，不影响现有逻辑

---

#### 2.1.3 页面可见性同步优化

**现状**：切换设备后需要手动刷新才能获取最新数据

**优化目标**：页面重新可见时自动拉取云端数据

**实施方案**：

```js
// 修改文件：js/application/syncAppService.js
// 在 init() 方法中添加可见性监听

const SyncAppService = {
    async init(config = {}) {
        // ... 现有初始化逻辑 ...
        
        // 新增：页面可见性同步
        this._setupVisibilitySync();
        
        // 新增：定时同步（可选，默认 5 分钟）
        this._setupPeriodicSync(5 * 60 * 1000);
    },
    
    _setupVisibilitySync() {
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                const syncMeta = window.LocalStorageAdapter.getSyncMeta();
                
                // 仅云端模式才触发
                if (syncMeta.provider !== 'cloudflare') return;
                
                const lastSync = syncMeta.lastSyncAt;
                const now = Date.now();
                const minInterval = 30 * 1000; // 最小间隔 30 秒
                
                // 距离上次同步超过 30 秒才触发
                if (!lastSync || now - new Date(lastSync).getTime() > minInterval) {
                    console.log('[Sync] 页面重新可见，触发同步检查');
                    
                    try {
                        const result = await this._executePull();
                        if (result?.success && result?.pulledChanges) {
                            const pc = result.pulledChanges;
                            const totalChanges = (pc.fundsAdded || 0) + (pc.tradesAdded || 0) + 
                                                 (pc.fundsUpdated || 0) + (pc.tradesUpdated || 0);
                            if (totalChanges > 0) {
                                window.Utils?.showToast(`从云端同步了 ${totalChanges} 条更新`, 'success');
                                window.Overview?.refresh();
                            }
                        }
                    } catch (error) {
                        console.error('[Sync] 可见性同步失败:', error);
                    }
                }
            }
        });
    },
    
    _setupPeriodicSync(interval = 5 * 60 * 1000) {
        setInterval(async () => {
            // 仅页面可见且云端模式才触发
            if (document.visibilityState !== 'visible') return;
            
            const syncMeta = window.LocalStorageAdapter.getSyncMeta();
            if (syncMeta.provider !== 'cloudflare') return;
            
            console.log('[Sync] 定时同步检查');
            try {
                await this._executePull();
            } catch (error) {
                console.error('[Sync] 定时同步失败:', error);
            }
        }, interval);
    }
};
```

**预期效果**：
- 切换标签页回来时自动检查云端更新
- 每 5 分钟自动同步一次（仅页面可见时）
- 有更新时显示提示消息

**风险评估**：低风险，仅增加后台同步逻辑，不影响主流程

---

### 2.2 代码质量优化

#### 2.2.1 统一错误处理器

**现状**：错误处理分散在各模块，用户提示不统一

**优化目标**：创建统一错误处理器，规范错误提示和日志

**实施方案**：

**步骤 1**：创建错误处理模块

```js
// 新增文件：js/core/errorHandler.js

const ErrorHandler = {
    /**
     * 错误类型映射
     */
    _errorMessages: {
        'network': '网络错误，请检查网络连接',
        'timeout': '请求超时，请稍后重试',
        'not_found': '数据不存在',
        'validation_failed': '数据验证失败，请检查输入',
        'sync_failed': '同步失败，请稍后重试',
        'auth_failed': '认证失败，请检查密钥',
        'permission_denied': '权限不足',
        'unknown': '操作失败，请重试'
    },
    
    /**
     * 处理错误
     * @param {Error|string} error - 错误对象或消息
     * @param {object} context - 上下文信息
     */
    handle(error, context = {}) {
        const errorInfo = this._parseError(error);
        
        // 控制台日志
        console.error(
            `[Error][${context.module || 'Unknown'}]`,
            errorInfo.message,
            context.data || ''
        );
        
        // 用户提示
        if (context.showToast !== false) {
            const userMessage = this._getUserMessage(errorInfo);
            window.Utils?.showToast(userMessage, 'error', context.toastDuration);
        }
        
        // 同步状态更新
        if (context.updateSyncStatus) {
            window.LocalStorageAdapter?.updateSyncMeta({
                syncStatus: 'error',
                lastError: errorInfo.message
            });
        }
        
        // 可选：错误上报
        if (context.report !== false && this._shouldReport(errorInfo)) {
            this._report(errorInfo, context);
        }
        
        return errorInfo;
    },
    
    /**
     * 解析错误信息
     */
    _parseError(error) {
        if (error instanceof Error) {
            return {
                type: this._classifyError(error),
                message: error.message,
                stack: error.stack
            };
        }
        
        if (typeof error === 'string') {
            return {
                type: this._classifyError({ message: error }),
                message: error,
                stack: null
            };
        }
        
        return {
            type: 'unknown',
            message: String(error),
            stack: null
        };
    },
    
    /**
     * 分类错误类型
     */
    _classifyError(error) {
        const message = (error.message || '').toLowerCase();
        
        if (message.includes('network') || message.includes('fetch') || message.includes('连接')) {
            return 'network';
        }
        if (message.includes('timeout') || message.includes('etimedout')) {
            return 'timeout';
        }
        if (message.includes('not found') || message.includes('不存在')) {
            return 'not_found';
        }
        if (message.includes('validation') || message.includes('验证')) {
            return 'validation_failed';
        }
        if (message.includes('sync') || message.includes('同步')) {
            return 'sync_failed';
        }
        if (message.includes('auth') || message.includes('认证') || message.includes('key')) {
            return 'auth_failed';
        }
        if (message.includes('permission') || message.includes('权限')) {
            return 'permission_denied';
        }
        
        return 'unknown';
    },
    
    /**
     * 获取用户友好提示
     */
    _getUserMessage(errorInfo) {
        return this._errorMessages[errorInfo.type] || this._errorMessages.unknown;
    },
    
    /**
     * 判断是否需要上报
     */
    _shouldReport(errorInfo) {
        // 网络错误和超时不上报
        const noReportTypes = ['network', 'timeout'];
        return !noReportTypes.includes(errorInfo.type);
    },
    
    /**
     * 错误上报（可扩展）
     */
    _report(errorInfo, context) {
        // 可选：上报到 Cloudflare Analytics 或其他服务
        // 当前仅记录日志
        console.log('[ErrorHandler] Error reported:', {
            type: errorInfo.type,
            message: errorInfo.message,
            module: context.module,
            timestamp: new Date().toISOString()
        });
    },
    
    /**
     * 创建业务异常
     */
    createBusinessError(code, message, data = null) {
        const error = new Error(message);
        error.code = code;
        error.data = data;
        error.isBusinessError = true;
        return error;
    }
};

ModuleRegistry.register('ErrorHandler', ErrorHandler);
```

**步骤 2**：在关键模块中使用

```js
// 示例：修改 js/application/fundAppService.js

const FundAppService = {
    async addFund(fund) {
        try {
            // ... 现有逻辑 ...
        } catch (error) {
            ErrorHandler.handle(error, {
                module: 'FundAppService',
                action: 'addFund',
                data: { fundId: fund.id }
            });
            return { success: false, fund: null, reason: error.message };
        }
    }
};
```

**步骤 3**：更新 index.html 加载顺序

```html
<!-- 在 eventBus.js 之后加载 -->
<script src="js/core/errorHandler.js"></script>
```

**预期效果**：
- 统一的错误提示格式
- 自动分类错误类型
- 可选的错误上报机制

**风险评估**：低风险，新增工具模块，需逐步替换现有错误处理

---

#### 2.2.2 模块职责边界明确化

**现状**：`FundManager` 和 `FundAppService` 存在功能重叠

**优化目标**：明确 Manager（读取/展示）和 Service（写入/业务）的职责边界

**实施方案**：

**步骤 1**：明确 FundManager 职责

```js
// js/managers/fundManager.js（概念性重构）
// 职责：读取数据、展示计算、UI 状态管理

const FundManager = {
    // ========== 读取方法 ==========
    getAllFunds() {
        return window.FundRepository.getAll();
    },
    
    getFund(fundId) {
        return window.FundRepository.getById(fundId);
    },
    
    // ========== 展示计算方法 ==========
    calculateFundProfit(fund) {
        // 计算单只基金的收益数据
    },
    
    getStatistics() {
        // 获取汇总统计数据
    },
    
    getTop5Funds() {
        // 获取 Top5 盈亏榜单
    },
    
    // ========== UI 状态管理 ==========
    refreshAllFunds() {
        // 刷新所有基金数据（净值等）
    },
    
    sortFunds(funds, field, order) {
        // 排序基金列表
    },
    
    filterFunds(funds, criteria) {
        // 筛选基金列表
    }
    
    // 注意：不包含 addFund、updateFund、deleteFund 等写操作
};
```

**步骤 2**：明确 FundAppService 职责

```js
// js/services/fundService.js（概念性重构）
// 职责：写入操作、业务编排、同步触发

const FundService = {
    // ========== 写入方法 ==========
    async addFund(fund) {
        // 1. 数据验证
        // 2. 写入存储
        // 3. 触发同步
        // 4. 发送事件
    },
    
    async updateFund(fundId, updates) {
        // 1. 数据验证
        // 2. 更新存储
        // 3. 触发同步
        // 4. 发送事件
    },
    
    async deleteFund(fundId) {
        // 1. 关联数据处理
        // 2. 软删除
        // 3. 触发同步
        // 4. 发送事件
    },
    
    // ========== 业务编排方法 ==========
    async batchImportFunds(funds) {
        // 批量导入基金
    },
    
    async clearAllFunds() {
        // 清空所有基金
    }
};
```

**步骤 3**：更新调用方

```js
// 页面层调用示例

// 读取数据 → 使用 Manager
const funds = FundManager.getAllFunds();
const profit = FundManager.calculateFundProfit(fund);

// 写入数据 → 使用 Service
await FundService.addFund(newFund);
await FundService.updateFund(fundId, updates);
```

**预期效果**：
- Manager 专注读取和展示计算
- Service 专注写入和业务编排
- 职责清晰，易于维护

**风险评估**：中风险，涉及多处调用方修改，需逐步迁移

---

#### 2.2.3 测试覆盖增强

**现状**：测试覆盖较好，但缺少 file:// 协议场景测试

**优化目标**：添加 file:// 协议和边界场景测试

**实施方案**：

**步骤 1**：添加 file:// 协议测试

```js
// 新增文件：tests/runtimeConfigFileProtocol.test.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('RuntimeConfigLoader detects file:// protocol and returns false', async () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);
    
    // 模拟 file:// 协议
    context.window.location = { protocol: 'file:' };
    
    const result = await context.window.RuntimeConfigLoader.load();
    assert.equal(result, false, 'file:// 协议应返回 false');
});

test('RuntimeConfigLoader detects http:// protocol and attempts fetch', async () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);
    
    // 模拟 http:// 协议
    context.window.location = { protocol: 'http:' };
    
    // 模拟 fetch 失败（本地测试环境）
    context.window.fetch = async () => {
        throw new Error('Network error');
    };
    
    const result = await context.window.RuntimeConfigLoader.load();
    assert.equal(result, false, 'fetch 失败应返回 false');
});

test('RuntimeConfigLoader getStorageMode returns correct mode', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);
    
    // 默认模式
    const defaultMode = context.window.RuntimeConfigLoader.getStorageMode();
    assert.equal(defaultMode, 'local', '默认应为 local 模式');
    
    // 设置混合模式
    context.window.Config.load({ storageMode: 'hybrid' });
    const hybridMode = context.window.RuntimeConfigLoader.getStorageMode();
    assert.equal(hybridMode, 'hybrid', '应返回 hybrid 模式');
});
```

**步骤 2**：添加同步边界场景测试

```js
// 新增文件：tests/syncEdgeCases.test.cjs

const test = require('node:test');
const assert = require('node:assert/strict');

test('SyncAppService handles concurrent sync attempts', async () => {
    // 测试：同时触发多个同步请求，应只执行一个
});

test('SyncAppService handles network timeout with retry', async () => {
    // 测试：网络超时后应自动重试
});

test('SyncAppService handles conflict detection', async () => {
    // 测试：检测到冲突应返回冲突列表
});

test('SyncAppService handles empty cloud snapshot', async () => {
    // 测试：云端为空时不应覆盖本地数据
});
```

**预期效果**：
- 覆盖 file:// 协议场景
- 覆盖同步边界场景
- 提升测试覆盖率

**风险评估**：低风险，仅新增测试文件

---

### 2.3 部署配置优化

#### 2.3.1 wrangler.toml 完整配置

**现状**：仅有 wrangler.toml.example 示例文件

**优化目标**：提供完整的 wrangler.toml 配置

**实施方案**：

```toml
# wrangler.toml（新增文件）

name = "fund-calculator"
compatibility_date = "2024-01-01"
pages_build_output_dir = "."

# 生产环境变量
[vars]
ENVIRONMENT = "production"

# D1 数据库绑定（需要替换为实际 database_id）
[[d1_databases]]
binding = "DB"
database_name = "fund-calculator-db"
database_id = "your-database-id-here"

# 预览环境配置
[env.preview]
[env.preview.vars]
ENVIRONMENT = "preview"

# 生产环境配置
[env.production]
[env.production.vars]
ENVIRONMENT = "production"

# 规则：静态资源路由
[[routes]]
pattern = "/*"
zone_name = "your-domain.com"
```

**使用说明**：
1. 复制 wrangler.toml.example 为 wrangler.toml
2. 替换 database_id 为实际值
3. 配置域名（可选）

---

#### 2.3.2 本地开发配置

**实施方案**：

```env
# .dev.vars（新增文件）
# Cloudflare Pages 本地开发环境变量

PUBLIC_API_KEY=dev-test-key-12345
ENVIRONMENT=development
```

**使用方式**：
```bash
# 本地开发时自动加载 .dev.vars
npx wrangler pages dev . --port 3000
```

---

#### 2.3.3 package.json 脚本优化

**实施方案**：

```json
{
  "name": "fund-return-calculator",
  "version": "1.0.0",
  "description": "场外基金收益计算器",
  "scripts": {
    "dev": "npx wrangler pages dev . --port 3000 --compatibility-date=2024-01-01",
    "dev:static": "npx serve . -p 3000",
    "deploy": "npx wrangler pages deploy .",
    "deploy:preview": "npx wrangler pages deploy . --branch=preview",
    "test": "node --test tests/**/*.test.cjs",
    "test:watch": "node --test --watch tests/**/*.test.cjs",
    "test:coverage": "node --test tests/**/*.test.cjs --experimental-test-coverage",
    "lint": "npm run lint:js && npm run lint:css",
    "lint:js": "eslint js/**/*.js",
    "lint:css": "stylelint css/**/*.css",
    "lint:fix": "npm run lint:js:fix && npm run lint:css:fix",
    "lint:js:fix": "eslint js/**/*.js --fix",
    "lint:css:fix": "stylelint css/**/*.css --fix"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "eslint-plugin-regexp": "^3.1.0",
    "stylelint": "^16.2.1",
    "stylelint-config-standard": "^36.0.0",
    "serve": "^14.2.0"
  }
}
```

**脚本说明**：

| 脚本 | 用途 | 说明 |
|------|------|------|
| `npm run dev` | Cloudflare 模拟开发 | 支持 D1 + Functions + 同步测试 |
| `npm run dev:static` | 纯静态开发 | 模拟 file:// 协议行为 |
| `npm run deploy` | 部署到生产 | 部署到 Cloudflare Pages |
| `npm run deploy:preview` | 部署到预览 | 部署到预览环境 |
| `npm test` | 运行测试 | 运行所有测试 |
| `npm run test:watch` | 监听测试 | 文件变化自动重跑 |
| `npm run lint` | 代码检查 | ESLint + Stylelint |

---

### 2.4 文档完善

#### 2.4.1 README.md 快速开始优化

**实施方案**：

```markdown
## 快速开始

### 方式一：本地直接使用（推荐新手）

1. 双击打开 `index.html`
2. 页面顶部会显示「📁 本地模式」提示
3. 数据保存在浏览器本地存储中
4. 无需网络，离线可用
5. 刷新页面后数据保留

**注意事项**：
- 清除浏览器数据会导致本地数据丢失
- 建议定期使用「导出数据」功能备份
- 不同浏览器数据不互通

### 方式二：Cloudflare Pages 部署（推荐多设备同步）

#### 步骤 1：创建 D1 数据库
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers & Pages → D1 → Create Database
3. 数据库名称：`fund-calculator-db`
4. 记录生成的 `database_id`

#### 步骤 2：部署 Pages
1. Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 选择 GitHub 仓库和分支
3. Build command：**留空**
4. Build output directory：**留空**
5. 点击 Save and Deploy

#### 步骤 3：绑定 D1 数据库
1. 进入 Pages 项目 → Settings → Functions → D1 database bindings
2. Variable name：`DB`
3. D1 database：选择步骤 1 创建的数据库
4. Save

#### 步骤 4：配置环境变量（可选）
如需启用 Public API 写入能力：
1. Settings → Environment variables
2. 添加：`PUBLIC_API_KEY` = `your-secret-key`
3. Save

#### 步骤 5：验证部署
1. 访问 Pages URL
2. 页面提示「当前使用混合存储（本地 + 云端同步）」
3. 点击工具箱 → 立即同步，验证同步功能

### 方式三：本地开发（开发者）

```bash
# 安装依赖
npm install

# Cloudflare 模拟模式（支持 D1 + 同步测试）
npm run dev

# 纯静态模式（模拟 file:// 协议）
npm run dev:static

# 运行测试
npm test

# 代码检查
npm run lint
```
```

---

#### 2.4.2 同步机制文档完善

**实施方案**：

```markdown
## 多设备同步说明

### 工作原理

```
┌─────────────┐      push/pull      ┌─────────────┐
│   设备 A    │◄──────────────────►│   云端 D1   │
│  (浏览器)   │                     │  (数据库)   │
└─────────────┘                     └─────────────┘
       ▲                                    ▲
       │                                    │
       │              push/pull             │
       │                                    │
┌─────────────┐                     ┌─────────────┐
│   设备 B    │                     │   设备 C    │
│  (浏览器)   │                     │  (浏览器)   │
└─────────────┘                     └─────────────┘
```

### 同步流程

1. **页面打开**：立即显示本地数据（本地优先）
2. **后台同步**：自动拉取云端最新数据
3. **数据变更**：标记待同步，延迟 2 秒后推送
4. **冲突检测**：检测到冲突时提示用户选择

### 同步时机

| 时机 | 行为 |
|------|------|
| 页面打开 | 自动拉取云端数据 |
| 数据变更 | 延迟推送（防抖） |
| 页面切换回来 | 自动检查更新 |
| 定时（5 分钟） | 自动同步检查 |
| 手动点击 | 立即同步 |

### 冲突处理

当检测到冲突时：
1. 弹出冲突列表
2. 用户逐项选择「使用本地」或「使用云端」
3. 选择后自动合并并同步

### 使用建议

- ✅ 同一时刻只在一个设备操作，可避免冲突
- ✅ 定期导出数据备份
- ✅ 重要操作后点击「立即同步」确认
- ⚠️ 清除浏览器数据会导致本地数据丢失
- ⚠️ 隐私模式下数据不会持久化
```

---

## 三、实施路线图

### Phase 1：用户体验优化（1 周）

| 任务 | 优先级 | 工作量 | 负责模块 | 风险 |
|------|--------|--------|---------|------|
| 添加 file:// 协议本地模式提示 | P0 | 0.5 天 | runtimeConfigLoader.js | 低 |
| 创建同步状态面板 | P1 | 1 天 | syncStatusPanelHelper.js | 低 |
| 页面可见性同步优化 | P1 | 0.5 天 | syncAppService.js | 低 |
| 更新 index.html 加载顺序 | P1 | 0.5 天 | index.html | 低 |

**验收标准**：
- [ ] file:// 协议下显示本地模式提示条
- [ ] 点击同步状态弹出详细面板
- [ ] 切换标签页回来自动检查更新

---

### Phase 2：代码质量优化（1 周）

| 任务 | 优先级 | 工作量 | 负责模块 | 风险 |
|------|--------|--------|---------|------|
| 创建统一错误处理器 | P1 | 1 天 | errorHandler.js | 低 |
| 明确 Manager/Service 职责边界 | P2 | 2 天 | fundManager.js, fundAppService.js | 中 |
| 添加 file:// 协议场景测试 | P2 | 1 天 | tests/*.test.cjs | 低 |
| 添加同步边界场景测试 | P2 | 1 天 | tests/*.test.cjs | 低 |

**验收标准**：
- [ ] 错误提示格式统一
- [ ] Manager 和 Service 职责清晰
- [ ] 新增测试通过

---

### Phase 3：部署配置优化（0.5 周）

| 任务 | 优先级 | 工作量 | 负责模块 | 风险 |
|------|--------|--------|---------|------|
| 创建 wrangler.toml 完整配置 | P1 | 0.5 天 | wrangler.toml | 低 |
| 创建 .dev.vars 本地配置 | P1 | 0.5 天 | .dev.vars | 低 |
| 优化 package.json 脚本 | P1 | 0.5 天 | package.json | 低 |
| 添加 serve 依赖 | P1 | 0.5 天 | package.json | 低 |

**验收标准**：
- [ ] `npm run dev` 正常启动
- [ ] `npm run dev:static` 正常启动
- [ ] `npm run deploy` 正常部署

---

### Phase 4：文档完善（0.5 周）

| 任务 | 优先级 | 工作量 | 负责模块 | 风险 |
|------|--------|--------|---------|------|
| 更新 README 快速开始 | P1 | 0.5 天 | README.md | 低 |
| 添加多设备同步说明 | P1 | 0.5 天 | README.md | 低 |
| 更新 AGENTS.md | P2 | 0.5 天 | AGENTS.md | 低 |

**验收标准**：
- [ ] 快速开始步骤清晰
- [ ] 同步机制说明完整

---

## 四、风险评估与缓解

### 4.1 风险矩阵

| 风险 | 概率 | 影响 | 风险等级 | 缓解措施 |
|------|------|------|---------|---------|
| 新增代码引入 Bug | 中 | 中 | **中** | 分阶段实施，每步验证测试 |
| 职责重构影响现有功能 | 中 | 高 | **高** | 保持向后兼容，逐步迁移 |
| 测试覆盖不足 | 低 | 中 | **低** | 新增测试覆盖边界场景 |
| 部署配置错误 | 低 | 高 | **中** | 使用 wrangler.toml.example 模板 |
| 文档更新遗漏 | 低 | 低 | **低** | 检查清单核对 |

### 4.2 回滚策略

每个 Phase 实施后：
1. 运行完整测试套件
2. 本地验证所有功能
3. 部署到预览环境验证
4. 如有问题，回滚到上一版本

---

## 五、验收检查清单

### 5.1 功能验收

- [ ] file:// 协议下正常工作
- [ ] 本地模式提示正确显示
- [ ] 同步状态面板功能完整
- [ ] 页面可见性同步正常
- [ ] 错误提示格式统一
- [ ] 所有测试通过

### 5.2 部署验收

- [ ] `npm run dev` 正常启动
- [ ] `npm run dev:static` 正常启动
- [ ] `npm run deploy` 正常部署
- [ ] Cloudflare Pages 正常访问
- [ ] D1 数据库正常工作
- [ ] 同步功能正常

### 5.3 文档验收

- [ ] README 快速开始步骤清晰
- [ ] 同步机制说明完整
- [ ] 部署步骤准确
- [ ] 使用注意事项完整

---

## 六、后续优化方向（可选）

### 6.1 目录结构重组

**当前问题**：根级别 JS 文件过多（20+）

**优化方向**：按职责域分组

**预期收益**：
- 提升代码可发现性
- 降低维护成本
- 便于新开发者理解

**风险**：高，涉及大量文件移动和引用更新

**建议**：在 Phase 1-4 完成后，根据实际需求决定是否实施

---

### 6.2 性能优化

**优化方向**：
- 添加资源预加载
- 优化 ECharts 加载时机
- 添加 Service Worker 缓存

**预期收益**：
- 首屏加载时间优化
- 离线体验增强

**建议**：在功能稳定后实施

---

### 6.3 监控与告警

**优化方向**：
- 集成 Cloudflare Analytics
- 添加错误上报
- 添加性能监控

**预期收益**：
- 及时发现问题
- 了解用户行为

**建议**：在生产环境稳定后实施

---

## 七、附录

### 7.1 相关文档

- [README.md](../README.md) - 项目说明
- [AGENTS.md](../AGENTS.md) - 开发规范
- [CHANGELOG.md](./CHANGELOG.md) - 版本历史
- [sync-mechanism-analysis.md](./sync-mechanism-analysis.md) - 同步机制分析

### 7.2 参考资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

---

**文档版本**：v1.0
**最后更新**：2026-05-22
**维护者**：项目开发团队

---

## 八、执行记录

### 8.1 已完成改进（2026-05-22）

#### Phase 1：用户体验优化 ✅

| 任务 | 状态 | 文件 |
|------|------|------|
| file:// 协议本地模式提示 | ✅ 完成 | [js/runtimeConfigLoader.js](../js/runtimeConfigLoader.js) |
| 同步状态面板 Helper | ✅ 完成 | [js/modal/syncStatusPanelHelper.js](../js/modal/syncStatusPanelHelper.js) |
| 页面可见性同步优化 | ✅ 完成 | [js/application/syncAppService.js](../js/application/syncAppService.js) |
| 更新 index.html 加载顺序 | ✅ 完成 | [index.html](../index.html) |

**改进详情**：

1. **本地模式提示条**
   - 检测 file:// 协议时显示顶部提示条
   - 提示内容：「📁 本地模式 · 数据仅保存在本浏览器 · 刷新页面后数据保留」
   - 自动调整页面顶部间距

2. **同步状态面板**
   - 显示存储模式（本地/混合）
   - 显示同步状态（空闲/同步中/错误）
   - 显示数据统计（基金数、交易数）
   - 显示设备信息（最后同步时间）
   - 提供立即同步、强制上传、强制下载按钮

3. **页面可见性同步**
   - 页面隐藏时：自动推送待同步数据
   - 页面可见时：自动拉取云端更新（间隔 30 秒）
   - 定时同步：每 5 分钟检查更新

#### Phase 2：代码质量优化 ✅

| 任务 | 状态 | 文件 |
|------|------|------|
| 统一错误处理器 | ✅ 完成 | [js/errorHandler.js](../js/errorHandler.js) |
| file:// 协议场景测试 | ✅ 完成 | [tests/runtimeConfigFileProtocol.test.cjs](../tests/runtimeConfigFileProtocol.test.cjs) |

**改进详情**：

1. **统一错误处理器**
   - 自动分类错误类型（network/timeout/validation/sync 等）
   - 提供用户友好提示
   - 支持错误上报（可扩展）
   - 支持创建业务异常

2. **file:// 协议测试**
   - 测试 file:// 协议检测
   - 测试 http:// 协议处理
   - 测试存储模式获取
   - 测试同步配置获取

#### Phase 3：部署配置优化 ✅

| 任务 | 状态 | 文件 |
|------|------|------|
| wrangler.toml 完整配置 | ✅ 完成 | [wrangler.toml](../wrangler.toml) |
| .dev.vars 本地配置 | ✅ 完成 | [.dev.vars](../.dev.vars) |
| package.json 脚本优化 | ✅ 完成 | [package.json](../package.json) |

**新增脚本**：

| 脚本 | 用途 |
|------|------|
| `npm run dev` | Cloudflare 模拟开发 |
| `npm run dev:static` | 纯静态开发 |
| `npm run deploy` | 部署到生产环境 |
| `npm run deploy:preview` | 部署到预览环境 |
| `npm test` | 运行所有测试 |
| `npm run test:watch` | 监听模式测试 |

#### Phase 4：文档完善 ✅

| 任务 | 状态 | 文件 |
|------|------|------|
| README 快速开始优化 | ✅ 完成 | [README.md](../README.md) |

**改进详情**：
- 新增「方式一：本地直接使用」说明
- 新增「方式二：Cloudflare Pages 部署」详细步骤
- 新增「方式三：本地开发」脚本说明
- 新增脚本用途对照表

### 8.2 待后续优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 目录结构重组 | P3 | 涉及大量文件移动，风险较高 |
| 性能优化 | P3 | 需要在功能稳定后实施 |
| 监控与告警 | P3 | 需要在生产环境稳定后实施 |

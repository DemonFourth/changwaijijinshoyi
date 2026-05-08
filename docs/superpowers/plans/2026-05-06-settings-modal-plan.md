# 设置弹窗功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现设置按钮弹窗功能，包含数字显示/交易默认/分红设置/显示设置/数据管理5个标签页

**Architecture:** 使用现有Modal弹窗系统，在modal.js中添加settings类型处理，通过Storage.loadSettings()/saveSettings()持久化设置

**Tech Stack:** 原生JavaScript、LocalStorage、现有Modal弹窗系统

---

## 文件结构

- Modify: `js/app.js` - 添加设置按钮点击事件绑定
- Modify: `js/modal.js` - 添加设置弹窗渲染和事件绑定
- Modify: `css/style.css` - 添加设置弹窗样式
- Read: `js/storage.js` - 确认设置存储方法

---

## 任务 1: 在 app.js 中绑定设置按钮点击事件

**Files:**
- Modify: `js/app.js:92-114` (在setupToolsButton方法后添加setupSettingsButton)

- [ ] **Step 1: 添加 setupSettingsButton 方法**

在 `js/app.js` 的 `App` 对象中，在 `setupToolsButton` 方法后添加：

```javascript
/**
 * 设置设置按钮
 */
setupSettingsButton() {
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            Modal.show('settings');
        });
    }
},
```

- [ ] **Step 2: 在 init 方法中调用 setupSettingsButton**

在 `js/app.js` 的 `init` 方法中，找到 `this.setupToolsButton();`（约第55行），在其后添加：

```javascript
// 绑定设置按钮
this.setupSettingsButton();
```

- [ ] **Step 3: 验证代码**

查找 `js/app.js` 确认：
1. `setupSettingsButton` 方法已添加
2. `init` 方法中已调用 `this.setupSettingsButton()`

---

## 任务 2: 在 modal.js 中添加设置弹窗渲染

**Files:**
- Modify: `js/modal.js:29-66` (switch case添加settings)
- Modify: `js/modal.js:80-102` (switch case添加事件绑定)
- Create: `js/modal.js` 末尾添加 renderSettingsForm 和 bindSettingsEvents 方法

- [ ] **Step 1: 在 switch case 添加 settings 类型**

在 `js/modal.js` 的 `show` 方法中，找到 `switch (type)` 的 case 列表（约第29-66行），在 `case 'feeSettings':` 后添加：

```javascript
case 'settings':
    title.textContent = '⚙️ 设置';
    result = Modal.renderSettingsForm();
    break;
```

- [ ] **Step 2: 在事件绑定 switch 添加 settings**

在 `js/modal.js` 的 `show` 方法中，找到第二个 `switch (type)` （约第80-102行），在 `case 'feeSettings':` 后添加：

```javascript
case 'settings':
    Modal.bindSettingsEvents();
    break;
```

- [ ] **Step 3: 添加 renderSettingsForm 方法**

在 `js/modal.js` 文件末尾（约第999行后），添加：

```javascript
/**
 * 渲染设置表单
 */
renderSettingsForm() {
    const settings = Storage.loadSettings() || {};
    const defaults = {
        bigNumberEnabled: true,
        bigNumberWanThreshold: 10000,
        bigNumberYiThreshold: 100000000,
        defaultBuyFee: 0,
        defaultSellFee: 0,
        defaultDividendMode: 'cash',
        defaultViewMode: 'card',
        defaultSortField: 'profitRate',
        defaultSortOrder: 'desc',
        defaultPageSize: 10
    };
    const s = { ...defaults, ...settings };

    const content = `
        <div class="settings-modal">
            <div class="settings-tabs-nav">
                <button class="settings-tab-btn active" data-tab="number">数字显示</button>
                <button class="settings-tab-btn" data-tab="trade">交易默认</button>
                <button class="settings-tab-btn" data-tab="dividend">分红设置</button>
                <button class="settings-tab-btn" data-tab="display">显示设置</button>
                <button class="settings-tab-btn" data-tab="data">数据管理</button>
            </div>
            <div class="settings-tabs-content">
                <!-- 数字显示 -->
                <div class="settings-tab-panel active" data-panel="number">
                    <div class="settings-group">
                        <div class="settings-label-row">
                            <span class="settings-label">大数字转换</span>
                            <label class="settings-toggle">
                                <input type="checkbox" id="settings-big-number-enabled" ${s.bigNumberEnabled ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="settings-desc">超过阈值自动转换为"万"/"亿"单位显示</div>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">万级阈值</div>
                        <div class="settings-input-group">
                            <input type="number" class="settings-input" id="settings-wan-threshold" value="${s.bigNumberWanThreshold}">
                            <span class="input-suffix">元</span>
                        </div>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">亿级阈值</div>
                        <div class="settings-input-group">
                            <input type="number" class="settings-input" id="settings-yi-threshold" value="${s.bigNumberYiThreshold}">
                            <span class="input-suffix">元</span>
                        </div>
                    </div>
                </div>
                <!-- 交易默认 -->
                <div class="settings-tab-panel" data-panel="trade">
                    <div class="settings-group">
                        <div class="settings-label">默认买入费率</div>
                        <div class="settings-input-group">
                            <input type="number" class="settings-input" id="settings-default-buy-fee" value="${s.defaultBuyFee}" step="0.01">
                            <span class="input-suffix">%</span>
                        </div>
                        <div class="settings-desc">新增交易时的默认买入手续费率</div>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">默认卖出费率</div>
                        <div class="settings-input-group">
                            <input type="number" class="settings-input" id="settings-default-sell-fee" value="${s.defaultSellFee}" step="0.01">
                            <span class="input-suffix">%</span>
                        </div>
                        <div class="settings-desc">新增交易时的默认卖出手续费率</div>
                    </div>
                </div>
                <!-- 分红设置 -->
                <div class="settings-tab-panel" data-panel="dividend">
                    <div class="settings-group">
                        <div class="settings-label">默认分红方式</div>
                        <div class="settings-radio-group">
                            <label class="settings-radio-item">
                                <input type="radio" name="settings-dividend-mode" value="cash" ${s.defaultDividendMode === 'cash' ? 'checked' : ''}>
                                <span class="radio-circle"></span>
                                <span class="radio-label">现金分红</span>
                            </label>
                            <label class="settings-radio-item">
                                <input type="radio" name="settings-dividend-mode" value="reinvest" ${s.defaultDividendMode === 'reinvest' ? 'checked' : ''}>
                                <span class="radio-circle"></span>
                                <span class="radio-label">红利再投</span>
                            </label>
                        </div>
                    </div>
                </div>
                <!-- 显示设置 -->
                <div class="settings-tab-panel" data-panel="display">
                    <div class="settings-group">
                        <div class="settings-label">默认视图模式</div>
                        <select class="settings-select" id="settings-view-mode">
                            <option value="card" ${s.defaultViewMode === 'card' ? 'selected' : ''}>卡片视图</option>
                            <option value="list" ${s.defaultViewMode === 'list' ? 'selected' : ''}>列表视图</option>
                        </select>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">默认排序字段</div>
                        <select class="settings-select" id="settings-sort-field">
                            <option value="profitRate" ${s.defaultSortField === 'profitRate' ? 'selected' : ''}>收益率</option>
                            <option value="marketValue" ${s.defaultSortField === 'marketValue' ? 'selected' : ''}>市值</option>
                            <option value="fundCode" ${s.defaultSortField === 'fundCode' ? 'selected' : ''}>基金代码</option>
                            <option value="investAmount" ${s.defaultSortField === 'investAmount' ? 'selected' : ''}>投入金额</option>
                        </select>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">排序方向</div>
                        <div class="settings-radio-group">
                            <label class="settings-radio-item">
                                <input type="radio" name="settings-sort-order" value="asc" ${s.defaultSortOrder === 'asc' ? 'checked' : ''}>
                                <span class="radio-circle"></span>
                                <span class="radio-label">升序</span>
                            </label>
                            <label class="settings-radio-item">
                                <input type="radio" name="settings-sort-order" value="desc" ${s.defaultSortOrder === 'desc' ? 'checked' : ''}>
                                <span class="radio-circle"></span>
                                <span class="radio-label">降序</span>
                            </label>
                        </div>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">每页显示条数</div>
                        <select class="settings-select" id="settings-page-size">
                            <option value="10" ${s.defaultPageSize === 10 ? 'selected' : ''}>10条</option>
                            <option value="20" ${s.defaultPageSize === 20 ? 'selected' : ''}>20条</option>
                            <option value="50" ${s.defaultPageSize === 50 ? 'selected' : ''}>50条</option>
                        </select>
                    </div>
                </div>
                <!-- 数据管理 -->
                <div class="settings-tab-panel" data-panel="data">
                    <div class="settings-data-buttons">
                        <button class="settings-data-btn" id="btn-settings-export">
                            <div class="data-btn-icon">📤</div>
                            <div class="data-btn-text">
                                <div class="data-btn-title">导出数据</div>
                                <div class="data-btn-desc">下载所有基金和交易记录为JSON文件</div>
                            </div>
                        </button>
                        <button class="settings-data-btn" id="btn-settings-import">
                            <div class="data-btn-icon">📥</div>
                            <div class="data-btn-text">
                                <div class="data-btn-title">导入数据</div>
                                <div class="data-btn-desc">从JSON文件导入数据（支持合并/覆盖）</div>
                            </div>
                        </button>
                        <button class="settings-data-btn settings-data-btn-danger" id="btn-settings-clear">
                            <div class="data-btn-icon">🗑️</div>
                            <div class="data-btn-text">
                                <div class="data-btn-title">清除所有数据</div>
                                <div class="data-btn-desc">删除所有基金和交易记录，此操作不可恢复</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    return {
        content: content,
        actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                 '<button class="btn btn-primary" id="btn-save-settings">保存设置</button>'
    };
},
```

- [ ] **Step 4: 添加 bindSettingsEvents 方法**

在 `renderSettingsForm` 方法后添加：

```javascript
/**
 * 绑定设置弹窗事件
 */
bindSettingsEvents() {
    // 标签页切换
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-tab-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.dataset.tab;
            document.querySelector(`.settings-tab-panel[data-panel="${tabId}"]`).classList.add('active');
        });
    });

    // 保存设置
    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const settings = {
                bigNumberEnabled: document.getElementById('settings-big-number-enabled')?.checked ?? true,
                bigNumberWanThreshold: parseInt(document.getElementById('settings-wan-threshold')?.value) || 10000,
                bigNumberYiThreshold: parseInt(document.getElementById('settings-yi-threshold')?.value) || 100000000,
                defaultBuyFee: parseFloat(document.getElementById('settings-default-buy-fee')?.value) || 0,
                defaultSellFee: parseFloat(document.getElementById('settings-default-sell-fee')?.value) || 0,
                defaultDividendMode: document.querySelector('input[name="settings-dividend-mode"]:checked')?.value || 'cash',
                defaultViewMode: document.getElementById('settings-view-mode')?.value || 'card',
                defaultSortField: document.getElementById('settings-sort-field')?.value || 'profitRate',
                defaultSortOrder: document.querySelector('input[name="settings-sort-order"]:checked')?.value || 'desc',
                defaultPageSize: parseInt(document.getElementById('settings-page-size')?.value) || 10
            };
            Storage.saveSettings(settings);
            Modal.hide();
            Utils.showToast('设置已保存');
            EventBus.emit(EventType.SETTINGS_CHANGED, settings);
        });
    }

    // 导出数据
    const btnExport = document.getElementById('btn-settings-export');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const data = Storage.exportAll();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `基金计算器数据_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            Utils.showToast('数据导出成功');
        });
    }

    // 导入数据
    const btnImport = document.getElementById('btn-settings-import');
    if (btnImport) {
        btnImport.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const success = Storage.importAll(data, false);
                    if (success) {
                        Utils.showToast('数据导入成功');
                        EventBus.emit(EventType.DATA_IMPORTED);
                    } else {
                        Utils.showToast('数据格式错误', 'error');
                    }
                } catch (err) {
                    Utils.showToast('导入失败: ' + err.message, 'error');
                }
            };
            input.click();
        });
    }

    // 清除数据
    const btnClear = document.getElementById('btn-settings-clear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
                localStorage.clear();
                Utils.showToast('数据已清除');
                EventBus.emit(EventType.DATA_CLEARED);
                location.reload();
            }
        });
    }
},
```

- [ ] **Step 5: 验证 modal.js 修改**

确认：
1. switch case 中添加了 `case 'settings'`
2. 事件绑定 switch 中添加了 `case 'settings'`
3. `renderSettingsForm` 方法已添加
4. `bindSettingsEvents` 方法已添加

---

## 任务 3: 添加设置弹窗样式

**Files:**
- Modify: `css/style.css` 末尾添加样式

- [ ] **Step 1: 添加设置弹窗样式**

在 `css/style.css` 文件末尾（约第2791行），添加：

```css
/* 设置弹窗样式 */
.settings-modal {
    min-height: 350px;
}

.settings-tabs-nav {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
    background: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border-primary);
    overflow-x: auto;
}

.settings-tab-btn {
    padding: 8px 14px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    transition: all 0.2s;
    font-weight: 500;
}

.settings-tab-btn:hover {
    background: var(--color-border-secondary);
}

.settings-tab-btn.active {
    background: var(--color-brand-secondary);
    color: #2d5a45;
}

.settings-tabs-content {
    padding: 20px 24px;
}

.settings-tab-panel {
    display: none;
    animation: fadeIn 0.3s ease;
}

.settings-tab-panel.active {
    display: block;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

.settings-group {
    margin-bottom: 20px;
}

.settings-group:last-child {
    margin-bottom: 0;
}

.settings-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.settings-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 8px;
    display: block;
}

.settings-label-row .settings-label {
    margin-bottom: 0;
}

.settings-desc {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    margin-top: 4px;
}

.settings-input-group {
    display: flex;
    align-items: center;
}

.settings-input {
    padding: 10px 14px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    width: 160px;
    transition: all 0.2s;
    background: var(--color-bg-card);
}

.settings-input:focus {
    outline: none;
    border-color: var(--color-brand-primary);
    box-shadow: 0 0 0 3px rgba(136, 216, 176, 0.15);
}

.input-suffix {
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
    margin-left: 8px;
}

.settings-select {
    padding: 10px 14px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    width: 160px;
    cursor: pointer;
    background: var(--color-bg-card);
    transition: all 0.2s;
}

.settings-select:focus {
    outline: none;
    border-color: var(--color-brand-primary);
}

.settings-toggle {
    position: relative;
    width: 48px;
    height: 26px;
    display: inline-block;
}

.settings-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.settings-toggle .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--color-border-primary);
    border-radius: 26px;
    transition: 0.3s;
}

.settings-toggle .toggle-slider::before {
    content: '';
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.settings-toggle input:checked + .toggle-slider {
    background: var(--color-brand-primary);
}

.settings-toggle input:checked + .toggle-slider::before {
    transform: translateX(22px);
}

.settings-radio-group {
    display: flex;
    gap: 16px;
}

.settings-radio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.settings-radio-item input {
    display: none;
}

.settings-radio-item .radio-circle {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border-primary);
    border-radius: 50%;
    position: relative;
    transition: all 0.2s;
}

.settings-radio-item input:checked + .radio-circle {
    border-color: var(--color-brand-primary);
}

.settings-radio-item input:checked + .radio-circle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: var(--color-brand-primary);
    border-radius: 50%;
}

.settings-radio-item .radio-label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
}

.settings-data-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.settings-data-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    background: var(--color-bg-card);
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: all 0.2s;
}

.settings-data-btn:hover {
    border-color: var(--color-brand-primary);
    background: var(--color-bg-elevated);
}

.settings-data-btn-danger:hover {
    border-color: var(--color-danger);
}

.settings-data-btn .data-btn-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

.settings-data-btn:nth-child(1) .data-btn-icon {
    background: rgba(104, 211, 145, 0.15);
    color: #38a169;
}

.settings-data-btn:nth-child(2) .data-btn-icon {
    background: rgba(66, 153, 225, 0.15);
    color: #3182ce;
}

.settings-data-btn:nth-child(3) .data-btn-icon {
    background: rgba(252, 129, 129, 0.15);
    color: #e53e3e;
}

.settings-data-btn .data-btn-text {
    flex: 1;
}

.settings-data-btn .data-btn-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-primary);
}

.settings-data-btn .data-btn-desc {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    margin-top: 2px;
}

/* 设置弹窗宽度控制 */
.modal-container.modal-settings .modal {
    max-width: 600px;
}
```

- [ ] **Step 2: 验证样式已添加**

确认 `css/style.css` 末尾已添加设置弹窗相关样式

---

## 任务 4: 添加事件类型常量（可选）

**Files:**
- Modify: `js/eventBus.js` (如需要)

- [ ] **Step 1: 检查是否需要添加事件类型**

查看 `js/eventBus.js` 中是否已有 `SETTINGS_CHANGED` 事件类型，如果没有则添加：

```javascript
SETTINGS_CHANGED: 'settings_changed',
DATA_IMPORTED: 'data_imported',
DATA_CLEARED: 'data_cleared',
```

---

## 任务 5: 测试设置弹窗功能

- [ ] **Step 1: 打开浏览器测试**

在浏览器中打开 `index.html`，点击设置按钮 ⚙️，验证弹窗是否正常显示

- [ ] **Step 2: 测试标签页切换**

点击各个标签页，验证内容切换是否正常

- [ ] **Step 3: 测试保存设置**

修改设置后点击"保存设置"，验证设置是否正确保存

- [ ] **Step 4: 测试数据管理功能**

测试导出、导入、清除数据功能是否正常工作
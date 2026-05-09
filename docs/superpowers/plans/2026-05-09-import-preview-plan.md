# 导入预览功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为导入功能添加预览弹窗，用户在导入前可以看到新增基金、已存在基金、新增交易、重复交易等统计信息

**Architecture:** 
- 分析逻辑放在 `ImportAppService.analyzeImportData()` 方法中
- 预览弹窗UI和渲染逻辑放在新的 `js/modal/importPreviewHelper.js` 模块中
- 修改 `modal.js` 中的导入流程，先显示预览再执行导入

**Tech Stack:** 原生JavaScript、CSS变量设计令牌

---

## 文件结构

```
js/
├── application/
│   └── importAppService.js     # 修改：新增analyzeImportData()方法
├── modal/
│   └── importPreviewHelper.js  # 新建：预览弹窗渲染和事件绑定
└── modal.js                    # 修改：新增importPreview弹窗配置，修改bindImportEvents
```

---

## Task 1: 实现analyzeImportData()分析逻辑

**Files:**
- Modify: `js/application/importAppService.js:1-160`

- [ ] **Step 1: 在ImportAppService末尾添加analyzeImportData方法**

在 `ModuleRegistry.register('ImportAppService', ImportAppService);` 之前添加：

```javascript
    analyzeImportData(data) {
        const normalized = ImportAppService.normalizeImportPayload(data);
        
        if (!normalized.success) {
            return {
                success: false,
                reason: normalized.reason
            };
        }

        const existingFunds = window.FundRepository.getAll();
        const existingTrades = window.TradeRepository.getAll();
        
        const existingFundIds = new Set(existingFunds.map(f => f.id));
        const existingTradeIds = new Set(existingTrades.map(t => t.id));

        const newFunds = [];
        const existingFundsList = [];
        
        normalized.funds.forEach(fund => {
            if (existingFundIds.has(fund.id)) {
                existingFundsList.push(fund);
            } else {
                newFunds.push(fund);
            }
        });

        const fundsWithNewTrades = [];
        const allDuplicateFunds = [];
        
        normalized.funds.forEach(fund => {
            const fundTrades = normalized.trades.filter(t => t.fundId === fund.id);
            const newTrades = fundTrades.filter(t => !existingTradeIds.has(t.id));
            const duplicateTrades = fundTrades.filter(t => existingTradeIds.has(t.id));
            
            if (newTrades.length > 0) {
                const isNew = !existingFundIds.has(fund.id);
                fundsWithNewTrades.push({
                    id: fund.id,
                    name: fund.name,
                    code: fund.code,
                    isNew: isNew,
                    trades: fundTrades.length,
                    newTrades: newTrades.length,
                    duplicateTrades: duplicateTrades.length,
                    newItems: newTrades.map(t => ({ ...t, isNew: true })),
                    duplicateItems: duplicateTrades.map(t => ({ ...t, isNew: false })),
                    tradeItems: fundTrades.map(t => ({ ...t, isNew: !existingTradeIds.has(t.id) }))
                });
            } else if (duplicateTrades.length > 0) {
                allDuplicateFunds.push({
                    id: fund.id,
                    name: fund.name,
                    code: fund.code,
                    trades: duplicateTrades.length,
                    duplicateTrades: duplicateTrades.length,
                    duplicateItems: duplicateTrades.map(t => ({ ...t, isNew: false }))
                });
            }
        });

        const totalNewTrades = fundsWithNewTrades.reduce((sum, f) => sum + f.newTrades, 0);
        const totalDuplicateTrades = fundsWithNewTrades.reduce((sum, f) => sum + f.duplicateTrades, 0) 
            + allDuplicateFunds.reduce((sum, f) => sum + f.duplicateTrades, 0);

        return {
            success: true,
            summary: {
                newFundsCount: newFunds.length,
                existingFundsCount: existingFundsList.length,
                newTradesCount: totalNewTrades,
                duplicateTradesCount: totalDuplicateTrades
            },
            fundsWithNewTrades: fundsWithNewTrades,
            allDuplicateFunds: allDuplicateFunds,
            normalized: normalized
        };
    },
```

- [ ] **Step 2: Commit**

```bash
git add js/application/importAppService.js
git commit -m "feat(import): add analyzeImportData method for import preview"
```

---

## Task 2: 创建importPreviewHelper.js模块

**Files:**
- Create: `js/modal/importPreviewHelper.js`

- [ ] **Step 1: 创建文件并实现ImportPreviewHelper模块**

```javascript
const ImportPreviewHelper = {
    _pendingData: null,
    _analysis: null,

    show(analysis) {
        this._analysis = analysis;
        
        const content = this._renderContent();
        
        const modal = document.getElementById('importPreviewModal');
        const contentEl = document.getElementById('importPreviewContent');
        
        if (!modal) {
            console.error('importPreviewModal not found');
            return;
        }
        
        contentEl.innerHTML = content;
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        this._bindEvents();
    },

    hide() {
        const modal = document.getElementById('importPreviewModal');
        if (modal) {
            modal.style.display = 'none';
        }
        document.body.classList.remove('modal-open');
        this._pendingData = null;
        this._analysis = null;
    },

    _renderContent() {
        const a = this._analysis;
        
        const statsHtml = `
            <div class="ip-stat-cards">
                <div class="ip-stat-card ip-stat-highlight">
                    <span class="ip-stat-icon">📦</span>
                    <div class="ip-stat-number">${a.summary.newFundsCount}</div>
                    <div class="ip-stat-label">新增基金</div>
                </div>
                <div class="ip-stat-card ip-stat-muted">
                    <span class="ip-stat-icon">📋</span>
                    <div class="ip-stat-number ip-stat-number-neutral">${a.summary.existingFundsCount}</div>
                    <div class="ip-stat-label">已存在基金</div>
                </div>
                <div class="ip-stat-card ip-stat-highlight">
                    <span class="ip-stat-icon">📝</span>
                    <div class="ip-stat-number">${a.summary.newTradesCount}</div>
                    <div class="ip-stat-label">新增记录</div>
                </div>
                <div class="ip-stat-card ip-stat-muted">
                    <span class="ip-stat-icon">⏭</span>
                    <div class="ip-stat-number ip-stat-number-muted">${a.summary.duplicateTradesCount}</div>
                    <div class="ip-stat-label">重复跳过</div>
                </div>
            </div>`;

        let fundsListHtml = '';

        if (a.fundsWithNewTrades.length > 0) {
            const rows = a.fundsWithNewTrades.map((fund, idx) => {
                const barClass = fund.isNew ? 'ip-bar-new' : 'ip-bar-exists';
                const newBadge = fund.newTrades > 0 ? `<span class="ip-meta-badge ip-meta-new">新增 ${fund.newTrades} 条</span>` : '';
                const dupBadge = fund.duplicateTrades > 0 ? `<span class="ip-meta-badge ip-meta-dup">重复 ${fund.duplicateTrades} 条</span>` : '';
                
                const allRows = this._buildTradeRows(fund.tradeItems);
                const detailHtml = allRows ? `
                    <div class="ip-stock-detail" id="ip-detail-newrec-${idx}">
                        <table class="ip-detail-table">
                            <thead><tr><th>日期</th><th>类型</th><th>净值</th><th>份额</th><th>状态</th></tr></thead>
                            <tbody>${allRows}</tbody>
                        </table>
                    </div>` : '';
                
                return `
                    <div class="ip-stock-row">
                        <div class="ip-stock-row-header" onclick="ImportPreviewHelper._toggleDetail(this)" data-has-detail="${!!allRows}">
                            <div class="ip-stock-bar ${barClass}"></div>
                            <div class="ip-stock-name">${fund.name} <span>(${fund.code})</span></div>
                            <div class="ip-stock-meta">${newBadge}${dupBadge}</div>
                            ${allRows ? `<div class="ip-expand-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>` : ''}
                        </div>
                        ${detailHtml}
                    </div>`;
            }).join('');
            
            fundsListHtml += `
                <div class="ip-stock-section">
                    <div class="ip-section-label">有新增记录的基金 (${a.fundsWithNewTrades.length}只)</div>
                    ${rows}
                </div>`;
        }

        if (a.allDuplicateFunds.length > 0) {
            const rows = a.allDuplicateFunds.map((fund, idx) => {
                const allRows = this._buildTradeRows(fund.duplicateItems, true);
                const detailHtml = allRows ? `
                    <div class="ip-stock-detail" id="ip-detail-alldup-${idx}">
                        <table class="ip-detail-table">
                            <thead><tr><th>日期</th><th>类型</th><th>净值</th><th>份额</th><th>状态</th></tr></thead>
                            <tbody>${allRows}</tbody>
                        </table>
                    </div>` : '';
                
                return `
                    <div class="ip-stock-row">
                        <div class="ip-stock-row-header" onclick="ImportPreviewHelper._toggleDetail(this)" data-has-detail="${!!allRows}">
                            <div class="ip-stock-bar ip-bar-exists"></div>
                            <div class="ip-stock-name">${fund.name} <span>(${fund.code})</span></div>
                            <div class="ip-stock-meta">
                                <span class="ip-meta-badge ip-meta-dup">全部重复 (${fund.duplicateTrades}条)</span>
                            </div>
                            ${allRows ? `<div class="ip-expand-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>` : ''}
                        </div>
                        ${detailHtml}
                    </div>`;
            }).join('');
            
            fundsListHtml += `
                <div class="ip-stock-section">
                    <div class="ip-section-label">全部重复的基金 (${a.allDuplicateFunds.length}只)</div>
                    ${rows}
                </div>`;
        }

        const warningHtml = `
            <div class="ip-warning-box">
                <svg class="ip-warning-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span><strong>注意：</strong>覆盖数据将删除当前所有数据，请谨慎操作！</span>
            </div>`;

        const actionsHtml = `
            <div class="ip-actions">
                <button class="btn btn-secondary" id="btn-import-cancel">取消</button>
                <button class="btn btn-primary" id="btn-import-merge">合并数据</button>
                <button class="btn btn-danger" id="btn-import-overwrite">覆盖数据</button>
            </div>`;

        return statsHtml + fundsListHtml + warningHtml + actionsHtml;
    },

    _buildTradeRows(items, isDuplicate = false) {
        if (!items || items.length === 0) return '';
        
        const typeMap = { buy: '买入', sell: '卖出', dividend: '分红' };
        
        return items.map(t => {
            const status = isDuplicate || !t.isNew
                ? `<span class="ip-status-dup">⊘ 重复</span>`
                : `<span class="ip-status-new">✅ 新增</span>`;
            const rowClass = (isDuplicate || !t.isNew) ? 'ip-row-dup' : '';
            
            return `
                <tr class="${rowClass}">
                    <td>${t.date}</td>
                    <td>${typeMap[t.type] || t.type}</td>
                    <td>${Number(t.netValue).toFixed(4)}</td>
                    <td>${t.shares}</td>
                    <td>${status}</td>
                </tr>`;
        }).join('');
    },

    _toggleDetail(header) {
        if (header.dataset.hasDetail !== 'true') return;
        const icon = header.querySelector('.ip-expand-icon');
        const detail = header.nextElementSibling;
        if (!detail) return;
        
        const isOpen = detail.classList.contains('ip-open');
        detail.classList.toggle('ip-open', !isOpen);
        if (icon) icon.classList.toggle('ip-open', !isOpen);
    },

    _bindEvents() {
        const btnCancel = document.getElementById('btn-import-cancel');
        const btnMerge = document.getElementById('btn-import-merge');
        const btnOverwrite = document.getElementById('btn-import-overwrite');
        
        if (btnCancel) {
            btnCancel.onclick = () => this.hide();
        }
        
        if (btnMerge) {
            btnMerge.onclick = async () => {
                const result = await window.ImportAppService.importData(this._analysis.normalized, { merge: true });
                if (result && result.success) {
                    Utils.showToast('数据合并成功', 'success');
                    this.hide();
                    if (typeof Overview !== 'undefined') {
                        Overview.refresh();
                    }
                } else {
                    Utils.showToast('数据合并失败', 'error');
                }
            };
        }
        
        if (btnOverwrite) {
            btnOverwrite.onclick = async () => {
                if (!confirm('确定要覆盖当前所有数据吗？此操作不可恢复！')) {
                    return;
                }
                const result = await window.ImportAppService.importData(this._analysis.normalized, { merge: false });
                if (result && result.success) {
                    Utils.showToast('数据已覆盖', 'success');
                    this.hide();
                    if (typeof Overview !== 'undefined') {
                        Overview.refresh();
                    }
                } else {
                    Utils.showToast('数据覆盖失败', 'error');
                }
            };
        }
    }
};

ModuleRegistry.register('ImportPreviewHelper', ImportPreviewHelper);
```

- [ ] **Step 2: Commit**

```bash
git add js/modal/importPreviewHelper.js
git commit -m "feat(import): add import preview helper module"
```

---

## Task 3: 修改modal.js添加预览弹窗HTML和配置

**Files:**
- Modify: `js/modal.js` (添加importPreview弹窗HTML和配置)
- Modify: `css/style.css` (添加预览弹窗样式)

### 3.1 修改modal.js

- [ ] **Step 1: 在modalConfigs对象中添加importPreview配置**

在 `modalConfigs` 对象中的 `import` 配置后添加：

```javascript
importPreview: {
    title: '导入预览',
    render: () => '',  // 使用HTML模板
    bind: () => {}
},
```

- [ ] **Step 2: 在modal.js底部添加importPreviewModal HTML模板**

在 `return { hide };` 之前添加：

```javascript
    getImportPreviewModalHTML() {
        return `
            <div id="importPreviewModal" class="modal" style="display: none;">
                <div class="modal-content ip-modal-content">
                    <div class="modal-header">
                        <h3>导入预览</h3>
                        <span class="close" onclick="ImportPreviewHelper.hide()">&times;</span>
                    </div>
                    <div class="modal-body" id="importPreviewContent">
                    </div>
                </div>
            </div>
        `;
    },
```

- [ ] **Step 3: 修改bindImportEvents方法，使其显示预览而非直接导入**

找到 `bindImportEvents` 方法，修改 `reader.onload` 部分：

```javascript
bindImportEvents() {
    const btnConfirm = document.getElementById('btn-confirm-import');

    btnConfirm.addEventListener('click', () => {
        const fileInput = document.getElementById('input-import-file');
        const mergeCheckbox = document.getElementById('input-merge-data');

        if (!fileInput.files || fileInput.files.length === 0) {
            Utils.showToast('请选择文件', 'error');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // 先分析导入数据
                const analysis = window.ImportAppService.analyzeImportData(data);
                
                if (!analysis.success) {
                    Utils.showToast('数据分析失败: ' + analysis.reason, 'error');
                    return;
                }
                
                // 保存待导入数据
                ImportPreviewHelper._pendingData = data;
                
                // 显示预览
                ImportPreviewHelper.show(analysis);
                
                // 隐藏导入弹窗
                Modal.hide();
            } catch (error) {
                Utils.showToast('文件格式错误', 'error');
            }
        };

        reader.readAsText(file);
    });
},
```

### 3.2 修改style.css

- [ ] **Step 4: 在style.css末尾添加预览弹窗样式**

```css
/* ==================== 导入预览弹窗样式 ==================== */
.ip-modal-content {
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
}

.ip-stat-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
}

.ip-stat-card {
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
}

.ip-stat-highlight {
    background: linear-gradient(135deg, var(--color-primary-light, #e3f2fd), var(--bg-secondary, #f5f5f5));
}

.ip-stat-muted {
    opacity: 0.8;
}

.ip-stat-icon {
    font-size: 20px;
}

.ip-stat-number {
    font-size: 24px;
    font-weight: bold;
    color: var(--text-primary, #333);
}

.ip-stat-number-neutral {
    color: var(--text-secondary, #666);
}

.ip-stat-number-muted {
    color: var(--text-muted, #999);
}

.ip-stat-label {
    font-size: 12px;
    color: var(--text-secondary, #666);
    margin-top: 4px;
}

.ip-stock-section {
    margin-bottom: 16px;
}

.ip-section-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #666);
    margin-bottom: 8px;
}

.ip-stock-row {
    margin-bottom: 8px;
}

.ip-stock-row-header {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
}

.ip-stock-row-header:hover {
    background: var(--bg-hover, #eee);
}

.ip-stock-bar {
    width: 4px;
    height: 24px;
    border-radius: 2px;
    margin-right: 12px;
}

.ip-bar-new {
    background: var(--color-success, #4caf50);
}

.ip-bar-exists {
    background: var(--color-muted, #999);
}

.ip-stock-name {
    flex: 1;
    font-weight: 500;
}

.ip-stock-name span {
    color: var(--text-muted, #999);
    font-weight: normal;
}

.ip-stock-meta {
    display: flex;
    gap: 8px;
    margin-right: 8px;
}

.ip-meta-badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
}

.ip-meta-new {
    background: var(--color-success-bg, #e8f5e9);
    color: var(--color-success, #4caf50);
}

.ip-meta-dup {
    background: var(--bg-tertiary, #eee);
    color: var(--text-muted, #999);
}

.ip-expand-icon {
    transition: transform 0.2s;
}

.ip-expand-icon.ip-open {
    transform: rotate(180deg);
}

.ip-stock-detail {
    display: none;
    padding: 12px 12px 12px 28px;
}

.ip-stock-detail.ip-open {
    display: block;
}

.ip-detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.ip-detail-table th,
.ip-detail-table td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #eee);
}

.ip-detail-table th {
    background: var(--bg-tertiary, #f0f0f0);
    font-weight: 500;
    color: var(--text-secondary, #666);
}

.ip-row-dup {
    opacity: 0.6;
}

.ip-status-new {
    color: var(--color-success, #4caf50);
}

.ip-status-dup {
    color: var(--text-muted, #999);
}

.ip-warning-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: var(--color-warning-bg, #fff3e0);
    border: 1px solid var(--color-warning, #ff9800);
    border-radius: 6px;
    margin-bottom: 16px;
}

.ip-warning-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
}

.ip-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #eee);
}

.btn-danger {
    background: var(--color-danger, #f44336);
    color: white;
}

.btn-danger:hover {
    background: var(--color-danger-dark, #d32f2f);
}

/* 暗色主题适配 */
[data-theme="dark"] .ip-stat-card {
    background: var(--bg-secondary-dark, #2d2d2d);
}

[data-theme="dark"] .ip-stat-highlight {
    background: linear-gradient(135deg, var(--color-primary-dark, #1e3a5f), var(--bg-secondary-dark, #2d2d2d));
}

[data-theme="dark"] .ip-stock-row-header {
    background: var(--bg-secondary-dark, #2d2d2d);
}

[data-theme="dark"] .ip-stock-row-header:hover {
    background: var(--bg-hover-dark, #3d3d3d);
}

[data-theme="dark"] .ip-detail-table th {
    background: var(--bg-tertiary-dark, #333);
}

[data-theme="dark"] .ip-warning-box {
    background: rgba(255, 152, 0, 0.1);
}
```

- [ ] **Step 5: Commit**

```bash
git add js/modal.js css/style.css
git commit -m "feat(import): add import preview modal HTML and styles"
```

---

## Task 4: 在index.html中添加预览弹窗容器

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在index.html的#modal-container中添加预览弹窗**

在 `<!-- 弹窗容器 -->` 区域的任意位置添加：

```html
<!-- 导入预览弹窗 -->
<div id="importPreviewModal" class="modal" style="display: none;">
    <div class="modal-content ip-modal-content">
        <div class="modal-header">
            <h3>导入预览</h3>
            <span class="close" onclick="ImportPreviewHelper.hide()">&times;</span>
        </div>
        <div class="modal-body" id="importPreviewContent">
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(import): add import preview modal to index.html"
```

---

## Task 5: 验证功能

- [ ] **Step 1: 运行lint检查**

```bash
npm run lint
```

- [ ] **Step 2: 手动测试导入预览功能**
1. 打开应用
2. 点击设置 → 导入数据
3. 选择一个包含数据的JSON文件
4. 确认预览弹窗显示统计信息和基金列表
5. 点击展开按钮查看交易明细
6. 测试合并和覆盖功能

---

## 实现检查清单

- [ ] `ImportAppService.analyzeImportData()` 方法已添加
- [ ] `importPreviewHelper.js` 模块已创建
- [ ] `modal.js` 中添加了 `importPreview` 弹窗配置
- [ ] `style.css` 中添加了预览弹窗样式
- [ ] `index.html` 中添加了预览弹窗HTML
- [ ] 导入流程修改为先分析再预览
- [ ] 预览弹窗显示统计卡片（新增基金/已存在/新增记录/重复）
- [ ] 预览弹窗显示基金列表，可展开查看交易明细
- [ ] 合并和覆盖功能正常工作
- [ ] 覆盖操作有确认警告
- [ ] lint检查通过

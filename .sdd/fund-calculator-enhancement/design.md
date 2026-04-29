# 场外基金收益计算器 - 功能增强技术设计

## 1. 架构概览

### 1.1 现有架构分析

当前项目采用纯前端原生JS架构，核心模块包括：

```
┌─────────────────────────────────────────────────┐
│                    App (入口)                    │
├─────────┬─────────┬──────────┬─────────────────┤
│ Router   │ Overview│ Detail   │ Modal           │
├─────────┴─────────┴──────────┴─────────────────┤
│ FundManager  │ TradeManager  │ CalculatorV2    │
├──────────────┴──────────────┴──────────────────┤
│ DataService  │ FundAPI       │ Storage         │
├──────────────┴──────────────┴──────────────────┤
│ Utils  │ EventBus  │ Config  │ ModuleRegistry  │
└─────────────────────────────────────────────────┘
```

**关键约定**：
- 模块通过 `ModuleRegistry.register()` 注册
- 模块间通过 `EventBus` + `EventType` 解耦通信
- 数据通过 `DataService` → `Storage` → `LocalStorage` 持久化
- UI通过直接DOM操作渲染

### 1.2 增强后架构

新增模块以虚线框标识：

```
┌───────────────────────────────────────────────────────────┐
│                        App (入口)                         │
├────────┬──────────┬──────────┬──────────┬────────────────┤
│ Router │ Overview │ Detail   │ Modal    │ ┌────────────┐ │
│        │          │          │          │ │ThemeManager│ │
│        │          │          │          │ └────────────┘ │
├────────┴──────────┴──────────┴──────────┴────────────────┤
│ FundManager  │ TradeManager  │ CalculatorV2              │
├──────────────┴──────────────┴───────────────────────────┤
│ ┌──────────────┐ ┌────────────┐ ┌─────────────────────┐ │
│ │ChartManager  │ │Paginator   │ │BigNumberFormatter   │ │
│ └──────────────┘ └────────────┘ └─────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ DataService  │ FundAPI       │ Storage                  │
├──────────────┴──────────────┴──────────────────────────┤
│ Utils  │ EventBus  │ Config  │ ModuleRegistry          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 技术选型

| 技术 | 用途 | 引入方式 | 版本 |
|------|------|----------|------|
| CSS Custom Properties | 设计令牌体系 | 原生支持 | - |
| ECharts | 专业图表 | 本地lib/echarts.min.js | 5.x |
| 原生JS | 所有新增模块 | 内联`<script>` | ES6+ |

**ECharts本地引入方案**：
```html
<script src="lib/echarts.min.js"></script>
```

**设计原则**：场外基金以长期持有为主，交易频率低。UI设计应体现此特点：
- 默认排序按收益率降序（关注长期收益）
- 图表时间轴适配长周期（按月/季度刻度，而非按日）
- 不引入短期操作导向的功能（如日内收益、短线信号等）

---

## 3. 模块设计

### 3.1 ThemeManager（REQ-01）

**职责**：管理CSS设计令牌和主题切换逻辑。

**接口定义**：
```javascript
const ThemeManager = {
    // 当前主题: 'light' | 'dark'
    currentTheme: 'light',

    /**
     * 初始化主题系统
     * - 加载用户偏好或系统主题
     * - 应用CSS变量到:root
     * - 监听系统主题变化
     */
    init(): void,

    /**
     * 切换主题
     * @param {'light'|'dark'} theme - 目标主题
     */
    setTheme(theme): void,

    /**
     * 切换到另一主题（toggle）
     */
    toggleTheme(): void,

    /**
     * 获取当前主题
     * @returns {'light'|'dark'}
     */
    getTheme(): string,

    /**
     * 应用设计令牌到:root
     * @param {'light'|'dark'} theme
     */
    applyDesignTokens(theme): void,

    /**
     * 监听系统主题偏好变化
     */
    watchSystemTheme(): void
};
```

**设计令牌体系**（CSS自定义属性）：

```css
:root {
    /* === 颜色 === */
    /* 品牌色 */
    --color-brand-primary: #667eea;
    --color-brand-secondary: #764ba2;
    --color-brand-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    /* 语义色 */
    --color-success: #48bb78;
    --color-danger: #f56565;
    --color-warning: #ff9800;
    --color-info: #667eea;

    /* 背景色 */
    --color-bg-primary: #ffffff;
    --color-bg-secondary: #f5f5f5;
    --color-bg-tertiary: #f9f9f9;
    --color-bg-hover: #f9f9ff;
    --color-bg-card: #ffffff;

    /* 文字色 */
    --color-text-primary: #333333;
    --color-text-secondary: #666666;
    --color-text-tertiary: #999999;
    --color-text-inverse: #ffffff;

    /* 边框色 */
    --color-border-primary: #f0f0f0;
    --color-border-secondary: #dddddd;
    --color-border-focus: #667eea;

    /* 阴影 */
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
    --shadow-lg: 0 6px 20px rgba(102, 126, 234, 0.25);

    /* === 间距 === */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;

    /* === 字体 === */
    --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
    --font-family-mono: 'Courier New', monospace;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-md: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;

    /* === 圆角 === */
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-full: 50%;

    /* === 动画 === */
    --transition-fast: 0.15s ease;
    --transition-normal: 0.3s ease;
}

/* 深色主题覆盖 */
[data-theme="dark"] {
    --color-brand-primary: #8b9cf7;
    --color-brand-secondary: #9b6dc7;
    --color-brand-gradient: linear-gradient(135deg, #8b9cf7 0%, #9b6dc7 100%);

    --color-bg-primary: #1a1a2e;
    --color-bg-secondary: #16213e;
    --color-bg-tertiary: #0f3460;
    --color-bg-hover: #1a2744;
    --color-bg-card: #1e2a4a;

    --color-text-primary: #e0e0e0;
    --color-text-secondary: #b0b0b0;
    --color-text-tertiary: #808080;
    --color-text-inverse: #1a1a2e;

    --color-border-primary: #2a3a5c;
    --color-border-secondary: #3a4a6c;
    --color-border-focus: #8b9cf7;

    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 6px 20px rgba(0, 0, 0, 0.5);
}
```

**数据流**：
```
用户点击切换 → ThemeManager.setTheme('dark')
  → document.documentElement.setAttribute('data-theme', 'dark')
  → CSS变量自动级联更新（无需JS逐个修改）
  → Storage.saveTheme('dark')
  → EventBus.emit('theme:changed', {theme: 'dark'})
  → ChartManager.onThemeChanged() 更新图表配色
```

**新增事件类型**：
```javascript
// 在EventType中新增
THEME_CHANGED: 'theme:changed'
```

---

### 3.2 持仓分组（REQ-02）

**实现位置**：`Overview` 模块增强，不新增独立模块。

**数据模型**：
```javascript
/**
 * 基金分组结果
 * @typedef {Object} FundGroupResult
 * @property {Array} holding - 持仓中的基金列表
 * @property {Array} cleared - 已清仓的基金列表
 * @property {number} holdingCount - 持仓中数量
 * @property {number} clearedCount - 已清仓数量
 */
```

**核心逻辑**：
```javascript
// Overview模块新增方法
Overview.groupFundsByStatus(funds): FundGroupResult
  → 遍历funds，通过FundManager.getFundStats(fund.id)获取stats
  → 判断 stats.summary.currentHolding.shares > EPSILON
  → true → holding组, false → cleared组

Overview.renderFundGroup(title, funds, isCollapsed): string
  → 渲染分组标题（含数量标识和折叠图标）
  → 渲染该组下的基金卡片/列表

Overview.toggleGroup(groupId): void
  → 切换折叠状态，更新DOM
```

**HTML结构**：
```html
<div class="fund-group" data-group="holding">
    <div class="fund-group-header" onclick="Overview.toggleGroup('holding')">
        <span class="group-title">持仓中</span>
        <span class="group-count">3</span>
        <span class="group-toggle">▼</span>
    </div>
    <div class="fund-group-body">
        <!-- 基金卡片 -->
    </div>
</div>
```

---

### 3.3 详情页标题栏行情数据（REQ-03）

**实现位置**：`Detail` 模块增强 + HTML结构修改。

**HTML结构**：
```html
<div class="detail-header">
    <button id="btn-back" class="btn btn-back">← 返回</button>
    <div class="detail-title-area">
        <div class="detail-fund-name" id="detail-fund-name">基金名称</div>
        <div class="detail-fund-code" id="detail-fund-code">000000</div>
    </div>
    <div class="detail-quote-area">
        <div class="quote-item">
            <span class="quote-label">最新净值</span>
            <span class="quote-value" id="quote-net-value">1.2345</span>
        </div>
        <div class="quote-item">
            <span class="quote-label">估算净值</span>
            <span class="quote-value" id="quote-estimated-value">1.2350</span>
        </div>
        <div class="quote-item">
            <span class="quote-label">估算涨幅</span>
            <span class="quote-value" id="quote-estimated-growth">+0.04%</span>
        </div>
    </div>
    <div class="detail-actions">
        <button id="btn-edit-fund" class="btn btn-secondary">编辑</button>
        <button id="btn-delete-fund" class="btn btn-danger">删除</button>
    </div>
</div>
```

**CSS布局策略**：使用 `flex-wrap: wrap`，行情区域在窄屏时自动换行到标题下方。

---

### 3.4 ChartManager（REQ-04）

**职责**：封装ECharts实例管理，提供统一的图表创建和主题适配接口。

**接口定义**：
```javascript
const ChartManager = {
    // ECharts实例缓存 Map<containerId, echartsInstance>
    _instances: new Map(),

    /**
     * 初始化图表管理器
     * - 检测ECharts可用性
     * - 监听主题变化事件
     * - 监听窗口resize事件
     */
    init(): void,

    /**
     * 检测ECharts是否可用
     * @returns {boolean}
     */
    isEChartsAvailable(): boolean,

    /**
     * 创建或更新图表
     * @param {string} containerId - DOM容器ID
     * @param {Object} option - ECharts配置项
     * @returns {Object|null} ECharts实例
     */
    createChart(containerId, option): Object|null,

    /**
     * 销毁图表实例
     * @param {string} containerId
     */
    disposeChart(containerId): void,

    /**
     * 销毁所有图表实例
     */
    disposeAll(): void,

    /**
     * 获取当前主题的ECharts配色
     * @returns {Object} {backgroundColor, textColor, ...}
     */
    getThemeConfig(): Object,

    /**
     * 响应主题变化，更新所有图表配色
     */
    onThemeChanged(): void,

    /**
     * 响应窗口resize，调整所有图表大小
     */
    onResize(): void,

    // === 业务图表工厂方法 ===

    /**
     * 生成总收益趋势折线图配置
     * @param {Array} funds - 所有基金数据
     * @returns {Object} ECharts option
     */
    buildProfitTrendOption(funds): Object,

    /**
     * 生成单基金收益趋势图配置
     * @param {Object} fund - 基金数据
     * @param {Object} stats - 计算结果
     * @returns {Object} ECharts option
     */
    buildFundProfitTrendOption(fund, stats): Object,

    /**
     * 生成买卖对比柱状图配置
     * @param {Object} stats - 计算结果
     * @returns {Object} ECharts option
     */
    buildBuySellCompareOption(stats): Object,

    /**
     * 生成收益率变化折线图配置
     * @param {Array} cycles - 持仓周期
     * @returns {Object} ECharts option
     */
    buildProfitRateChangeOption(cycles): Object
};
```

**ECharts引入与Fallback策略**：
```javascript
// 在ChartManager.init()中
init() {
    this._echartsAvailable = (typeof echarts !== 'undefined');
    if (!this._echartsAvailable) {
        console.warn('ECharts not available (lib/echarts.min.js not loaded), falling back to simple charts');
    }
    // 监听主题变化
    EventBus.on(EventType.THEME_CHANGED, () => this.onThemeChanged());
    // 监听窗口resize
    window.addEventListener('resize', Utils.debounce(() => this.onResize(), 200));
}
```

**图表容器HTML**：
```html
<!-- 汇总页图表 -->
<div class="chart-container">
    <div id="chart-profit-trend" class="chart"></div>
</div>

<!-- 详情页图表（多图表） -->
<div class="chart-container chart-detail-grid">
    <div class="chart-item">
        <h4>收益趋势</h4>
        <div id="chart-fund-profit-trend" class="chart"></div>
    </div>
    <div class="chart-item">
        <h4>买卖对比</h4>
        <div id="chart-buy-sell-compare" class="chart"></div>
    </div>
    <div class="chart-item">
        <h4>收益率变化</h4>
        <div id="chart-profit-rate-change" class="chart"></div>
    </div>
</div>
```

---

### 3.5 卡片/列表双视图与排序（REQ-05）

**实现位置**：`Overview` 模块增强 + 新增视图控制UI。

**数据模型**：
```javascript
/**
 * 视图偏好设置
 * @typedef {Object} ViewPreferences
 * @property {'card'|'list'} viewMode - 视图模式
 * @property {string} sortField - 排序字段 ('profitRate'|'profitAmount'|'marketValue'|'name')
 * @property {'asc'|'desc'} sortOrder - 排序方向
 */
```

**存储键**：`fund_calculator_view_prefs`

**核心逻辑**：
```javascript
// Overview模块新增
Overview.loadViewPreferences(): ViewPreferences
Overview.saveViewPreferences(prefs): void
Overview.sortFunds(funds, sortField, sortOrder): Array
Overview.renderCardView(funds): string   // 网格卡片布局
Overview.renderListView(funds): string   // 紧凑表格行布局
Overview.switchView(mode): void
Overview.changeSort(field, order): void
```

**HTML结构**：
```html
<div class="list-header">
    <h2>我的基金</h2>
    <div class="list-controls">
        <!-- 视图切换 -->
        <div class="view-toggle">
            <button class="btn-view active" data-view="card" title="卡片视图">▦</button>
            <button class="btn-view" data-view="list" title="列表视图">☰</button>
        </div>
        <!-- 排序选择 -->
        <select class="sort-select" id="sort-field">
            <option value="profitRate">按收益率</option>
            <option value="profitAmount">按收益额</option>
            <option value="marketValue">按市值</option>
            <option value="name">按名称</option>
        </select>
        <button class="btn-sort-order" id="sort-order" title="降序">↓</button>
        <button class="btn btn-primary" id="btn-add-fund">+ 添加基金</button>
    </div>
</div>
```

**卡片视图CSS**：
```css
.fund-list.card-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-md);
}
```

**列表视图CSS**：
```css
.fund-list.list-view {
    display: table;
    width: 100%;
}
.fund-list.list-view .fund-row {
    display: table-row;
}
```

---

### 3.6 BigNumberFormatter（REQ-06）

**职责**：大数字智能格式化，纯工具模块。

**接口定义**：
```javascript
const BigNumberFormatter = {
    /**
     * 格式化大数字
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位，默认2
     * @returns {string} 格式化后的字符串（如"¥1.23万"）
     */
    format(amount, decimals = 2): string,

    /**
     * 获取完整千分位格式（用于tooltip）
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位，默认2
     * @returns {string} 完整格式字符串（如"¥12,345.67"）
     */
    formatFull(amount, decimals = 2): string,

    /**
     * 判断是否为大数字（需要格式化）
     * @param {number} amount
     * @returns {boolean}
     */
    isBigNumber(amount): boolean,

    /**
     * 生成带tooltip的HTML
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位
     * @returns {string} HTML字符串
     */
    formatWithTooltip(amount, decimals = 2): string
};
```

**格式化规则**：
```
|amount| < 10,000        → ¥1,234.56（千分位）
10,000 ≤ |amount| < 10^8 → ¥X.XX万
|amount| ≥ 10^8          → ¥X.XX亿
```

**tooltip HTML**：
```html
<span class="big-number" title="¥12,345.67">¥1.23万</span>
```

**集成方式**：替换 `Utils.formatMoney()` 调用点，改为 `BigNumberFormatter.formatWithTooltip()`。在 `Utils` 模块中新增代理方法以保持向后兼容：
```javascript
Utils.formatMoneySmart = function(amount, decimals = 2) {
    return BigNumberFormatter.formatWithTooltip(amount, decimals);
};
```

---

### 3.7 交易备注字段（REQ-07）

**实现位置**：数据模型扩展 + Modal表单增强 + Detail列表增强。

**数据模型变更**：
```javascript
// 交易对象扩展（tradeManager.js中已有remark字段）
const trade = {
    id: string,
    fundId: string,
    date: string,
    type: 'buy' | 'sell' | 'dividend',
    netValue: number,
    shares: number,
    amount: number,
    fee: number,
    remark: string,  // ← 已存在，需增强UI展示
    createTime: string
};
```

**备注字段约束**：
- 最大长度：50字符
- 在交易表格中：超20字符截断，悬浮显示全文
- 导入/导出：已包含在现有数据结构中

**交易表格列扩展**：
```html
<table class="trade-table">
    <thead>
        <tr>
            <th>日期</th>
            <th>类型</th>
            <th>净值</th>
            <th>份额</th>
            <th>金额</th>
            <th>手续费</th>
            <th>备注</th>  <!-- 新增列 -->
            <th>操作</th>
        </tr>
    </thead>
</table>
```

---

### 3.8 Paginator（REQ-08）

**职责**：通用分页组件，支持分页显示和筛选条件管理。

**接口定义**：
```javascript
const Paginator = {
    /**
     * 创建分页实例
     * @param {Object} config
     * @param {Array} config.data - 全量数据
     * @param {number} config.pageSize - 每页条数，默认10
     * @param {string} config.containerId - 分页控件容器ID
     * @param {Function} config.onPageChange - 页码变化回调
     * @returns {Object} 分页实例
     */
    create(config): Object,

    /**
     * 应用筛选条件
     * @param {Object} instance - 分页实例
     * @param {Object} filters - {type: string, startDate: string, endDate: string}
     */
    applyFilters(instance, filters): void,

    /**
     * 清除筛选条件
     * @param {Object} instance
     */
    clearFilters(instance): void,

    /**
     * 跳转到指定页
     * @param {Object} instance
     * @param {number} page
     */
    goToPage(instance, page): void,

    /**
     * 设置每页条数
     * @param {Object} instance
     * @param {number} pageSize
     */
    setPageSize(instance, pageSize): void,

    /**
     * 获取当前页数据
     * @param {Object} instance
     * @returns {Array}
     */
    getCurrentPageData(instance): Array,

    /**
     * 渲染分页控件
     * @param {Object} instance
     * @returns {string} HTML
     */
    renderControls(instance): string
};
```

**分页实例数据结构**：
```javascript
{
    data: Array,           // 全量数据
    filteredData: Array,   // 筛选后数据
    pageSize: number,      // 每页条数
    currentPage: number,   // 当前页码
    totalPage: number,     // 总页数
    filters: {             // 筛选条件
        type: string|null,
        startDate: string|null,
        endDate: string|null
    },
    containerId: string,
    onPageChange: Function
}
```

**交易记录筛选UI**：
```html
<div class="trade-filter-bar">
    <select id="filter-trade-type">
        <option value="">全部类型</option>
        <option value="buy">买入</option>
        <option value="sell">卖出</option>
        <option value="dividend">分红</option>
    </select>
    <input type="date" id="filter-start-date" placeholder="开始日期">
    <input type="date" id="filter-end-date" placeholder="结束日期">
    <button class="btn btn-secondary" id="btn-clear-filter">清除筛选</button>
    <span class="filter-result-count">共 15 条记录</span>
</div>
```

---

### 3.9 Top5盈亏榜单（REQ-09）

**实现位置**：`Overview` 模块增强。

**核心逻辑**：
```javascript
Overview.calculateTop5(funds): { profitTop5: Array, lossTop5: Array }
  → 遍历funds，获取每只基金的stats
  → 按stats.total.rate排序
  → profitTop5 = 收益为正的基金，取前5
  → lossTop5 = 收益为负的基金，按rate升序取前5

Overview.renderTop5Board(title, funds, type): string
  → 渲染榜单标题和列表
  → 每项显示：排名、基金名称、收益率
  → 点击跳转详情页
```

**HTML结构**：
```html
<div class="top5-container">
    <div class="top5-board top5-profit">
        <h3>🏆 盈利Top5</h3>
        <div class="top5-list">
            <!-- 动态生成 -->
        </div>
    </div>
    <div class="top5-board top5-loss">
        <h3>📉 亏损Top5</h3>
        <div class="top5-list">
            <!-- 动态生成 -->
        </div>
    </div>
</div>
```

---

---

## 4. 数据模型变更汇总

### 4.1 新增LocalStorage键

| 键名 | 类型 | 用途 |
|------|------|------|
| `fund_calculator_theme` | string | 主题偏好（已存在，复用） |
| `fund_calculator_view_prefs` | object | 视图偏好和排序设置 |

### 4.2 现有数据结构扩展

| 模型 | 变更 | 兼容性 |
|------|------|--------|
| Trade | `remark`字段UI增强（数据层已存在） | 向后兼容，旧数据remark为空 |

### 4.3 Config新增配置项

```javascript
// config.js 新增
ui: {
    // ...existing
    defaultViewMode: 'card',       // 默认视图模式
    defaultSortField: 'profitRate', // 默认排序字段（长期持有关注收益率）
    defaultSortOrder: 'desc',       // 默认排序方向
    defaultPageSize: 10,            // 默认每页条数
    pageSizeOptions: [10, 20, 50],  // 每页条数选项
    remarkMaxLength: 50,            // 备注最大长度
    bigNumberThreshold: 10000,      // 大数字阈值
    bigNumberWanThreshold: 100000000 // 亿级阈值
},

echarts: {
    enabled: true
}
```

---

## 5. 事件总线扩展

| 事件名 | 数据 | 触发场景 |
|--------|------|----------|
| `theme:changed` | `{theme: 'light'\|'dark'}` | 主题切换时 |
| `view:changed` | `{viewMode, sortField, sortOrder}` | 视图/排序变更时 |
| `group:toggled` | `{groupId, collapsed}` | 分组折叠/展开时 |
| `filter:changed` | `{filters}` | 筛选条件变更时 |
| `page:changed` | `{page, pageSize}` | 分页变更时 |

---

## 6. CSS重构策略

### 6.1 重构原则

1. **渐进式替换**：将`style.css`中所有硬编码颜色值替换为CSS变量引用
2. **语义化命名**：使用`--color-text-primary`而非`--gray-900`
3. **主题隔离**：深色主题变量通过`[data-theme="dark"]`选择器覆盖，不修改浅色主题定义

### 6.2 替换映射表（关键项）

| 原硬编码值 | 替换为CSS变量 | 出现位置 |
|------------|---------------|----------|
| `#f5f5f5` (body背景) | `var(--color-bg-secondary)` | body |
| `#333333` (主文字) | `var(--color-text-primary)` | 多处 |
| `#666666` (次文字) | `var(--color-text-secondary)` | 多处 |
| `#999999` (辅文字) | `var(--color-text-tertiary)` | 多处 |
| `#ffffff` (卡片背景) | `var(--color-bg-card)` | 多处 |
| `#f0f0f0` (边框) | `var(--color-border-primary)` | 多处 |
| `#667eea` (品牌色) | `var(--color-brand-primary)` | 多处 |
| `#48bb78` (涨色) | `var(--color-success)` | .positive |
| `#f56565` (跌色) | `var(--color-danger)` | .negative |
| `#f9f9f9` (三级背景) | `var(--color-bg-tertiary)` | 多处 |

---

## 7. 汇总页布局重构

### 7.1 重构后布局

```
┌─────────────────────────────────────────────┐
│  Header (标题 + 主题切换 + 导入导出 + 设置)  │
├─────────────────────────────────────────────┤
│  统计卡片区 (4个: 总投入/总市值/总收益/收益率) │
├─────────────────────────────────────────────┤
│  盈利Top5  │  亏损Top5                      │
├─────────────────────────────────────────────┤
│  基金列表 (视图切换 + 排序 + 添加)           │
│  ├─ 持仓中 (N只)                            │
│  │  ├─ 基金卡片/行                          │
│  │  └─ ...                                  │
│  └─ 已清仓 (M只)                            │
│     ├─ 基金卡片/行                          │
│     └─ ...                                  │
├─────────────────────────────────────────────┤
│  总收益趋势图表                              │
└─────────────────────────────────────────────┘
```

### 7.2 详情页布局重构

```
┌─────────────────────────────────────────────┐
│  Detail Header (返回 + 名称/代码 + 行情数据) │
├─────────────────────────────────────────────┤
│  当前持仓汇总 (份额/成本/市值/盈亏/收益率)    │
├─────────────────────────────────────────────┤
│  持仓明细 (已实现收益 + 总收益 + 简单差额法)  │
├─────────────────────────────────────────────┤
│  持仓周期 (周期列表/弹窗详情)                 │
├─────────────────────────────────────────────┤
│  图表区 (收益趋势 + 买卖对比 + 收益率变化)    │
├─────────────────────────────────────────────┤
│  交易记录 (筛选 + 分页表格 + 添加)            │
└─────────────────────────────────────────────┘
```

---

## 8. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `index.html` | 修改 | 新增ECharts CDN、主题切换按钮、视图控制UI、Top5区域、详情页标题栏重构 |
| `css/style.css` | 重构 | 全量替换为CSS变量 + 新增深色主题 + 新增组件样式 |
| `css/tokens.css` | 新增 | 设计令牌定义（浅色+深色） |
| `js/themeManager.js` | 新增 | 主题管理模块 |
| `js/chartManager.js` | 新增 | ECharts图表管理模块 |
| `js/bigNumberFormatter.js` | 新增 | 大数字格式化模块 |
| `js/paginator.js` | 新增 | 通用分页组件 |
| `js/overview.js` | 修改 | 增加分组、双视图、排序、Top5 |
| `js/detail.js` | 修改 | 增强标题栏、图表、交易分页筛选、备注展示 |
| `js/utils.js` | 修改 | 新增formatMoneySmart代理方法 |
| `js/config.js` | 修改 | 新增UI和ECharts配置项 |
| `js/eventBus.js` | 修改 | 新增事件类型 |
| `js/storage.js` | 修改 | 新增视图偏好存取方法 |
| `js/modal.js` | 修改 | 交易表单备注字段maxlength约束 |

---

## 9. 加载顺序

新增模块的script加载顺序（在`index.html`中）：

```html
<!-- 现有基础模块 -->
<script src="js/namespace.js"></script>
<script src="js/moduleRegistry.js"></script>
<script src="js/eventBus.js"></script>
<script src="js/config.js"></script>
<script src="js/utils.js"></script>

<!-- 新增工具模块 -->
<script src="js/bigNumberFormatter.js"></script>
<script src="js/paginator.js"></script>
<script src="js/themeManager.js"></script>

<!-- 现有数据模块 -->
<script src="js/storage.js"></script>
<script src="js/dataService.js"></script>
<script src="js/fundAPI.js"></script>
<script src="js/calculatorV2.js"></script>
<script src="js/fundManager.js"></script>
<script src="js/tradeManager.js"></script>

<!-- 新增UI模块 -->
<script src="js/chartManager.js"></script>

<!-- 现有UI模块 -->
<script src="js/router.js"></script>
<script src="js/modal.js"></script>
<script src="js/overview.js"></script>
<script src="js/detail.js"></script>
<script src="js/app.js"></script>
```

**CSS加载顺序**：
```html
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/style.css">
```

**ECharts本地引用**（在所有script之前）：
```html
<script src="lib/echarts.min.js"></script>
```

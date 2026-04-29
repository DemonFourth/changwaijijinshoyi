# 场外基金收益计算器 - 编码任务规划

## 任务依赖关系

```
Task 1 (基础设施) ──→ Task 2 (主题系统) ──→ Task 4 (图表系统)
                   ──→ Task 3 (大数字格式化)
                   ──→ Task 5 (视图与排序)
                   ──→ Task 6 (持仓分组)
                   ──→ Task 7 (详情页标题栏)
                   ──→ Task 8 (交易备注)
                   ──→ Task 9 (分页筛选)
                   ──→ Task 10 (Top5榜单)
Task 2 ~ Task 10 ──→ Task 11 (集成测试与优化)
```

---

## Task 1：基础设施搭建

**优先级**：P0（阻塞所有后续任务）
**对应需求**：REQ-01（部分）、NFR-03、NFR-04
**输入**：现有 `config.js`、`eventBus.js`、`storage.js`、`index.html`
**输出**：扩展后的基础设施模块

### 1.1 扩展Config配置项

在 `js/config.js` 中新增以下配置项：

- 在 `ui` 对象中新增 `defaultViewMode`（默认'card'）、`defaultSortField`（默认'profitRate'，长期持有关注收益率）、`defaultSortOrder`（默认'desc'）、`defaultPageSize`（默认10）、`pageSizeOptions`（[10,20,50]）、`remarkMaxLength`（50）、`bigNumberThreshold`（10000）、`bigNumberWanThreshold`（100000000）
- 新增 `echarts` 配置对象，包含 `enabled` 属性

**验收标准**：Config.get() 能正确获取所有新增配置项的默认值。

### 1.2 扩展EventType事件类型

在 `js/eventBus.js` 的 `EventType` 对象中新增：

- `THEME_CHANGED: 'theme:changed'`
- `VIEW_CHANGED: 'view:changed'`
- `GROUP_TOGGLED: 'group:toggled'`
- `FILTER_CHANGED: 'filter:changed'`
- `PAGE_CHANGED: 'page:changed'`

**验收标准**：所有新增事件类型可通过EventType访问，EventBus能正常订阅和触发。

### 1.3 扩展Storage存储方法

在 `js/storage.js` 中新增：

- `saveViewPrefs(prefs)` 方法：保存视图偏好到 `fund_calculator_view_prefs` 键
- `loadViewPrefs()` 方法：加载视图偏好，无数据时返回默认值 `{viewMode:'card', sortField:'profitRate', sortOrder:'desc'}`

**验收标准**：视图偏好能正确保存和加载，不影响现有存储数据。

### 1.4 在index.html中引入ECharts本地文件

在 `index.html` 的 `<head>` 中，在所有其他 `<script>` 标签之前添加 ECharts 本地引用：

```html
<script src="lib/echarts.min.js"></script>
```

**验收标准**：页面加载后全局存在 `echarts` 对象；若文件不存在，不阻塞页面其他功能。

---

## Task 2：CSS设计令牌体系与ThemeManager模块

**优先级**：P0（阻塞Task 4图表主题适配）
**对应需求**：REQ-01
**依赖**：Task 1
**输入**：现有 `css/style.css`、design.md中的设计令牌定义
**输出**：`css/tokens.css`（新增）、重构后的 `css/style.css`、`js/themeManager.js`（新增）

### 2.1 创建CSS设计令牌文件

创建 `css/tokens.css`，包含：

- `:root` 下定义所有浅色主题的CSS自定义属性（颜色、间距、字体、圆角、阴影、动画过渡）
- `[data-theme="dark"]` 选择器下定义深色主题覆盖值
- 令牌分类：`--color-brand-*`、`--color-bg-*`、`--color-text-*`、`--color-border-*`、`--color-success/danger/warning/info`、`--shadow-*`、`--spacing-*`、`--font-*`、`--radius-*`、`--transition-*`

**验收标准**：tokens.css中定义的变量覆盖style.css中所有硬编码颜色值。

### 2.2 重构style.css替换硬编码值

将 `css/style.css` 中所有硬编码颜色值替换为对应的CSS变量引用：

- `#f5f5f5` → `var(--color-bg-secondary)`
- `#333333` → `var(--color-text-primary)`
- `#666666` → `var(--color-text-secondary)`
- `#999999` → `var(--color-text-tertiary)`
- `#ffffff` → `var(--color-bg-card)` / `var(--color-bg-primary)`
- `#f0f0f0` → `var(--color-border-primary)`
- `#dddddd` → `var(--color-border-secondary)`
- `#667eea` → `var(--color-brand-primary)`
- `#48bb78` → `var(--color-success)`
- `#f56565` → `var(--color-danger)`
- `#f9f9f9` → `var(--color-bg-tertiary)`
- `#f9f9ff` → `var(--color-bg-hover)`
- 渐变色中的 `#667eea`/`#764ba2` → `var(--color-brand-primary)`/`var(--color-brand-secondary)`（渐变整体替换为 `var(--color-brand-gradient)`）
- 阴影值替换为 `var(--shadow-sm)`/`var(--shadow-md)`/`var(--shadow-lg)`

**验收标准**：style.css中不再包含硬编码的hex颜色值（rgba透明度除外）；浅色主题下视觉效果与重构前一致。

### 2.3 在index.html中引入tokens.css

在 `<head>` 中，在 `style.css` 之前添加 `<link rel="stylesheet" href="css/tokens.css">`。

**验收标准**：CSS变量在style.css之前加载，页面样式正常。

### 2.4 实现ThemeManager模块

创建 `js/themeManager.js`，实现以下功能：

- `init()`：从Storage加载主题偏好，若无则检测 `prefers-color-scheme`，应用主题到 `document.documentElement` 的 `data-theme` 属性
- `setTheme(theme)`：设置 `data-theme` 属性，保存到Storage，触发 `THEME_CHANGED` 事件
- `toggleTheme()`：在light/dark之间切换
- `getTheme()`：返回当前主题
- `watchSystemTheme()`：通过 `matchMedia('(prefers-color-scheme: dark)')` 监听系统主题变化
- 通过 `ModuleRegistry.register('ThemeManager', ThemeManager)` 注册

**验收标准**：
- 切换主题后所有UI元素颜色即时更新（AC-01-02）
- 主题偏好持久化到LocalStorage（AC-01-03）
- 默认使用浅色主题（AC-01-04）
- 支持系统深色模式自动适配（AC-01-05）

### 2.5 在Header中添加主题切换按钮

在 `index.html` 的 `.header-actions` 中添加主题切换按钮（如🌙/☀️图标），点击调用 `ThemeManager.toggleTheme()`。

在 `js/app.js` 的 `init()` 中调用 `ThemeManager.init()`。

在 `index.html` 中添加 `<script src="js/themeManager.js"></script>`，位于utils.js之后。

**验收标准**：点击按钮可切换主题，图标随主题变化。

---

## Task 3：BigNumberFormatter大数字格式化模块

**优先级**：P1
**对应需求**：REQ-06
**依赖**：Task 1
**输入**：design.md中的格式化规则
**输出**：`js/bigNumberFormatter.js`（新增）、`js/utils.js`（修改）

### 3.1 实现BigNumberFormatter模块

创建 `js/bigNumberFormatter.js`，实现：

- `format(amount, decimals)`：按规则格式化（<1万千分位，1万~1亿显示"万"，≥1亿显示"亿"），保留¥前缀
- `formatFull(amount, decimals)`：返回完整千分位格式（复用现有Utils.formatMoney逻辑）
- `isBigNumber(amount)`：判断是否≥10000
- `formatWithTooltip(amount, decimals)`：若为大数字，返回 `<span class="big-number" title="完整值">缩略值</span>`；否则返回普通格式化字符串
- 通过 `ModuleRegistry.register('BigNumberFormatter', BigNumberFormatter)` 注册

**验收标准**：
- ¥12,345.67 → ¥1.23万（AC-06-01）
- ¥123,456,789.00 → ¥1.23亿（AC-06-02）
- ¥1,234.56 保持不变（AC-06-03）
- 悬浮显示完整值（AC-06-04）

### 3.2 在Utils中添加代理方法

在 `js/utils.js` 中新增 `formatMoneySmart(amount, decimals)` 方法，内部调用 `BigNumberFormatter.formatWithTooltip()`。

**验收标准**：Utils.formatMoneySmart() 返回值与BigNumberFormatter.formatWithTooltip()一致。

### 3.3 替换现有formatMoney调用点

将 `overview.js` 和 `detail.js` 中所有金额显示的 `Utils.formatMoney()` 调用替换为 `Utils.formatMoneySmart()`。

**验收标准**：所有统计卡片、基金卡片、详情页金额统一使用大数字格式化（AC-06-05）。

### 3.4 添加big-number CSS样式

在 `css/style.css` 中添加 `.big-number` 样式：`cursor: help; border-bottom: 1px dashed var(--color-text-tertiary);`，以及深色主题下的tooltip样式。

**验收标准**：大数字悬浮时有视觉提示（虚线下划线）。

### 3.5 在index.html中引入模块

添加 `<script src="js/bigNumberFormatter.js"></script>`，位于utils.js之后、storage.js之前。

---

## Task 4：ChartManager图表管理模块

**优先级**：P1
**对应需求**：REQ-04
**依赖**：Task 2（主题系统）
**输入**：design.md中的ChartManager接口定义
**输出**：`js/chartManager.js`（新增）、`js/overview.js`（修改图表部分）、`js/detail.js`（修改图表部分）、`index.html`（修改图表容器）

### 4.1 实现ChartManager核心

创建 `js/chartManager.js`，实现：

- `init()`：检测ECharts可用性，监听THEME_CHANGED事件，监听window resize
- `isEChartsAvailable()`：返回echarts全局对象是否存在
- `createChart(containerId, option)`：获取DOM容器，创建ECharts实例并缓存，设置主题配色
- `disposeChart(containerId)` / `disposeAll()`：销毁实例
- `getThemeConfig()`：根据当前主题返回ECharts配色对象（背景色、文字色、轴线色等）
- `onThemeChanged()`：遍历所有实例，重新应用主题配色
- `onResize()`：调用所有实例的resize()
- 通过 `ModuleRegistry.register('ChartManager', ChartManager)` 注册

**验收标准**：ECharts实例可创建和销毁；主题切换后图表配色更新（AC-04-04）；窗口缩放后图表自适应（AC-04-05）。

### 4.2 实现业务图表工厂方法

在ChartManager中实现：

- `buildProfitTrendOption(funds)`：汇总页总收益趋势折线图，X轴为时间，Y轴为累计收益
- `buildFundProfitTrendOption(fund, stats)`：单基金收益趋势折线图
- `buildBuySellCompareOption(stats)`：买卖对比柱状图（买入金额vs卖出金额）
- `buildProfitRateChangeOption(cycles)`：各持仓周期收益率变化折线图

**验收标准**：各工厂方法返回合法的ECharts option对象；数据为空时option包含"暂无数据"提示（AC-04-03）。

### 4.3 修改汇总页图表渲染

在 `overview.js` 中，将现有简单HTML/CSS图表替换为ChartManager调用：

- 在 `refresh()` 中调用 `ChartManager.createChart('chart-profit-trend', ChartManager.buildProfitTrendOption(funds))`
- 页面切换时调用 `ChartManager.disposeAll()` 清理实例

**验收标准**：汇总页显示总收益趋势折线图（AC-04-01）。

### 4.4 修改详情页图表渲染

在 `detail.js` 中：

- 将 `updateChart()` 方法中的简单HTML图表替换为3个ECharts图表（收益趋势、买卖对比、收益率变化）
- 在 `index.html` 中将详情页图表区域改为3个图表容器的网格布局

**验收标准**：详情页显示3种图表（AC-04-02）。

### 4.5 在index.html中引入模块

添加 `<script src="js/chartManager.js"></script>`，位于fundManager.js之后、router.js之前。

在 `js/app.js` 的 `init()` 中调用 `ChartManager.init()`。

---

## Task 5：卡片/列表双视图与排序功能

**优先级**：P1
**对应需求**：REQ-05
**依赖**：Task 1、Task 3（大数字格式化）
**输入**：design.md中的视图控制UI和排序逻辑
**输出**：`js/overview.js`（修改）、`css/style.css`（新增视图样式）、`index.html`（修改list-header）

### 5.1 实现视图偏好加载与保存

在 `overview.js` 中新增：

- `_viewPrefs` 属性：缓存当前视图偏好
- `loadViewPreferences()`：从Storage加载，无数据时使用Config默认值
- `saveViewPreferences(prefs)`：保存到Storage，触发VIEW_CHANGED事件

**验收标准**：视图偏好持久化到LocalStorage（AC-05-05）。

### 5.2 实现排序逻辑

在 `overview.js` 中新增 `sortFunds(funds, sortField, sortOrder)` 方法：

- `profitRate`：按stats.total.rate排序（默认，长期持有关注收益率）
- `profitAmount`：按stats.total.amount排序
- `marketValue`：按stats.summary.currentHolding.value排序
- `name`：按fund.name字母排序

**验收标准**：4种排序字段均能正确升序/降序排列，默认按收益率降序（AC-05-04）。

### 5.3 实现卡片视图和列表视图渲染

在 `overview.js` 中新增：

- `renderCardView(funds)`：网格卡片布局，每个卡片显示基金名称、代码、收益率、收益额、最新净值等
- `renderListView(funds)`：紧凑表格行布局，表头+数据行

**验收标准**：卡片视图为网格布局（AC-05-02）；列表视图为紧凑行布局（AC-05-03）。

### 5.4 实现视图切换和排序控制

在 `overview.js` 中新增：

- `switchView(mode)`：切换视图模式，更新DOM和偏好
- `changeSort(field, order)`：更改排序，重新渲染列表

在 `index.html` 的 `.list-header` 中添加视图切换按钮组和排序下拉框。

**验收标准**：点击切换按钮在卡片/列表视图间切换（AC-05-01）；排序选择即时生效。

### 5.5 添加视图相关CSS样式

在 `css/style.css` 中新增：

- `.fund-list.card-view`：grid布局
- `.fund-list.list-view`：table布局
- `.view-toggle`、`.btn-view`：视图切换按钮样式
- `.sort-select`、`.btn-sort-order`：排序控件样式

**验收标准**：两种视图布局正确，响应式适配。

---

## Task 6：持仓分组（持仓中/已清仓）

**优先级**：P1
**对应需求**：REQ-02
**依赖**：Task 1、Task 5（视图与排序）
**输入**：design.md中的分组逻辑
**输出**：`js/overview.js`（修改）、`css/style.css`（新增分组样式）、`index.html`（修改基金列表区域）

### 6.1 实现分组逻辑

在 `overview.js` 中新增：

- `groupFundsByStatus(funds)`：遍历基金，通过FundManager.getFundStats()获取持仓份额，份额>0归入holding组，否则归入cleared组
- `_groupCollapsed` 属性：记录各分组折叠状态

**验收标准**：基金按持仓状态自动分组（AC-02-01）；持仓中组排在已清仓组之前（AC-02-02）。

### 6.2 实现分组渲染

在 `overview.js` 中新增：

- `renderFundGroup(groupId, title, funds, isCollapsed)`：渲染分组标题（含数量标识和折叠图标）和分组内容
- 修改 `updateFundList()` 方法：先分组，再按组渲染

**验收标准**：每组有独立标题和数量标识（AC-02-02）；基金状态变化时自动重新分组（AC-02-03）。

### 6.3 实现分组折叠/展开

在 `overview.js` 中新增 `toggleGroup(groupId)` 方法：切换折叠状态，更新DOM显示/隐藏。

**验收标准**：点击分组标题可折叠/展开（AC-02-04）。

### 6.4 添加分组CSS样式

在 `css/style.css` 中新增 `.fund-group`、`.fund-group-header`、`.group-title`、`.group-count`、`.group-toggle` 等样式，使用CSS变量。

**验收标准**：分组标题有视觉区分，折叠动画流畅。

---

## Task 7：详情页标题栏行情数据展示

**优先级**：P1
**对应需求**：REQ-03
**依赖**：Task 2（主题系统）
**输入**：design.md中的详情页标题栏HTML结构
**输出**：`index.html`（修改detail-header）、`js/detail.js`（修改updateFundInfo）、`css/style.css`（新增标题栏样式）

### 7.1 重构详情页标题栏HTML

在 `index.html` 中，将 `#page-detail` 的 `.detail-header` 替换为新的多区域结构：

- `.detail-title-area`：基金名称+代码
- `.detail-quote-area`：最新净值、估算净值、估算涨幅
- `.detail-actions`：编辑+删除按钮

**验收标准**：标题栏包含行情数据展示区域。

### 7.2 修改Detail.updateFundInfo方法

将行情数据（最新净值、估算净值、估算涨幅）渲染到标题栏的 `.detail-quote-area` 中，而非独立的基金信息区域。估算涨幅使用 `var(--color-success)` / `var(--color-danger)` 着色。

**验收标准**：标题栏显示基金名称、代码、净值、估算数据（AC-03-01、AC-03-02）。

### 7.3 添加标题栏响应式CSS

为 `.detail-header` 添加 `flex-wrap: wrap` 布局，窄屏时行情数据换行到标题下方。确保基金名称始终可见。

**验收标准**：窄屏下行情数据自适应换行，基金名称不隐藏（AC-03-03）。

---

## Task 8：交易备注字段增强

**优先级**：P2
**对应需求**：REQ-07
**依赖**：Task 1
**输入**：现有 `modal.js`（已有备注输入框）、`detail.js`（交易表格）
**输出**：`js/modal.js`（修改maxlength）、`js/detail.js`（修改交易表格渲染）、`css/style.css`（新增备注样式）

### 8.1 增强Modal表单备注字段约束

在 `modal.js` 的 `renderAddTradeForm()` 和 `renderEditTradeForm()` 中，为备注输入框添加 `maxlength="50"` 属性。

**验收标准**：备注输入框限制50字符（AC-07-01）。

### 8.2 在交易表格中显示备注列

在 `detail.js` 的 `renderTradeRow()` 中：

- 在"手续费"列后新增"备注"列
- 有备注时显示文本（超20字符截断加省略号），悬浮显示全文（通过title属性）
- 无备注时显示"-"

在 `index.html` 的交易表格 `<thead>` 中新增"备注"列头。

**验收标准**：交易行显示备注内容，超长截断悬浮显示全文（AC-07-03）。

### 8.3 添加备注列CSS样式

在 `css/style.css` 中新增 `.trade-remark` 样式：`max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`

**验收标准**：备注列超长文本正确截断。

---

## Task 9：交易记录分页与筛选

**优先级**：P2
**对应需求**：REQ-08
**依赖**：Task 1、Task 8（备注列）
**输入**：design.md中的Paginator接口定义
**输出**：`js/paginator.js`（新增）、`js/detail.js`（修改交易记录渲染）、`css/style.css`（新增分页筛选样式）、`index.html`（修改交易记录区域）

### 9.1 实现Paginator通用分页组件

创建 `js/paginator.js`，实现：

- `create(config)`：创建分页实例，初始化数据、分页参数、筛选条件
- `applyFilters(instance, filters)`：按type和日期范围筛选数据，重置到第1页
- `clearFilters(instance)`：清除筛选，恢复全量数据
- `goToPage(instance, page)` / `setPageSize(instance, pageSize)`：翻页和设置每页条数
- `getCurrentPageData(instance)`：返回当前页的数据切片
- `renderControls(instance)`：渲染分页控件HTML（上一页、页码、下一页、每页条数选择、总记录数）
- 通过 `ModuleRegistry.register('Paginator', Paginator)` 注册

**验收标准**：分页实例可创建、筛选、翻页；每页条数支持10/20/50（AC-08-02）。

### 9.2 在Detail中集成Paginator

在 `detail.js` 中：

- 新增 `_tradePaginator` 属性：持有交易记录分页实例
- 修改 `updateTradeList()`：使用Paginator获取当前页数据渲染
- 新增 `onTradePageChange(pageData)`：回调函数，用pageData重新渲染交易表格行
- 新增 `onFilterChange()`：读取筛选条件，调用Paginator.applyFilters()

**验收标准**：交易记录超过10条时显示分页控件（AC-08-01）。

### 9.3 添加筛选UI

在 `index.html` 的交易记录区域添加筛选栏：交易类型下拉框、开始/结束日期输入框、清除筛选按钮、结果数量显示。

**验收标准**：支持按类型和日期范围筛选（AC-08-03）；显示筛选结果数量和条件标签（AC-08-04）；空结果有空状态提示（AC-08-05）。

### 9.4 添加分页和筛选CSS样式

在 `css/style.css` 中新增 `.trade-filter-bar`、`.pagination`、`.page-btn`、`.page-size-select` 等样式。

**验收标准**：分页控件和筛选栏布局正确，响应式适配。

### 9.5 在index.html中引入模块

添加 `<script src="js/paginator.js"></script>`，位于utils.js之后、storage.js之前。

---

## Task 10：Top5盈亏榜单

**优先级**：P2
**对应需求**：REQ-09
**依赖**：Task 1、Task 3（大数字格式化）
**输入**：design.md中的Top5逻辑
**输出**：`js/overview.js`（修改）、`css/style.css`（新增榜单样式）、`index.html`（新增Top5区域）

### 10.1 实现Top5计算逻辑

在 `overview.js` 中新增：

- `calculateTop5(funds)`：遍历基金获取stats，按收益率排序，profitTop5取收益为正的前5，lossTop5取收益为负按升序前5

**验收标准**：盈利Top5按收益率降序，亏损Top5按收益率升序（AC-09-02）；不足5只显示实际数量（AC-09-03）。

### 10.2 实现Top5渲染

在 `overview.js` 中新增：

- `renderTop5Board(title, funds, type)`：渲染榜单标题和列表，每项显示排名、基金名称、收益率
- `updateTop5()`：调用calculateTop5并渲染两个榜单
- 在 `refresh()` 中调用 `updateTop5()`

**验收标准**：汇总页显示盈利Top5和亏损Top5（AC-09-01）；无数据时显示"暂无数据"（AC-09-04）。

### 10.3 添加Top5区域HTML和交互

在 `index.html` 的汇总页中，在统计卡片和基金列表之间添加 `.top5-container` 区域。

为榜单中的基金项添加点击事件，跳转到详情页。

**验收标准**：点击榜单基金跳转详情页（AC-09-05）。

### 10.4 添加Top5 CSS样式

在 `css/style.css` 中新增 `.top5-container`、`.top5-board`、`.top5-list`、`.top5-item` 等样式，使用CSS变量，盈利榜单绿色调、亏损榜单红色调。

**验收标准**：榜单布局为左右两列，响应式窄屏时上下排列。

---

## Task 11：集成测试与优化

**优先级**：P2
**对应需求**：所有REQ、NFR
**依赖**：Task 2 ~ Task 10
**输入**：所有已实现的模块
**输出**：优化后的完整应用

### 11.1 主题切换全链路验证

验证所有页面（汇总页、详情页、弹窗）在深色/浅色主题下显示正确：

- 所有文字可读（对比度足够）
- 所有卡片、表格、按钮颜色正确
- ECharts图表配色跟随主题
- 主题切换响应时间<100ms（NFR-01）

**验收标准**：深色主题下无硬编码浅色值残留，所有UI元素可读。

### 11.2 数据兼容性验证

验证：

- 旧数据（无remark字段）正常加载，备注显示为空
- 导入/导出包含备注字段
- 视图偏好使用独立存储键，不影响现有基金/交易数据
- 大数字格式化不影响底层数据存储

**验收标准**：NFR-04数据兼容性全部满足。

### 11.3 性能验证

验证：

- ECharts图表首次渲染<500ms
- 基金列表排序和视图切换<50ms
- 主题切换<100ms

**验收标准**：NFR-01性能要求全部满足。

### 11.4 响应式布局验证

验证在768px和480px断点下：

- 汇总页统计卡片、Top5、基金列表正确适配
- 详情页标题栏、持仓信息、图表、交易记录正确适配
- 分页控件和筛选栏在窄屏下可用

**验收标准**：移动端布局无溢出、无遮挡。

### 11.5 ECharts Fallback验证

模拟lib/echarts.min.js文件不存在场景，验证：

- 页面正常加载，不报错
- 图表区域显示降级的简单统计信息或"图表加载失败"提示

**验收标准**：NFR-02兼容性要求满足。

---

## 需求覆盖矩阵

| 需求 | 覆盖任务 |
|------|----------|
| REQ-01 CSS变量+主题切换 | Task 2 |
| REQ-02 持仓分组 | Task 6 |
| REQ-03 详情页标题栏行情 | Task 7 |
| REQ-04 ECharts图表 | Task 4 |
| REQ-05 卡片/列表双视图+排序 | Task 5 |
| REQ-06 大数字格式化 | Task 3 |
| REQ-07 交易备注 | Task 8 |
| REQ-08 交易记录分页+筛选 | Task 9 |
| REQ-09 Top5盈亏榜单 | Task 10 |
| NFR-01 性能 | Task 11 |
| NFR-02 兼容性 | Task 11 |
| NFR-03 可维护性 | Task 1, Task 2 |
| NFR-04 数据兼容性 | Task 11 |

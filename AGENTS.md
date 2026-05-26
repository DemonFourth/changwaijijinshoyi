# 场外基金收益计算器 - AGENTS.md
## AI 助手工作流程规范

> **重要**：AI 助手在执行任何任务时，必须遵循以下工作流程：

### 1. 任务分析阶段

**每次执行任务前，必须先调用 `using-superpowers` skill 进行任务分析**：

```
1. 接收用户任务
2. 调用 SkillTool(skill_name="using-superpowers")
3. 根据 skill 指导确定任务类型和执行策略
4. 制定详细的执行计划
```

**同时，根据任务类型查阅 `SKILLS_GUIDE.md` 选择合适的 Skills**：

| 任务类型 | 首选 Skill | 辅助 Skills |
|---------|-----------|------------|
| **新增功能/需求** | `idea-refine` → `brainstorming` | `spec-driven-development`, `planning-and-task-breakdown` |
| **UI 界面开发** | `frontend-ui-engineering` | `design-taste-frontend`, `frontend-design` |
| **重构代码** | `code-simplification` | `code-review-and-quality` |
| **Bug 修复** | `debugging-and-error-recovery` | `test-driven-development` |
| **API 设计** | `api-and-interface-design` | `security-and-hardening` |
| **性能优化** | `performance-optimization` | `browser-testing-with-devtools` |
| **代码审查** | `code-review-and-quality` | `receiving-code-review` |
| **文档编写** | `documentation-and-adrs` | `doc-coauthoring` |
| **安全加固** | `security-and-hardening` | `code-review-and-quality` |
| **数据处理** | `context-mode` | `debugging-and-error-recovery` |
| **部署上线** | `shipping-and-launch` | `ci-cd-and-automation` |
| **多人协作** | `git-workflow-and-versioning` | `code-review-and-quality` |

**完整 Skills 使用指南**：请参考 `SKILLS_GUIDE.md`

**目的**：
- 确保任务理解准确
- 选择正确的执行策略
- 避免遗漏关键步骤
- 提高执行效率

### 2. 任务执行阶段

**执行过程中必须遵循**：
- 使用 TodoWrite 工具跟踪任务进度
- 每完成一个步骤立即标记为 completed
- 遇到问题及时调整计划



### 2.1 新增功能/修改前置调研（必须执行）

在执行任何新功能开发或重大修改前，**必须**按顺序执行以下步骤：

#### 步骤 1：读取项目上下文
- [ ] 读取 `AGENTS.md` 中的「核心模块说明」章节
- [ ] 读取 `ARCHIVE.md` 中的功能列表
- [ ] 读取 `moduleRegistry.js` 了解已注册模块

#### 步骤 2：设计适配检查
- [ ] 确认现有模块是否有扩展点（如 `config.js` 配置项）
- [ ] 确认是否有现成工具可用（如 `Pagination`、`TooltipManager`）
- [ ] 优先通过配置/扩展实现，而非新建模块

#### 步骤 3：提出方案
- [ ] 向用户展示实现方案
- [ ] 说明为何选择此方案（而非其他方式）
- [ ] 等待用户确认后再执行

#### 禁止行为

🚫 严禁未经调研直接创建新文件/新模块
🚫 严禁绕过现有配置系统直接硬编码
🚫 严禁重复实现已有功能（如已有 `Pagination` 再写一个分页）

### 3. Git 提交规范



### 3.1 Git 操作流程（必须遵守）

#### 操作流程

```
修改代码 → git add → git commit → [展示提交信息] → 等待用户指令
```

#### 自动执行
- ✅ `git add <修改的文件>`
- ✅ `git commit -m "..."`（按规范格式）

#### 需用户指令
- ⏸️ `git push`：**仅当用户明确要求时执行**
- ⏸️ `git push --force`：**严禁执行**（除非用户明确批准）

#### 禁止行为

🚫 严禁跳过 git commit
🚫 严禁自动执行 git push
🚫 严禁 git push --force
🚫 严禁在未 staging 的情况下提交

### 3.2 修改后验证清单（必须执行）

每次修改代码后，**必须**执行以下验证：

#### 基础验证（必须）
- [ ] 页面可正常打开（无白屏、无 JS 错误）
- [ ] 核心数据可正常显示（股票列表、交易记录）
- [ ] 无控制台错误（打开 DevTools 检查）

#### 功能验证（根据修改类型）
| 修改类型 | 验证内容 |
|----------|----------|
| 计算逻辑 | 手动验证收益计算结果 |
| UI 组件 | 检查各页面正常显示 |
| 数据存储 | 导入导出功能正常 |
| 股价获取 | 当前股价显示正常 |

#### 验证命令
```bash
# 检查语法错误
npm run lint
```

#### 禁止行为

🚫 严禁在未验证的情况下声称任务完成
🚫 严禁忽略控制台错误
🚫 严禁修改后不检查页面是否正常打开


### 4. 任务完成阶段

**任务完成后必须**：
1. 总结任务执行情况
2. 列出所有修改的文件
3. 确认 git 提交已完成
4. 在最后一行添加 🎯 标记

**任务终止规范（重要）**：

```
🚨 [ERROR] 任务终止与工具调用强制规范（必须严格遵守）

当你尚未完成用户任务时：
➤ 必须主动调用合适的工具继续执行，不得停止、不得仅输出结论或空内容。

当你确信任务已完成时：
➤ 必须先提供清晰、完整的任务总结（包括关键结果或行动回顾），
➤ 然后在总结的最后一行末尾添加 🎯 以正式结束任务。

[ERROR] 严禁以下行为：
❌ 单独返回 🎯；
❌ 在无总结的情况下输出 🎯；
❌ 未调用工具却声称任务完成。

⚠️ 违反上述任一规则将被视为 [ERROR] —— 请始终确保：总结 + 🎯 = 合法终止，否则继续使用工具推进。
```

**正确示例**：
```
## 任务完成总结

我已成功完成任务...

### ✅ 执行情况
...

### 📝 修改的文件
...

🎯
```

**错误示例**：
```
❌ 任务完成了 🎯  （缺少详细总结）
❌ 🎯  （只有标记，没有总结）
❌ 任务完成了  （缺少 🎯 标记，会导致系统重复提示）
```

## 项目概述

**名称**：场外基金收益计算器 (fund-return-calculator)
**类型**：本地优先的前端 Web 应用，支持可选 Cloudflare Pages Functions + D1 云同步与 Public API
**技术栈**：原生HTML/CSS/JavaScript + ECharts + LocalStorage + Cloudflare Pages Functions + D1

---

## 构建/测试/Lint命令

```bash
# 全部lint检查（JS + CSS）
npm run lint

# 仅JS检查
npm run lint:js

# 仅CSS检查
npm run lint:css

# 自动修复lint问题
npm run lint:fix

# 运行所有测试
npm test

# 运行单个测试文件
node --test tests/routerNavigation.test.cjs

# 运行匹配模式的测试
node --test tests/*.test.cjs
node --test tests/fund*.test.cjs
node --test tests/*sync*.test.cjs

# 本地静态服务器（开发测试）
npm run dev:static

# Cloudflare Pages 本地开发
npm run dev

# 部署到 Cloudflare Pages
npm run deploy

# 预览部署结果
npm run preview
```

---

## 代码风格指南

### 基本规则
- **缩进**：4个空格
- **引号**：单引号
- **分号**：必须
- **尾逗号**：不允许
- **变量声明**：优先使用`const`，其次`let`，禁止`var`
- **比较运算符**：使用`===` / `!==`，禁止`==` / `!`

### 函数与代码块
- 禁止空函数（可添加注释说明用途）
- 禁止多个连续空格
- 文件末尾保留一个换行符
- 禁止行尾空格

### 命名约定
- 构造函数/类：`PascalCase`（如`FundManager`,`TradeAppService`）
- 变量/函数：`camelCase`（如`fundList`,`calculateFee`）
- 常量：`UPPER_SNAKE_CASE`（如`SYNC_INTERVAL`）
- 私有变量/方法：`_`前缀（如`_internalState`）

### 禁止项
- 禁止`eval()`
- 禁止隐式`eval`
- 禁止`new Function()`
- 禁止在定义前使用变量
- 禁止变量遮蔽（shadowing）
- 禁止稀疏数组

### 注释规范
- 对象方法内部禁止使用`this`调用其他方法，应使用明确的对象名
- 复杂逻辑需添加说明注释
- 禁止无意义的空注释

---

## 导入与模块

### 全局对象（已声明）
项目使用全局对象模式，已在`.eslintrc.js`中声明：
```
FundCalculator, ModuleRegistry, EventBus, EventType, Config, Utils,
Storage, DataService, FundAPI, Calculator, CalculatorV2, FundManager,
TradeManager, Router, Modal, Overview, Detail, App, ThemeManager,
ChartManager, CycleGroupRenderer, CycleTradeDisplay, Paginator,
NameCache, NameValidator, FIFOCalculator, FIFOValidator,
BigNumberFormatter, echarts, ConversionCalculator, ToolPage,
StatisticsAppService, SyncAppService, LocalStorageAdapter,
CloudflareD1SyncAdapter, SyncAdapterRegistry, FundProviderRegistry,
TiantianFundProvider, SyncConflictModalHelper, SyncFirstSyncHelper,
SyncStatusPresenter, RuntimeConfigLoader, StorageSchema, StorageMigrations
```

### 模块组织约定
- 页面层（`overview.js`, `detail.js`, `modal.js`）：负责页面编排、事件绑定、调用helper/service
- 业务写操作优先走application层：`js/application/*.js`
  - 基金相关：`FundAppService`
  - 交易相关：`TradeAppService`
  - 统计汇总：`StatisticsAppService`
  - 设置/导入导出：`AppSettingsService`
- 数据读取优先通过manager或repository
- 持久化统一通过`LocalStorageAdapter`与`StorageSchema`

### FundAppService 字段类型与同步触发规则

`FundAppService` 将基金字段分为三类，决定变更时是否触发云端同步：

| 类型 | 定义位置 | 包含字段 | 变更时发射事件 | 是否触发同步 |
|------|----------|---------|---------------|------------|
| **瞬态字段 (TRANSIENT)** | `TRANSIENT_FIELDS` Set | `netValue`, `netValueDate`, `estimatedValue`, `estimatedGrowth`, `estimatedDate`, `nameSource`, `nameUpdateTime` | `NET_VALUE_UPDATED` | ❌ 否 |
| **元数据键 (META)** | `META_KEYS` Set | `updatedAt`, `updateTime`, `lastSyncedAt`, `createdAt`, `deletedAt` | 不计入变更判断 | ❌ 否 |
| **业务字段** | 以上之外的所有字段 | `name`, `code`, `feeTiers` 等 | `FUND_UPDATED` | ✅ 是 |

**关键逻辑**（`fundAppService.js:107-111`）：
```javascript
if (hasNetValueChange && !hasStructuralChange) {
    EventBus.emit(EventType.NET_VALUE_UPDATED, { fund: funds[index] });
    // 仅 NET_VALUE_UPDATED → 不触发同步
} else if (hasStructuralChange) {
    EventBus.emit(EventType.FUND_UPDATED, { fund: funds[index] });
    // FUND_UPDATED → syncAppService 监听 → notifyBusinessDataChanged
}
```

**批量更新方法 `batchUpdateFunds(fundUpdates)`**（`fundAppService.js:22-50`）：
- 用途：一次性批量更新多只基金的净值（刷新场景），避免 N 次独立写入和 N 次事件发射
- 参数：`[{ fundId, updates }]`
- 行为：单次 `FundRepository.saveAll()` + 单次 `NET_VALUE_UPDATED` 事件（含 `batch: true` 标志）
- **不会触发同步**（净值是瞬态数据，非用户操作）

### App 启动顺序

`App.init()` 执行顺序（`app.js`）：
```
1. 同步 localStorage 操作：DataService → Storage → ThemeManager → Router → Overview → Detail
2. hideLoading()  — 立即显示页面内容
3. 网络异步操作：RuntimeConfigLoader → SyncAppService.setupEventListeners → SyncAppService.startBackgroundSync
```
**原则**：所有同步操作（本地数据读取）先执行完毕再隐藏 loading，网络相关异步操作后置执行，避免启动白屏。

---

## 数据模型

### Fund（基金对象）
```javascript
{
  id: string,           // 唯一标识
  name: string,        // 基金名称
  code: string,        // 基金代码
  netValue: number,    // 最新净值
  feeTiers: {          // 费率配置
    buyTiers: [{ minAmount, maxAmount, rate }],
    sellTiers: [{ minDays, maxDays, rate }]
  }
}
```

### Trade（交易记录）
```javascript
{
  id: string,          // 唯一标识
  fundId: string,      // 所属基金ID
  date: string,        // 交易日期
  type: 'buy'|'sell'|'dividend',
  netValue: number,    // 净值
  shares: number,      // 份额
  amount: number,      // 金额
  fee: number,         // 手续费
  remark: string,
  dividendMode: 'cash'|'reinvest'
}
```

---

## 计算引擎说明

### 加权平均成本法（`calculatorV2.js`）
- 用途：计算持仓成本和收益
- 买入：持仓总成本 += 买入金额（含手续费）
- 卖出：持仓总成本 -= 卖出份额 × 持仓成本价

### 浮动盈亏计算方法
```javascript
// 浮动盈亏（使用最新净值）- 详情页"浮动盈亏"字段
CalculatorV2.calculateFloatingProfit(trades, fund)
// 返回: { shares, cost, value, floatingProfit, profitRate }

// 预估浮动盈亏（使用估算净值）- 详情页"预估浮动盈亏"字段
CalculatorV2.calculateEstimatedFloatingProfit(trades, fund)
// 返回: { shares, cost, value, floatingProfit, profitRate }
```
- **浮动盈亏**：用 `netValue`（最新净值）计算，反映当前实际盈亏
- **预估浮动盈亏**：用 `estimatedValue`（估算净值）计算，反映盘后预估算盈亏
- 两者公式相同：`floatingProfit = 持有份额 × 净值 - 持仓成本`，但使用的净值不同

### FIFO（`fifoCalculator.js` + `feeCalculator.js`）
- 用途：计算卖出手续费（根据持有天数匹配费率）
- 费率区间为左闭右开：`minDays <= 持有天数 < maxDays`
- 持有天数 = 卖出日期 - 买入日期（向下取整）

### 持仓周期识别（`calculatorV2.js`）

`CalculatorV2.identifyHoldingCycles(trades)` 函数用于将交易记录按"买入-持有-卖出"划分为不同的持仓周期。

#### 重要特性：内部自动排序
**该函数内部会自动按日期排序，无论输入顺序如何。**

这意味着：
- 即使交易记录在 storage 中的存储顺序与日期顺序不一致，函数仍能正确识别周期
- 不用担心调用方是否排序，函数内部有自我保护

#### 周期切换规则
- **开启新周期条件**：`holdingShares <= Utils.EPSILON` 时遇到买入 → 创建新周期
- **关闭周期条件**：卖出后 `holdingShares <= Utils.EPSILON` → 当前周期结束

```javascript
// 内部逻辑简化
const sortedTrades = trades.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
for (const trade of sortedTrades) {
    if (trade.type === 'buy' && holdingShares <= Utils.EPSILON) {
        // 开启新周期
    }
    // ... 处理买卖
    if (trade.type === 'sell' && holdingShares <= Utils.EPSILON) {
        // 周期结束
    }
}
```

#### 常见问题：周期识别数量与预期不符
如果实际识别出的周期数与交易记录表格中显示的"第X轮"不符，可能原因：
1. **存储顺序问题**：交易记录存储顺序与日期顺序不一致（已通过内部排序解决）
2. **卖出份额未清零**：某次卖出后 `holdingShares` 未归零，导致周期未关闭
3. **时间间隔问题**（未实现）：长时间无交易应视为周期结束

#### 调试方法
```javascript
const trades = TradeManager.getTradesByFund(fundId);
const cycles = CalculatorV2.identifyHoldingCycles(trades);
console.log('识别出的周期数:', cycles.length);
cycles.forEach((c, i) => {
  console.log(`周期${i+1}:`, c.startDate, '~', c.endDate, '状态:', c.status, '交易数:', c.trades.length);
});
```

### 计提计算（`calculatorV2.js`）
- 用途：根据提取比例计算需要卖出的份额
- 核心逻辑：**目标金额 = 累计买入成本 × 提取比例**（不是基于当前持仓成本、估算市值或收益）

#### 计提计算公式
| 项目 | 计算方式 |
|------|---------|
| 累计买入成本 | 当前进行中周期内所有买入交易的总金额（不考虑卖出） |
| 估算市值 | 当前持有份额 × 估算净值 |
| 提取比例 | 用户选择的百分比（10%、20%、30%、50%、100%或自定义） |
| **目标金额** | **累计买入成本 × 提取比例**（固定值） |
| 所需份额 | 目标金额 ÷ 估算净值 |
| 预估手续费 | FIFO计算（基于卖出份额和持有天数） |
| 实际到账 | 目标金额 - 预估手续费 |

#### 计提计算举例
场景：买入成本10000元，选择10%提取比例

| 市值 | 涨幅 | 总收益 | 目标金额 | 说明 |
|------|------|--------|---------|------|
| 11000 | 10% | 1000元 | **1000元** | 累计买入成本10000 × 10% |
| 12000 | 20% | 2000元 | **1000元** | 累计买入成本10000 × 10%（之前已提取1000元） |
| 13000 | 30% | 3000元 | **1000元** | 累计买入成本10000 × 10%（之前已提取2000元） |

**关键理解**：
- 目标金额基于"累计买入成本"计算，不是基于"当前持仓成本"、"当前市值"或"收益"
- 每次提取金额固定：只要累计买入成本不变、比例不变，每次提取金额相同
- 累计提取上限：理论上累计提取金额上限 = 收益总额（持仓市值 - 累计买入成本）

---

## 图表相关问题修复

### 持仓成本曲线卖出日断连问题

**现象**：卖出日（如 02-25）持仓成本曲线显示为 null，曲线断裂。

**根因**：`chartManager.js` 中成本价记录使用了阈值优化——如果成本变化小于 0.0001 就设为 null。这导致卖出日即使成本没变，也不在图表上记录点。

**修复**（`chartManager.js:1164-1168`）：
```javascript
const isSellDay = tradeType === 'sell';
const costPriceValue = (isSellDay || prevCostPrice === null || Math.abs(costPrice - prevCostPrice) > 0.0001)
    ? parseFloat(costPrice.toFixed(4)) : null;
```
卖出日强制记录成本价，无论是否变化。

### 多周期数据对齐算法问题

**现象**：周期1的数据错误显示在周期2的日期位置，导致只有少数点可见。

**根因**：`buildCostAndShareOption` 使用单指针递增算法进行日期对齐，无法正确处理多周期场景。当 `uniqueDates`（所有周期日期并集）与单个周期的 `dates` 数组长度不同时，索引错位。

**修复**（`chartManager.js:1248-1268`）：
```javascript
const alignedDateToIdx = {};
for (let di = 0; di < cycleData.dates.length; di++) {
    alignedDateToIdx[cycleData.dates[di]] = di;  // 建立日期→索引的Hash映射
}

for (let di = 0; di < uniqueDates.length; di++) {
    const dateKey = uniqueDates[di];
    if (alignedDateToIdx.hasOwnProperty(dateKey)) {
        const dataIdx = alignedDateToIdx[dateKey];
        alignedNetValues.push(cycleData.netValues[dataIdx]);
        // ...
    } else {
        alignedNetValues.push(null);  // 非本周期日期填null
    }
}
```

### 周期内曲线断连问题

**现象**：同一周期内，有交易的日期之间曲线断开。

**根因**：`connectNulls: false` 导致所有 null 值位置都断开。

**修复**（`chartManager.js:1293, 1316, 1345`）：
- 买入净值、持仓成本、卖出净值 series 的 `connectNulls` 改为 `true`
- 效果：周期内曲线自动连线，周期之间因数据全为 null 而自然断开

### 周期过滤时X轴未过滤问题

**现象**：选择单个周期时，X轴仍显示所有周期的日期（只是没有曲线）。

**修复**（`chartManager.js:1216-1221`）：
```javascript
let uniqueDates = allDates;
if (selectedCycleId) {
    const selectedCycleData = cycleDataList.find(function(c) { return c.cycleId === selectedCycleId; });
    if (selectedCycleData) {
        uniqueDates = selectedCycleData.dates.slice();  // 只用选中周期的日期
    }
}
```
当选中特定周期时，X轴只显示该周期的日期范围。

---

## 统计汇总服务

### StatisticsAppService
文件位置：`js/application/statisticsAppService.js`

#### 核心方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `getAllSummary()` | 获取所有汇总数据 | `{ holding, closed, yearly, monthly }` |
| `getHoldingSummary()` | 持仓汇总（份额 > 0） | HoldingSummary |
| `getClosedSummary()` | 已清仓汇总（份额 == 0） | ClosedSummary |
| `getYearlySummary()` | 年度汇总（当年） | YearlySummary |
| `getMonthlySummary()` | 月度汇总（最近6个月） | MonthlySummary[] |
| `clearCache()` | 清除缓存 | void |

#### 图表渲染
- `ChartManager.buildMonthlyProfitChartOption(monthlyData)` - 生成月度收益柱状图配置

#### 数据结构

**持仓汇总 (Holding Summary)**
```javascript
{
  totalInvest: number,      // 累计买入成本
  totalValue: number,       // 当前市值
  totalProfit: number,      // 浮动盈亏
  profitRate: number,       // 盈利率 (%)
  fundCount: number         // 持仓基金数量
}
```

**已清仓汇总 (Closed Summary)**
```javascript
{
  totalInvest: number,      // 累计买入成本
  totalSellAmount: number,  // 累计卖出金额
  totalProfit: number,      // 已实现收益
  profitRate: number,       // 收益率 (%)
  fundCount: number         // 已清仓基金数量
}
```

**年度汇总 (Yearly Summary)**
```javascript
{
  year: number,             // 年份
  totalProfit: number,      // 年度已实现收益
  totalInvest: number,      // 年度累计买入
  sellAmount: number,      // 年度卖出金额
  fee: number,              // 年度手续费
  cycleCount: number        // 年度交易次数
}
```

**月度汇总 (Monthly Summary)**
```javascript
{
  year: number,             // 年份
  month: number,           // 月份 (1-12)
  monthKey: string,        // 格式: "YYYY-MM"
  totalProfit: number,     // 月度已实现收益
  totalInvest: number,     // 月度累计买入
  sellAmount: number,      // 月度卖出金额
  fee: number,              // 月度手续费
  cycleCount: number        // 月度交易次数
}
```

#### 缓存机制
- 使用 `_cache: Map` 存储计算结果
- 缓存键：`'holdingSummary'`, `'closedSummary'`, `'yearlySummary'`, `'monthlySummary'`
- 通过事件 `EventType.CALCULATION_UPDATED` 自动失效缓存

#### 注意事项
- 已实现收益 = 卖出金额 - 买入成本 - 手续费
- 年度/月度汇总按**周期交易**聚合，非单笔交易
- 汇总数据按运行时计算，不持久化
- 数据全部本地计算，不上传云端

---

## 同步机制

### 概述

本应用使用 Cloudflare Pages Functions + D1 实现云端同步，采用 **乐观并发控制** 模式，通过 `revision` 版本号协调多端数据一致性。

### 本地变更 → 同步触发规则

`SyncAppService._setupEventListeners()`（`syncAppService.js:175-188`）监听以下 EventBus 事件决定是否触发云端推送：

| 事件 | 触发条件 | 行为 |
|------|---------|------|
| `FUND_UPDATED` | 基金业务字段变更（名称、代码、费率等） | `notifyBusinessDataChanged()` → `pendingChanges++` → 触发 Push |
| `TRADE_UPDATED` | 交易业务字段变更 | 同上 |
| `DATA_IMPORTED` | 数据导入完成 | 同上 |
| `DATA_CLEARED` | 数据清空 | 同上 |
| `NET_VALUE_UPDATED` | **净值/估算值刷新（瞬态字段）** | **不触发同步** |
| `CALCULATION_UPDATED` | 计算结果变更 | **不触发同步** |
| `FUND_DELETED` | 基金删除 | 不触发（但 FUND_DELETED 同时发射 TRADE_UPDATED，由后者触发） |

**规则**：只有用户主动的**业务数据变更**（基金信息、交易记录、导入数据）才会触发同步，**净值刷新**等 API 实时数据变化被隔离在同步通道外。

**验证此设计的主要测试**：`tests/fundManagerRefresh.test.cjs` — 验证 `addFund` 触发同步（1 次），`updateFund(netValue)` 不触发同步（不增加计数）。

### 核心组件

| 组件 | 文件位置 | 职责 |
|-----|---------|------|
| `SyncAppService` | `js/application/syncAppService.js` | 客户端同步协调（Pull/Push/Resolve） |
| `CloudflareD1SyncAdapter` | `js/storage/cloudflareD1SyncAdapter.js` | 云端适配器（HTTP 请求） |
| `LocalStorageAdapter` | `js/storage/localStorageAdapter.js` | 本地存储适配器 |
| `syncRepository` | `functions/_shared/syncRepository.js` | 服务端 D1 数据访问 |
| `syncUtils` | `functions/_shared/syncUtils.js` | 服务端冲突检测 |
| `pull.js` | `functions/api/sync/pull.js` | 拉取云端数据 |
| `push.js` | `functions/api/sync/push.js` | 推送本地数据到云端 |
| `resolve.js` | `functions/api/sync/resolve.js` | 解决同步冲突 |

### 同步元数据（syncMeta）

```javascript
{
  deviceId: string,           // 设备唯一标识
  cloudRevision: number,      // 云端当前版本号
  syncStatus: string,         // idle | pending | syncing | conflict | error
  lastSyncAt: string,         // 上次同步时间（ISO）
  lastPushedAt: string,       // 上次推送时间（ISO）
  lastPulledAt: string,       // 上次拉取时间（ISO）
  pendingChanges: number,     // 待推送变更数
  lastError: string | null,   // 上次错误信息
  provider: 'cloudflare' | 'local'
}
```

### 同步流程

#### Pull 流程（启动时/手动触发）

```
客户端                      服务端                     D1
   |                          |                          |
   |-- GET /api/sync/pull --->|                          |
   |   ?deviceId=xxx          |                          |
   |   &cloudRevision=xxx     |-- SELECT snapshot ------->|
   |                          |<-- 返回 revision/funds/trades --|
   |<-- {success, revision,   |                          |
   |    funds, trades} ------|                          |
   |                          |                          |
   +--> 合并数据:                                     |
        - 本地空 + 云端有 → 直接填充                    |
        - 本地有 + 云端空(revision更新) → 清空本地       |
        - 都有数据 → 差异检测与合并                      |
            - 有冲突 → 返回冲突列表让用户选择             |
            - 无冲突 → 保存合并结果                      |
```

#### Push 流程（数据变更时触发）

```
客户端                      服务端                     D1
   |                          |                          |
   |-- POST /api/sync/push --->|                          |
   |   {deviceId,             |                          |
   |    baseRevision,         |                          |
   |    funds, trades}       |-- SELECT snapshot ------->|
   |                          |  比较 baseRevision vs 当前|
   |                          |                          |
   |                          |  [revision相同] → 写入    |
   |                          |-- UPDATE snapshot, ++revision -->|
   |                          |<-- 返回新 revision ------|
   |<-- {success, revision} ---|                          |
   |                          |                          |
   +--> 更新 localStorage: cloudRevision = result.revision |
```

### 冲突检测规则

服务端和客户端使用**统一的冲突检测逻辑**（两方独立检查 `lastSyncedAt`）：

1. **双方都有 lastSyncedAt**：各自检查 `updatedAt > lastSyncedAt` → 两者都变才冲突
2. **仅一方有 lastSyncedAt**：有的一方判断是否修改；无的一方视为未同步
3. **双方都无 lastSyncedAt**：跳过冲突检测，走 30 天首次同步兜底阈值

```javascript
// 修复后逻辑（服务端 syncUtils.js + 客户端 _mergeEntities 一致）
const localLastSynced = localEntity.lastSyncedAt ? new Date(localEntity.lastSyncedAt).getTime() : 0;
const cloudLastSynced = cloudEntity.lastSyncedAt ? new Date(cloudEntity.lastSyncedAt).getTime() : 0;
const localModifiedAfterSync = localLastSynced > 0 && localTime > localLastSynced;
const cloudModifiedAfterSync = cloudLastSynced > 0 && cloudTime > cloudLastSynced;

if (localModifiedAfterSync && cloudModifiedAfterSync) {
    if (业务数据有实质差异) conflicts.push(...);
}
```

**关键修复**：`lastSyncedTime === 0` 不再等价于"有变更"（原 bug）。双方都无 `lastSyncedAt` 时静默跳过，30 天阈值做兜底。

### Pull 三种路径

`_executePull()` 根据本地云端数据状态走三种路径：

| 路径 | 条件 | 行为 |
|------|------|------|
| **填充** | 本地空 + 云端有 | 直接用云端数据覆盖本地，更新 syncMeta（`cloudFunds/cloudTrades` 设为云端长度，`pendingChanges: 0`），并设置所有实体 `lastSyncedAt` |
| **清空** | 本地有 + 云端空（revision更新） | 清空本地数据，syncMeta 同上处理 |
| **合并** | 双方都有数据 | 走首次同步检测或冲突检测合并 |

**注意**：填充/清空路径必须通过 `StorageSchema.createEmptySnapshot()` 结果覆盖 `cloudFunds/cloudTrades`，而非从旧 `localSnapshot` 展开，否则 syncMeta 会显示 `cloudFunds: 0, cloudTrades: 0` 的错误值。

### 首次同步检测

当本地和云端都有数据时，`_executePull()` 检测是否首次同步：

```javascript
// 检测条件：syncMeta.lastSyncAt 为空，且所有实体均无 lastSyncedAt
const isFirstSync = !syncMeta.lastSyncAt &&
    localSnapshot.funds.every(f => !f.lastSyncedAt) &&
    localSnapshot.trades.every(t => !t.lastSyncedAt);
```

首次同步时返回 `{ firstSync: true, ... }`，由上层（`manualSync()` / `startBackgroundSync()`）交给 `_handleFirstSyncChoice()` 处理——弹出三选一对话框：

| 选项 | 行为 |
|------|------|
| **保留本地** | 推送本地数据覆盖云端 |
| **使用云端** | 拉取云端数据覆盖本地（调用 `forceOverwriteLocal()`） |
| **合并** | 执行正常的冲突检测合并流程 |

对话框由 `SyncFirstSyncHelper`（`js/modal/syncFirstSyncHelper.js`）实现，样式在 `style.css` 中以 `.first-sync-*` 类定义。

### 核心方法

#### `forceOverwriteLocal()`
直接替换本地 snapshot 为云端数据，跳过 merge。应对"强制下载云端"场景：

```javascript
SyncAppService.forceOverwriteLocal = async function() {
    const cloudData = await adapter.pull(syncMeta.deviceId, 0);
    LocalStorageAdapter.saveSnapshot({
        funds: cloudData.funds,
        trades: cloudData.trades
    });
    LocalStorageAdapter.updateSyncMeta({
        cloudRevision: cloudData.revision,
        syncStatus: 'idle',
        pendingChanges: 0
    });
};
```

#### `_mergeEntities()`（统一冲突检测算法）
客户端与服务端使用同一套冲突检测逻辑：

```javascript
const lastSyncedTime = localEntity.lastSyncedAt
    ? new Date(localEntity.lastSyncedAt).getTime() : 0;
const localTime = new Date(localEntity.updateTime).getTime();
const cloudTime = new Date(cloudEntity.updateTime).getTime();
const localChangedAfterSync = lastSyncedTime === 0 || localTime > lastSyncedTime;
const cloudChangedAfterSync = lastSyncedTime === 0 || cloudTime > lastSyncedTime;
// 首次同步（lastSyncedAt 为空）30 天阈值
const FIRST_SYNC_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;
const isWithinFirstSyncWindow = lastSyncedTime === 0 &&
    Math.abs(localTime - cloudTime) < FIRST_SYNC_THRESHOLD_MS;
const isFirstSync = lastSyncedTime === 0;
```

关键差异：
- 使用 `Date.getTime()`（毫秒时间戳）而非 ISO 字符串比较——ISO 字符串与 0 比较会得到 `NaN`
- 首次同步增加 30 天兜底阈值

### 同步锁
使用 `_syncInProgress` 标志 + `try-finally` 防止 Pull/Push 并发执行：

```javascript
async _executePush() {
    SyncAppService._syncInProgress = true;
    try {
        // ... push 逻辑
    } finally {
        SyncAppService._syncInProgress = false;  // 异常时也释放
    }
}
```

**修复**：原代码在 try 块外释放锁，异常时锁永久持有。现统一使用 `try-finally` 确保始终释放。

#### 冲突解决后更新 revision
`resolveConflicts()` 成功后必须更新 `cloudRevision`：
```javascript
const result = await adapter.resolve(conflicts, resolutions);
if (result && result.success) {
    if (result.revision) {
        window.LocalStorageAdapter.updateSyncMeta({
            cloudRevision: result.revision,
            syncStatus: 'idle'
        });
    }
}
```

#### 重试失败清理状态
推送失败重试达到上限后，必须清理状态：
```javascript
_scheduleRetry(reason) {
    if (SyncAppService._retryCount >= SyncAppService._maxRetryCount) {
        SyncAppService._syncInProgress = false;
        SyncAppService._retryCount = 0;
        window.LocalStorageAdapter.updateSyncMeta({
            syncStatus: 'error',
            lastError: reason || 'push_failed'
        });
        return;
    }
    // ...
}
```

### 同步拉取常见问题

#### 填充/清空后 cloudFunds 显示为 0

**现象**：Pull 填充（local空 + cloud有）或清空（local有 + cloud空）后，syncMeta 显示 `cloudFunds: 0, cloudTrades: 0`，即云端数据条目数错误显示为零。

**根因**：`_executePull()` 填充/清空路径在设置 syncMeta 前，先构造了 `newSnapshot = { ...localSnapshot }`，这会把旧的 syncMeta（`cloudFunds: 0` 等默认值）展开进来；然后 `saveSnapshot()` 内部调用 `migrateSnapshot()` 时 `{ ...defaultMeta, ...meta }` 合并顺序又把 `pendingChanges` 覆盖为 `0`。

**修复**：填充/清空路径使用 `StorageSchema.createEmptySnapshot()` 的结果作为目标 syncMeta 模板，明确设置 `cloudFunds: cloudData.funds.length`、`cloudTrades: cloudData.trades.length`、`pendingChanges: 0`，并对所有实体设置 `lastSyncedAt`。

#### 冲突弹窗字段显示 undefined

**现象**：冲突解决弹窗中，基金冲突的各项字段显示为 `undefined`。

**根因**：`syncConflictModalHelper.js` 中提前将 `entityType` 变量从英文（`'fund'`/`'trade'`）翻译为中文（`'基金'`/`'交易'`），而下游 `_formatVersionDetail(fund)` 只对交易走 `else` 分支渲染模板，对基金行走 `if (entityType === 'fund')` 分支但 `entityType` 已是中文，永远不命中，导致基金字段全为 `undefined`。

**修复**：保留 `entityType` 为英文值传递到下游方法，仅在最终 UI 显示时才使用翻译后的标签变量。

### 同步推送常见问题

#### D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'

**现象**：PUSH 请求服务端返回 500，错误信息 `D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'`。push 重试 3 次后停止，同步卡在 `error` 状态。

**根因链**：
1. 批量导入的交易记录在创建时缺少 `id` 字段（`batchTradeImportHelper._parseText` 未生成 `id`）
2. `StorageSchema.createTradeEntity` 执行 `id: trade.id` → `undefined`；`syncId: trade.syncId || trade.id` → `undefined`
3. `JSON.stringify` 丢弃 `undefined` 键 → localStorage 中存储的交易缺少 `id`/`syncId`
4. 同步推送时服务端 `appendChangeLogs` 执行 `entity.syncId` → 传入 D1 bind 参数 → `D1_TYPE_ERROR`

**修复方案**（三处缺一不可）：

| # | 文件 | 修改 | 作用 |
|---|------|------|------|
| 1 | `functions/_shared/syncRepository.js:118` | `entity.syncId` → `entity.syncId \|\| null` | **服务端防御** — 阻止 `undefined` 进入 D1 bind，已损坏数据也能推送 |
| 2 | `js/storage/schema.js:65` | `id: trade.id` → `id: trade.id \|\| Utils.generateId()` | **持久化层修复** — `createTradeEntity` 时回退生成 ID |
| 3 | `js/modal/batchTradeImportHelper.js:212` | 新增 `id: Utils.generateId()` | **源头修复** — 导入解析时直接生成 ID |

**排查步骤**：
```javascript
// 1. 检查 localStroage 中是否有缺失 id 的交易
const snapshot = JSON.parse(localStorage.getItem('fund_calculator_snapshot'));
snapshot.trades.filter(t => !t.id).length

// 2. 检查 syncId 是否完好
snapshot.trades.filter(t => !t.syncId).length

// 3. 手动修复（必要时代码执行）
snapshot.trades = snapshot.trades.map(t => ({
    ...t,
    id: t.id || 'fix_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9),
    syncId: t.syncId || t.id
}));
localStorage.setItem('fund_calculator_snapshot', JSON.stringify(snapshot));
```

**注意事项**：
- `JSON.stringify` 会静默丢弃对象中的 `undefined` 值（不报错），这是 root cause 难以追踪的原因
- 即使客户端修复了新导入代码路径，localStorage 中已有的损坏交易仍需通过修复 1（服务端防御）来兼容
- D1 的 `bind()` 方法对 `undefined` 敏感，但对 `null` 友好，因此 `|| null` 是可靠的安全垫

### 已知修复清单（2026-05-19）

| 问题 | 类型 | 修复 |
|------|------|------|
| CORS 凭证冲突 | 阻塞 | `jsonResponse` 反射 `Origin` + 移除 `credentials:'include'` |
| sync 端点无认证 | 阻塞 | X-Sync-Key 校验（复用 `PUBLIC_API_KEY`） |
| D1 无乐观锁 | 阻塞 | `UPDATE WHERE revision = ?` + `affectedRows` 检查 |
| Push 全量替换丢失云端实体 | 阻塞 | 推送时合并云端独有实体到客户端数据 |
| forcePushLocal 永久失败 | 阻塞 | 先 fetch `cloudRevision` 再 push |
| this 绑定风险 | 阻塞 | `visibilitychange` 使用 `SyncAppService._executePush()` |
| 锁释放过早/异常不释放 | 阻塞 | `try-finally` 包裹全部同步操作 |
| pendingChanges 竞态 | 高 | `prePushPendingCount` 记录，只减增量 |
| import 旁路 | 高 | 移除 `source: 'import'` 分支 |
| merge 后无 lastSyncedAt | 高 | 合并后全部实体标记 `lastSyncedAt: now` |
| entityType 启发式误判 | 高 | `entityType: 'fund'/'trade'` 显式字段 |
| 冲突解决不保存本地 | 高 | resolve 成功后写回 `localStorage` |
| 字段清洗虚假冲突 | 中 | 服务端 `isDataChanged` 排除 `netValue` 等动态字段 |
| lastSyncedAt=0 假冲突 | 中 | 两方独立检查，`0` 不再视为"有变更" |
| 服务端无输入校验 | 中 | `validateEntities()` 校验 syncId/type/code/name |
| Resolve 无 revision 检查 | 中 | `baseRevision` 比较 + 乐观锁 |
| Public API 无 changelog/lastSyncedAt | 中 | POST 写入 `appendChangeLogs` + 设置 `lastSyncedAt` |
| 删除实体不同步 (tombstone) | 中 | Pull 时过滤 `deletedAt` 实体，Push 携带 |
| 增量拉取 | 低 | `getChangesSince()` + `sinceRevision` 参数 |
| 无 adapter 时 success:true | 低 | 改为 `{ success: false, reason: 'not_configured' }` |
| Pull 无重试 | 低 | `_pullWithRetry` 3 次退避（2s/4s/8s） |
| banner 不可点击 | 低 | 事件委托 `[data-action="open-sync-tools"]` |
| conflict modal 无 netValue | 低 | `TRADE_FIELDS` 添加 `netValue` |
| 本地版本号混淆 | 低 | 本地卡片显示 `-` |
| 冲突弹窗无 scrollTop 重置 | 低 | `show()` 中重置 |
| 首次弹窗关闭无回调 | 低 | 关闭时调 `onChoice('cancel')` + `_handleFirstSyncChoice` 处理 |
| 尾部斜杠导致空 fundCode | 低 | `.filter()` 空字符串 |
| JSON.stringify 排序依赖 | 低 | `stableStringify` 排序后比较 |
| handleOptions 重复 | 低 | 统一 Origin 反射 + request 参数 |
| payload 1MB 限制 | 低 | `Content-Length` 检查 |
| 遗留 CSS(.sync-status) | 低 | 移除 |

### 修复文档
- `docs/sync-mechanism-analysis.md` — 全量分析（37 BUG、13 P-GAP、18 E、7 SEC、8 UI）
- `docs/sync-mechanism-fix-plan.md` — 两阶段修复方案

### Public API

| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/runtime-config` | GET | 获取运行时配置（sync.enabled 等） |
| `/api/sync/pull` | GET | 拉取云端快照 |
| `/api/sync/push` | POST | 推送本地数据到云端 |
| `/api/sync/resolve` | POST | 解决同步冲突 |

### 调试方法

```javascript
// 查看同步状态
window.LocalStorageAdapter.getSyncMeta()

// 查看适配器状态
window.SyncAdapterRegistry.getCurrentAdapter().getStatus()

// 手动触发同步
await SyncAppService.manualSync()

// 强制推送本地数据（覆盖云端）
await SyncAppService.forcePushLocal()

// 强制拉取云端数据（覆盖本地）
await SyncAppService.forceOverwriteLocal()

// 刷新云端元数据
await SyncAppService.refreshCloudMeta()

// 查看适配器是否携带 syncKey
CloudflareD1SyncAdapter._config.syncKey

// 检查是否有缺失 id 的损坏数据
JSON.parse(localStorage.getItem('fund_calculator_snapshot')).trades.filter(t => !t.id).length
```

---

## 基金数据提供者

### 概述

本应用采用**适配器模式**管理基金数据API，通过 `FundProviderRegistry` 实现数据源的可替换性。默认使用天天基金API（`TiantianFundProvider`），后续可无缝切换至其他数据源。

### 核心组件

| 组件 | 文件位置 | 职责 |
|-----|---------|------|
| `FundProviderRegistry` | `js/fundProviderRegistry.js` | 提供者注册表（注册/切换/获取） |
| `TiantianFundProvider` | `js/providers/tiantianProvider.js` | 天天基金API提供者（JSONP协议） |
| `FundAPI` | `js/fundAPI.js` | 向后兼容层，委托给当前激活的提供者 |

### 架构设计

```
调用方（FundManager / detail.js / modal.js）
          ↓
      FundAPI（兼容层）
          ↓
FundProviderRegistry.getCurrentProvider()
          ↓
  TiantianFundProvider（或其他提供者）
```

### 提供者接口规范

所有基金数据提供者必须实现以下方法：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getFundData(fundCode, useCache)` | `string, boolean` | `Promise<FundData>` | 获取单只基金数据 |
| `batchGetFundData(codes, concurrency)` | `string[], number` | `Promise<FundData[]>` | 批量获取基金数据 |
| `fetchNameOnly(fundCode)` | `string` | `Promise<string>` | 仅获取基金名称 |
| `refreshFundData(fundCode)` | `string` | `Promise<FundData>` | 强制刷新（不使用缓存） |
| `clearCache()` | 无 | `void` | 清空全部缓存 |
| `clearCacheForFund(fundCode)` | `string` | `void` | 清空指定基金缓存 |
| `isConfigured()` | 无 | `boolean` | 是否已配置可用 |

### FundData 数据结构

```javascript
{
  code: string,           // 基金代码
  name: string,           // 基金名称
  netValue: number,       // 最新净值（单位净值）
  netValueDate: string,   // 净值日期（YYYY-MM-DD）
  estimatedValue: number, // 估算净值
  estimatedDate: string,  // 估算时间戳
  estimatedGrowth: number,// 估算涨跌幅（%）
  updateTime: string      // 更新时间（ISO）
}
```

### 配置项

```javascript
// Config.fundProvider
{
  active: 'tiantian',           // 当前激活的提供者
  available: ['tiantian']       // 可用提供者列表
}
```

### 添加新提供者步骤

1. 在 `js/providers/` 下创建新文件，如 `newApiProvider.js`
2. 实现上述接口规范的所有方法
3. 注册到模块系统：`ModuleRegistry.register('NewApiProvider', NewApiProvider)`
4. 注册到注册表：`FundProviderRegistry.registerProvider('newApi', NewApiProvider)`
5. 在 `index.html` 中加载新脚本（放在 `fundProviderRegistry.js` 之后、`fundAPI.js` 之前）
6. 切换提供者：
   ```javascript
   // 方式一：代码切换
   FundProviderRegistry.setCurrentProvider('newApi');

   // 方式二：配置切换
   Config.set('fundProvider.active', 'newApi');
   ```

### 调试方法

```javascript
// 查看当前提供者
FundProviderRegistry.getProviderName()

// 查看已注册的提供者列表
FundProviderRegistry.listProviders()

// 手动切换提供者
FundProviderRegistry.setCurrentProvider('tiantian')

// 清除缓存
FundAPI.clearCache()
FundAPI.clearCacheForFund('005827')
```

---

## 开发规范

### 代码检查
每次修改后必须运行lint检查：
```bash
npm run lint    # 全部检查
npm run lint:fix  # 自动修复
```

### Git提交
- 每次修改后需要提交git记录
- 提交信息应简洁描述修改内容

### 目录约定
```
js/
├── application/    # 用例编排（FundAppService等）
├── repositories/  # 仓储访问
├── storage/       # schema、migration、adapter、sync
├── providers/     # 基金数据提供者（可替换API源）
│   └── tiantianProvider.js   # 天天基金JSONP提供者
├── modal/         # modal相关helper
│   ├── syncFirstSyncHelper.js   # 首次同步三选一对话框
├── detail/        # detail页相关helper
│   ├── accrualHelper.js      # 计提计算UI辅助
│   ├── detailHoldingHelper.js
│   ├── detailTradeActionHelper.js
│   └── ...
└── *.js           # 核心模块

functions/
├── api/runtime-config.js     # 运行时配置
├── api/sync/                 # 内部同步 API（pull/push/resolve）
├── api/public/               # 对外 Public API（funds/trades/help）
└── _shared/                  # Pages Functions 共享模块
```

### 重要约束
- 计算结果（持仓、收益、手续费建议、分组结果）保持运行时生成，不持久化
- 云端同步范围仅限`funds`、`trades`、`syncMeta`
- Public API 当前仅开放 `funds`、`trades` 与 `help`；其中 GET 公开读取，POST `/api/public/trades` 需 `PUBLIC_API_KEY`
- Public API 写入记录时，只允许追加单条 trade，不应绕过现有 snapshot / revision 更新逻辑
- 修改数据模型、存储、application层、detail/modal/overview关键路径或 `functions/api/*` 时，必须补或更新测试
- 同步端点统一使用 `jsonResponse(data, status, request)` 返回（自动反射 Origin）
- 认证统一通过 `checkApiKey(env, request)` 检查 X-API-Key 或 X-Sync-Key
- 服务端输入校验使用 `validateEntities(funds, trades)` 检查必要字段
- D1 乐观锁通过 `UPDATE WHERE revision = ?` + `affectedRows` 实现

---

## 测试规范

### 测试文件命名
`tests/*.test.cjs`

### 运行单个测试
```bash
node --test tests/routerNavigation.test.cjs
```

### 测试框架
使用Node.js内置`node:test`模块（CommonJS格式）

---

## 常见问题

### 禁止在对象方法内部使用`this`
```javascript
// 错误
Method: function() {
  this.doSomething();
}

// 正确
Method: function() {
  ObjectName.doSomething();
}
```

### 金额单位转换
- 买入费率存储单位：元
- UI显示单位：万元（÷10000）
- 匹配规则：`minAmount <= 买入金额 < maxAmount`（左闭右开）

### Utils 工具函数注意事项
- `Utils.formatMoney(amount)` 返回值已包含 `¥` 符号，UI 显示时不应再额外添加
- `Utils.formatNumber(num, decimals)` 返回格式化数字，不包含货币符号

---

## 浮点数比较规范

### 问题背景
JavaScript 浮点数运算存在精度误差，例如 `15947.70 - 15947.70` 结果可能不是精确的 0，而是 `-0.0000001`。因此所有与 0 的直接比较都必须使用容差处理。

### EPSILON 常量
```javascript
Utils.EPSILON = 0.0001
```

### 比较函数

| 函数 | 含义 | 等价于 |
|------|------|--------|
| `Utils.isPositive(v)` | 是否为正数 | `v > 0.0001` |
| `Utils.isNegative(v)` | 是否为负数 | `v < -0.0001` |
| `Utils.isZero(v)` | 是否为零 | `|v| <= 0.0001` |
| `Utils.isNonNegative(v)` | 是否非负 | `v >= -0.0001` |
| `Utils.isNonPositive(v)` | 是否非正 | `v <= 0.0001` |
| `Utils.gt(a, b)` | a > b（带容差） | `a - b > 0.0001` |
| `Utils.lt(a, b)` | a < b（带容差） | `b - a > 0.0001` |
| `Utils.gte(a, b)` | a >= b | `a - b >= -0.0001` |
| `Utils.lte(a, b)` | a <= b | `b - a >= -0.0001` |
| `Utils.isValidPositive(v)` | 有效正数 | `isPositive(v) && isValidNumber(v)` |

### 代码规范

**禁止**：
```javascript
if (shares < 0) { ... }
if (shares <= 0) { ... }
if (shares > 0) { ... }
if (shares >= 0) { ... }
if (currentShares < -CalculatorV2.EPSILON) { ... }
```

**必须使用**：
```javascript
if (Utils.isNegative(shares)) { ... }
if (Utils.isNonPositive(shares)) { ... }
if (Utils.isPositive(shares)) { ... }
if (Utils.isNonNegative(shares)) { ... }
if (Utils.isNegative(currentShares)) { ... }
```

### 已废弃的本地 EPSILON 定义
以下模块曾定义自己的 EPSILON，现已统一使用 `Utils.EPSILON`：
- `CalculatorV2.EPSILON` → 使用 `Utils.EPSILON`
- `FIFOCalculator.EPSILON` → 使用 `Utils.EPSILON`
- `FeeCalculator.EPSILON` → 使用 `Utils.EPSILON`
- `ConversionCalculator.EPSILON` → 使用 `Utils.EPSILON`
- 局部 `const EPSILON = 0.0001` → 使用 `Utils.isPositive()` 等

### ESLint 检测
项目使用 `eslint-plugin-regexp`，启用了 `regexp/no-unused-capturing-group` 规则检测未使用的捕获组。

---

## 最新修改记录（2026-05-26）

### 启动优化 + 批量净值更新 + 去除冗余 DATA_IMPORTED

**1. 启动顺序优化**（`app.js`）
- 所有同步 localStorage 操作（DataService → ThemeManager → Router → Overview → Detail）移至 `hideLoading()` **之前**
- 网络异步操作（RuntimeConfigLoader、SyncAppService）后置到 `hideLoading()` 之后
- 效果：页面立即显示本地数据，无白屏

**2. 批量净值更新**（`fundAppService.js`，`fundManager.js`，`overview.js`）
- 新增 `FundAppService.batchUpdateFunds(fundUpdates)` — 单次 `saveAll()` + 单次 `NET_VALUE_UPDATED` 事件
- `FundManager.refreshAllFunds()` 收集所有 API 响应后统一调用批量接口
- 效果：N 次独立写入+N 次事件 → 1 次写入+1 次事件

**3. 净值变化的 UI 定向更新**（`overview.js`）
- `Overview.refresh(fundIds)` 支持传入部分 fund ID 实现增量渲染
- `NET_VALUE_UPDATED` 事件携带 `{ funds: [...], batch: true }`，overview 提取 fundIds 仅更新受影响的卡片/行
- 效果：批量刷新时不重建整个列表

**4. 去除冗余 DATA_IMPORTED emit**（`importPreviewHelper.js:274,293`）
- `ImportPreviewHelper` 中 2 处手动 `EventBus.emit(DATA_IMPORTED)` 被注释
- `ImportAppService.importData()`（line 106）已负责发射此事件
- 效果：导入流程不再重复触发同步推送

### 年度持仓统计计算逻辑修复

**问题描述**：
原逻辑存在两个关键问题：
1. 跨年度周期数据未按时间分摊，导致收益全部计入周期开始年份
2. 月度统计重复计算跨月周期，导致数据被放大

**修复方案**：

| 函数 | 修改前 | 修改后 |
|------|--------|--------|
| `getMultiYearSummary()` | 按周期开始年份分组 | 按交易时间分摊到对应年份 |
| `getMonthlySummary()` | 整个周期数据计入每个有交易的月份 | 仅按当月实际交易计算 |
| `getYearlySummary()` | 只按周期开始年份判断 | 按今年实际交易计算 |

**核心改进**：
- **买入交易** → 计入买入年份/月份
- **卖出交易** → 计入卖出年份/月份，收益 = 卖出金额 - 成本 - 手续费
- **分红交易** → 计入分红年份/月份
- **持仓市值** → 如果年份在周期范围内则计入

**示例验证**：
```
场景：2023-12 买入 1000元，2024-03 卖出收益 200元

修复前（错误）：
┌──────┬──────┬──────┐
│ 年份 │ 投入 │ 收益 │
├──────┼──────┼──────┤
│ 2023 │ 1000 │ 200  │
│ 2024 │ 0    │ 0    │
└──────┴──────┴──────┘

修复后（正确）：
┌──────┬──────┬──────┐
│ 年份 │ 投入 │ 收益 │
├──────┼──────┼──────┤
│ 2023 │ 1000 │ 0    │
│ 2024 │ 0    │ 200  │
└──────┴──────┴──────┘
```

### 用户体验改进

**1. 本地模式提示条**
- 文件：`js/runtimeConfigLoader.js`
- 功能：检测 `file://` 协议时显示顶部蓝色提示条
- 内容："📁 本地模式 · 数据仅保存在本浏览器 · 刷新页面后数据保留"

**2. 同步状态面板**
- 文件：`js/modal/syncStatusPanelHelper.js`
- 功能：点击同步状态图标弹出详细面板
- 显示：存储模式、同步状态、数据统计、设备信息
- 操作：立即同步、强制上传、强制下载

**3. 页面可见性同步优化**
- 文件：`js/application/syncAppService.js`
- 功能：页面可见时自动拉取更新，每5分钟定时同步

### 新增文件

| 文件 | 说明 |
|------|------|
| `js/errorHandler.js` | 统一错误处理器 |
| `js/modal/syncStatusPanelHelper.js` | 同步状态面板 |
| `tests/runtimeConfigFileProtocol.test.cjs` | file:// 协议测试 |
| `wrangler.toml` | Cloudflare 配置 |
| `.dev.vars` | 本地开发环境变量 |
| `docs/improvement-plan.md` | 改进计划文档 |

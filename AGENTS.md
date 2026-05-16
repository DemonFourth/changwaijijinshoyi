# 场外基金收益计算器 - AGENTS.md

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
TiantianFundProvider
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

服务端和客户端使用**统一的冲突检测逻辑**（以 `lastSyncedAt` 为基准）：

1. **首次同步**（`lastSyncedAt` 为 0 或空）：双方在 30 天内都有修改且数据不同 → 冲突
2. **非首次同步**：双方自上次同步后都有修改且数据不同 → 冲突

```javascript
// 伪代码描述
const lastSyncedTime = localEntity.lastSyncedAt ? new Date(localEntity.lastSyncedAt).getTime() : 0;
const localModifiedAfterSync = lastSyncedTime === 0 || localTime > lastSyncedTime;
const cloudModifiedAfterSync = lastSyncedTime === 0 || cloudTime > lastSyncedTime;

if (localModifiedAfterSync && cloudModifiedAfterSync) {
    if (数据有实质变化) conflicts.push(...);
}
```

### 关键实现细节

#### 同步锁
使用 `_syncInProgress` 标志防止 Pull/Push 并发执行：
```javascript
async _executePull() {
    if (SyncAppService._syncInProgress) {
        return { success: true, reason: 'sync_in_progress' };
    }
    SyncAppService._syncInProgress = true;
    // ... 执行 pull
    SyncAppService._syncInProgress = false;
}
```

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
await SyncAppService.forcePullCloud()
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

# 基金收益计算器分层重构与可迁移存储实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不回退现有功能的前提下，完成数据模型升级、存储抽象、仓储层引入和页面依赖收敛，为后续云端同步与更大规模架构重构打下基础。

**Architecture:** 先建立平台无关的数据模型与 Repository 边界，让 LocalStorage 成为首个基础设施 driver；再把 FundManager / TradeManager / DataService 从“混合职责”收敛为“应用服务 + 仓储 + 纯计算依赖”；最后收口 Overview / Detail 对底层存储的直接依赖，为后续云端 adapter 与更细粒度 UI 拆分铺路。

**Tech Stack:** 原生 JavaScript、LocalStorage、事件总线、自定义模块注册系统、ESLint、stylelint。

---

## 现状与文件边界

### 当前主要问题

- `js/dataService.js` 同时承担缓存、持久化、实体 CRUD、计算缓存、事件派发，职责过多。
- `js/fundManager.js` 混合了 UI 提示、API 获取、实体组装、数据保存、缓存失效处理。
- `js/tradeManager.js` 混合了校验、交易构造、业务合理性检查、存储写入、UI 提示。
- `js/storage.js` 当前以 key/value helper 为主，尚未形成统一的“应用数据快照”概念，也没有统一 schema 迁移入口。
- `js/overview.js` 与 `js/detail.js` 体积过大，直接依赖多个 manager/service，后续很难切换云端数据源。
- 当前数据模型缺少 `schemaVersion / updatedAt / deletedAt / syncId` 这类同步关键字段。

### 第一阶段计划涉及的文件

**Create**
- `js/repositories/fundRepository.js` - 基金仓储统一接口实现（基于当前 adapter）
- `js/repositories/tradeRepository.js` - 交易仓储统一接口实现（基于当前 adapter）
- `js/storage/schema.js` - 数据模型默认结构、schemaVersion、实体标准化函数
- `js/storage/migrations.js` - 从旧 `funds/trades/settings` 数据迁移到新快照结构
- `js/storage/localStorageAdapter.js` - LocalStorage 适配器，负责加载/保存标准快照
- `js/application/fundAppService.js` - 基金用例编排层
- `js/application/tradeAppService.js` - 交易用例编排层
- `docs/superpowers/specs/2026-05-07-architecture-refactor-design.md` - 本轮设计文档（若尚未存在则补写）

**Modify**
- `js/storage.js` - 收敛为兼容层或迁移入口，逐步让位给新 adapter
- `js/dataService.js` - 缩减为计算缓存与只读聚合，移除 CRUD 持久化职责
- `js/fundManager.js` - 由直接调 DataService 改为调 FundAppService
- `js/tradeManager.js` - 由直接调 DataService 改为调 TradeAppService
- `js/overview.js` - 改为通过 manager/app service 获取数据，避免直接感知存储结构变化
- `js/detail.js` - 同上，收敛对旧 DataService 细节的依赖
- `js/app.js` - 初始化新仓储与应用服务
- `index.html` - 按需调整脚本引入顺序
- `js/config.js` - 增加新快照 key 或 schema 配置

**Test / Verify**
- `npm run lint`
- `npm run lint:js`
- `npm run lint:css`
- 手工验证：新增基金、编辑基金、删除基金、添加交易、编辑交易、删除交易、导出数据、导入旧数据、刷新净值、详情页/汇总页展示

---

### Task 1: 固化设计文档与迁移范围

**Files:**
- Create: `docs/superpowers/specs/2026-05-07-architecture-refactor-design.md`
- Modify: `docs/superpowers/plans/2026-05-07-architecture-refactor-plan.md`

- [ ] **Step 1: 写出设计文档初稿**

```md
# 架构重构与可迁移存储设计

## 目标
- 同步云端时仅上传 funds 和 trades
- 本地保留 theme / viewPrefs / API 缓存
- 计算结果运行时生成，不持久化

## 新数据模型
```js
{
  schemaVersion: 1,
  funds: [
    {
      id,
      code,
      name,
      remark,
      feeTiers,
      createdAt,
      updatedAt,
      deletedAt,
      syncId
    }
  ],
  trades: [
    {
      id,
      fundId,
      date,
      type,
      netValue,
      shares,
      amount,
      fee,
      remark,
      dividendMode,
      createdAt,
      updatedAt,
      deletedAt,
      syncId
    }
  ],
  syncMeta: {
    provider,
    deviceId,
    lastSyncAt
  }
}
```

## 分层边界
- ui: Overview / Detail / Modal
- application: FundAppService / TradeAppService
- domain: CalculatorV2 / FIFO / FeeCalculator
- infrastructure: localStorageAdapter / FundAPI / chart / router
```

- [ ] **Step 2: 手工检查设计文档是否覆盖已确认范围**

Run: `检查文档中是否明确写出 funds/trades 才会上云，settings/theme 不上云`
Expected: 文档内明确区分“云端同步字段”和“本地字段”

- [ ] **Step 3: 如 design 文档已存在，则只补齐缺失部分**

```md
## 迁移策略
- 启动时探测旧版 fundsKey / tradesKey
- 转换为统一 snapshot 后写入新 key
- 保留旧 key 一次版本作为回滚参考
```

- [ ] **Step 4: 提交设计文档**

```bash
git add docs/superpowers/specs/2026-05-07-architecture-refactor-design.md docs/superpowers/plans/2026-05-07-architecture-refactor-plan.md
git commit -m "docs: add architecture refactor design and plan"
```

### Task 2: 定义新 schema 与标准化函数

**Files:**
- Create: `js/storage/schema.js`
- Modify: `index.html`
- Test: `npm run lint:js`

- [ ] **Step 1: 先写 schema 模块代码**

```js
const StorageSchema = {
    VERSION: 1,

    createEmptySnapshot() {
        return {
            schemaVersion: StorageSchema.VERSION,
            funds: [],
            trades: [],
            syncMeta: {
                provider: 'local',
                deviceId: '',
                lastSyncAt: null
            }
        };
    },

    createFundEntity(fund) {
        const now = new Date().toISOString();
        return {
            id: fund.id,
            code: fund.code,
            name: fund.name,
            remark: fund.remark || '',
            feeTiers: fund.feeTiers || { buyTiers: [], sellTiers: [] },
            createdAt: fund.createdAt || fund.createTime || now,
            updatedAt: fund.updatedAt || fund.updateTime || now,
            deletedAt: fund.deletedAt || null,
            syncId: fund.syncId || fund.id
        };
    },

    createTradeEntity(trade) {
        const now = new Date().toISOString();
        return {
            id: trade.id,
            fundId: trade.fundId,
            date: trade.date,
            type: trade.type,
            netValue: Number(trade.netValue || 0),
            shares: Number(trade.shares || 0),
            amount: Number(trade.amount || 0),
            fee: Number(trade.fee || 0),
            remark: trade.remark || '',
            dividendMode: trade.dividendMode || null,
            createdAt: trade.createdAt || trade.createTime || now,
            updatedAt: trade.updatedAt || trade.updateTime || now,
            deletedAt: trade.deletedAt || null,
            syncId: trade.syncId || trade.id
        };
    }
};

window.StorageSchema = StorageSchema;
```

- [ ] **Step 2: 在 `index.html` 中把 `schema.js` 插入到依赖链正确位置**

```html
<script src="js/storage/schema.js"></script>
<script src="js/storage/migrations.js"></script>
<script src="js/storage/localStorageAdapter.js"></script>
```

- [ ] **Step 3: 运行 JS lint 验证新模块格式**

Run: `npm run lint:js`
Expected: PASS，无 `no-undef`、缩进或分号错误

- [ ] **Step 4: 提交 schema 模块**

```bash
git add index.html js/storage/schema.js
git commit -m "feat: add storage schema module"
```

### Task 3: 实现旧数据到新快照的迁移器

**Files:**
- Create: `js/storage/migrations.js`
- Modify: `js/config.js`
- Test: `npm run lint:js`

- [ ] **Step 1: 写迁移器，兼容旧 key**

```js
const StorageMigrations = {
    SNAPSHOT_KEY: 'fund_calculator_snapshot',

    migrateLegacyData(rawSnapshot) {
        if (rawSnapshot && rawSnapshot.schemaVersion === StorageSchema.VERSION) {
            return rawSnapshot;
        }

        const fundsKey = Config.get('storage.fundsKey');
        const tradesKey = Config.get('storage.tradesKey');
        const legacyFunds = Storage.load(fundsKey) || [];
        const legacyTrades = Storage.load(tradesKey) || [];
        const snapshot = StorageSchema.createEmptySnapshot();

        snapshot.funds = legacyFunds.map(fund => StorageSchema.createFundEntity(fund));
        snapshot.trades = legacyTrades.map(trade => StorageSchema.createTradeEntity(trade));

        return snapshot;
    }
};

window.StorageMigrations = StorageMigrations;
```

- [ ] **Step 2: 在配置中加入快照 key**

```js
storage: {
    fundsKey: 'fund_calculator_funds',
    tradesKey: 'fund_calculator_trades',
    settingsKey: 'fund_calculator_settings',
    themeKey: 'fund_calculator_theme',
    snapshotKey: 'fund_calculator_snapshot'
}
```

- [ ] **Step 3: 运行 JS lint**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 4: 提交迁移器**

```bash
git add js/config.js js/storage/migrations.js
git commit -m "feat: add storage migration support"
```

### Task 4: 实现 LocalStorageAdapter 统一快照读写

**Files:**
- Create: `js/storage/localStorageAdapter.js`
- Modify: `js/storage.js`
- Test: `npm run lint:js`

- [ ] **Step 1: 写 adapter，接管 snapshot 读写**

```js
const LocalStorageAdapter = {
    loadSnapshot() {
        const snapshotKey = Config.get('storage.snapshotKey');
        const snapshot = Storage.load(snapshotKey);
        const migrated = StorageMigrations.migrateLegacyData(snapshot);

        if (!snapshot || snapshot.schemaVersion !== StorageSchema.VERSION) {
            Storage.save(snapshotKey, migrated);
        }

        return migrated;
    },

    saveSnapshot(snapshot) {
        const snapshotKey = Config.get('storage.snapshotKey');
        return Storage.save(snapshotKey, snapshot);
    },

    loadFunds() {
        return LocalStorageAdapter.loadSnapshot().funds.filter(fund => !fund.deletedAt);
    },

    loadTrades() {
        return LocalStorageAdapter.loadSnapshot().trades.filter(trade => !trade.deletedAt);
    }
};

window.LocalStorageAdapter = LocalStorageAdapter;
```

- [ ] **Step 2: 让 `js/storage.js` 成为兼容层，不再直接拼装业务数组**

```js
loadFunds() {
    return LocalStorageAdapter.loadFunds();
},

loadTrades() {
    return LocalStorageAdapter.loadTrades();
}
```

- [ ] **Step 3: 运行 JS lint**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 4: 提交 adapter**

```bash
git add js/storage.js js/storage/localStorageAdapter.js
git commit -m "feat: add local storage snapshot adapter"
```

### Task 5: 引入 FundRepository 与 TradeRepository

**Files:**
- Create: `js/repositories/fundRepository.js`
- Create: `js/repositories/tradeRepository.js`
- Modify: `index.html`
- Test: `npm run lint:js`

- [ ] **Step 1: 实现 FundRepository**

```js
const FundRepository = {
    getAll() {
        return LocalStorageAdapter.loadSnapshot().funds.filter(fund => !fund.deletedAt);
    },

    getById(fundId) {
        return FundRepository.getAll().find(fund => fund.id === fundId) || null;
    },

    saveAll(funds) {
        const snapshot = LocalStorageAdapter.loadSnapshot();
        snapshot.funds = funds;
        return LocalStorageAdapter.saveSnapshot(snapshot);
    }
};

window.FundRepository = FundRepository;
```

- [ ] **Step 2: 实现 TradeRepository**

```js
const TradeRepository = {
    getAll() {
        return LocalStorageAdapter.loadSnapshot().trades.filter(trade => !trade.deletedAt);
    },

    getByFundId(fundId) {
        return TradeRepository.getAll().filter(trade => trade.fundId === fundId);
    },

    saveAll(trades) {
        const snapshot = LocalStorageAdapter.loadSnapshot();
        snapshot.trades = trades;
        return LocalStorageAdapter.saveSnapshot(snapshot);
    }
};

window.TradeRepository = TradeRepository;
```

- [ ] **Step 3: 在 `index.html` 中注册新仓储脚本**

```html
<script src="js/repositories/fundRepository.js"></script>
<script src="js/repositories/tradeRepository.js"></script>
```

- [ ] **Step 4: 运行 JS lint**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 5: 提交仓储层**

```bash
git add index.html js/repositories/fundRepository.js js/repositories/tradeRepository.js
git commit -m "feat: add fund and trade repositories"
```

### Task 6: 提取基金应用服务，收口 FundManager 持久化职责

**Files:**
- Create: `js/application/fundAppService.js`
- Modify: `js/fundManager.js`
- Modify: `js/dataService.js`
- Modify: `index.html`
- Test: `npm run lint:js`

- [ ] **Step 1: 实现 FundAppService**

```js
const FundAppService = {
    getAllFunds() {
        return FundRepository.getAll();
    },

    getFund(fundId) {
        return FundRepository.getById(fundId);
    },

    createFund(fundData, apiData) {
        const now = new Date().toISOString();
        const fund = StorageSchema.createFundEntity({
            id: Utils.generateId(),
            code: fundData.code,
            name: fundData.name,
            remark: fundData.remark || '',
            feeTiers: fundData.feeTiers,
            createdAt: now,
            updatedAt: now,
            syncId: Utils.generateId()
        });

        const existingFunds = FundRepository.getAll();
        existingFunds.push({
            ...fund,
            netValue: apiData.netValue,
            netValueDate: apiData.netValueDate,
            estimatedValue: apiData.estimatedValue,
            estimatedGrowth: apiData.estimatedGrowth,
            nameSource: fundData.nameSource || 'manual',
            nameUpdateTime: now,
            updateTime: apiData.estimatedDate || now
        });

        return FundRepository.saveAll(existingFunds) ? fund : null;
    }
};

window.FundAppService = FundAppService;
```

- [ ] **Step 2: 将 `FundManager.getAllFunds/getFund/update/delete` 改为调用 FundAppService**

```js
getAllFunds() {
    return FundAppService.getAllFunds();
},

getFund(fundId) {
    return FundAppService.getFund(fundId);
}
```

- [ ] **Step 3: 缩减 `dataService.js`，仅保留计算缓存与读取聚合**

```js
loadFunds() {
    return FundRepository.getAll();
},

getFund(fundId) {
    return FundRepository.getById(fundId);
}
```

- [ ] **Step 4: 在 `index.html` 中引入 `fundAppService.js`**

```html
<script src="js/application/fundAppService.js"></script>
```

- [ ] **Step 5: 运行 JS lint**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 6: 提交基金应用服务**

```bash
git add index.html js/application/fundAppService.js js/fundManager.js js/dataService.js
git commit -m "refactor: route fund operations through app service"
```

### Task 7: 提取交易应用服务，收口 TradeManager 持久化职责

**Files:**
- Create: `js/application/tradeAppService.js`
- Modify: `js/tradeManager.js`
- Modify: `js/dataService.js`
- Modify: `index.html`
- Test: `npm run lint:js`

- [ ] **Step 1: 实现 TradeAppService**

```js
const TradeAppService = {
    getTradesByFund(fundId) {
        return TradeRepository.getByFundId(fundId);
    },

    getTrade(tradeId) {
        return TradeRepository.getAll().find(trade => trade.id === tradeId) || null;
    },

    createTrade(tradeData) {
        const now = new Date().toISOString();
        const trade = StorageSchema.createTradeEntity({
            id: Utils.generateId(),
            fundId: tradeData.fundId,
            date: tradeData.date,
            type: tradeData.type,
            netValue: tradeData.netValue,
            shares: tradeData.shares,
            amount: tradeData.amount,
            fee: tradeData.fee,
            remark: tradeData.remark,
            dividendMode: tradeData.dividendMode,
            createdAt: now,
            updatedAt: now,
            syncId: Utils.generateId()
        });

        const trades = TradeRepository.getAll();
        trades.push(trade);
        return TradeRepository.saveAll(trades) ? trade : null;
    }
};

window.TradeAppService = TradeAppService;
```

- [ ] **Step 2: 将 `TradeManager` 的读写改为调用 `TradeAppService`**

```js
getTradesByFund(fundId) {
    return TradeAppService.getTradesByFund(fundId);
},

getTrade(tradeId) {
    return TradeAppService.getTrade(tradeId);
}
```

- [ ] **Step 3: `dataService.js` 改为通过 `TradeRepository` 读取交易**

```js
loadTrades() {
    return TradeRepository.getAll();
},

getTradesByFund(fundId) {
    return TradeRepository.getByFundId(fundId);
}
```

- [ ] **Step 4: 在 `index.html` 中引入 `tradeAppService.js`**

```html
<script src="js/application/tradeAppService.js"></script>
```

- [ ] **Step 5: 运行 JS lint**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 6: 提交交易应用服务**

```bash
git add index.html js/application/tradeAppService.js js/tradeManager.js js/dataService.js
git commit -m "refactor: route trade operations through app service"
```

### Task 8: 保持页面层无感切换并验证核心流程

**Files:**
- Modify: `js/overview.js`
- Modify: `js/detail.js`
- Modify: `js/app.js`
- Test: `npm run lint`

- [ ] **Step 1: 调整 `app.js` 初始化顺序，保证 adapter / repository / app service 先于页面初始化**

```js
async init() {
    Utils.showLoading();
    DataService.init();
    FundManager.init();
    TradeManager.init();
    ChartManager.init();
    Router.init();
    Overview.init();
    Detail.init();
    ToolPage.init();
    Utils.hideLoading();
}
```

- [ ] **Step 2: 搜索并替换页面中直接依赖旧持久化细节的位置**

```js
const fund = FundManager.getFund(this.currentFundId);
const stats = FundManager.getFundStats(fund.id);
const trades = TradeManager.getTradesByFund(fund.id);
```

- [ ] **Step 3: 运行完整 lint**

Run: `npm run lint`
Expected: PASS，JS 与 CSS 检查全部通过

- [ ] **Step 4: 执行手工回归验证**

Run: `浏览器中依次验证新增基金、编辑备注、设置费率、添加买入、添加卖出、添加分红、删除交易、删除基金、导出数据、导入旧格式数据`
Expected: 页面功能不回退；旧数据首次启动后可自动迁移；导入后统计与详情页可正常计算

- [ ] **Step 5: 提交第一阶段重构**

```bash
git add js/app.js js/overview.js js/detail.js
git commit -m "refactor: preserve ui flows with repository-backed storage"
```

### Task 9: 为下一阶段云端适配预留接口

**Files:**
- Modify: `js/storage/localStorageAdapter.js`
- Modify: `js/repositories/fundRepository.js`
- Modify: `js/repositories/tradeRepository.js`
- Modify: `docs/superpowers/specs/2026-05-07-architecture-refactor-design.md`
- Test: `npm run lint:js`

- [ ] **Step 1: 在 adapter 中补全云端所需的同步元数据读写接口**

```js
getSyncMeta() {
    return LocalStorageAdapter.loadSnapshot().syncMeta;
},

updateSyncMeta(updates) {
    const snapshot = LocalStorageAdapter.loadSnapshot();
    snapshot.syncMeta = { ...snapshot.syncMeta, ...updates };
    return LocalStorageAdapter.saveSnapshot(snapshot);
}
```

- [ ] **Step 2: 在 Repository 层预留 upsert / softDelete 语义**

```js
softDelete(fundId) {
    const funds = FundRepository.getAll().map(fund => fund.id === fundId
        ? { ...fund, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : fund);
    return FundRepository.saveAll(funds);
}
```

- [ ] **Step 3: 更新设计文档中的第二阶段路线**

```md
## 第二阶段
- 引入 CloudSyncAdapter 接口
- 支持 upsert / pull / push / conflict resolution
- 将删除操作统一切换为软删除
```

- [ ] **Step 4: 运行 JS lint**

Run: `npm run lint:js`
Expected: PASS

- [ ] **Step 5: 提交云同步预留接口**

```bash
git add docs/superpowers/specs/2026-05-07-architecture-refactor-design.md js/storage/localStorageAdapter.js js/repositories/fundRepository.js js/repositories/tradeRepository.js
git commit -m "refactor: prepare repository layer for cloud sync"
```

## 自检清单

- 本计划是否覆盖了 schemaVersion、funds、trades、syncMeta：**是**
- 本计划是否明确 theme / viewPrefs / API 缓存不上云：**是**
- 本计划是否要求计算结果不持久化：**是**
- 本计划是否给出了旧数据迁移路径：**是**
- 本计划是否包含 lint 校验：**是**
- 本计划是否存在 TBD / TODO / “稍后实现” 占位：**否**

## 执行前备份建议

1. 先手工备份整个项目目录，尤其是 `js/`、`index.html`、`css/`、`docs/`。  
2. 额外导出一份浏览器当前 LocalStorage 数据，作为迁移前快照。  
3. 备份完成后，再按 Task 2 开始执行代码改造；Task 1 仅涉及文档。  

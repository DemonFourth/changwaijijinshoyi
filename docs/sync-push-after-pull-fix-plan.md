# 拉取后回推问题修复计划（完整版）

> 基于全面代码扫描后补充修正 v3

## 问题描述

首次同步（无痕浏览器）流程：

```
用户打开页面（无痕浏览器）
  → 同步自动拉取云端数据（28 funds, 337 trades）✅ 成功
  → App.refreshAllFunds()  ← 从天天基金API拉取最新净值
    → fundAppService.updateFund(fundId, { netValue, estimatedValue, ... })
      → hasChanged = true（净值数据确实变化了）
        → EventBus.emit(FUND_UPDATED)  → syncAppService 监听器 → notifyBusinessDataChanged('event')
        → fundAppService 直接调用 notifyBusinessDataChanged('event')  ← 重复
  → 28 个基金 × 2 次 = 56 条 pendingChanges
  → SyncAppService.schedulePush()  → 推回云端（数据没变，只是 revision 增长了）
```

**现象**：从云端同步后，数据没有任何结构性变更，但被立即推回云端，云端 revision 无意义增加。

---

## 现行代码完整分析

### 事件发射总表

| 操作 | 发射的事件 | 应触发同步？ |
|------|-----------|:----------:|
| `addFund()` | `FUND_ADDED` + `FUND_UPDATED` | ✅ |
| `updateFund()` - 用户编辑 | `FUND_UPDATED` | ✅ |
| `updateFund()` - 净值刷新 | `FUND_UPDATED` | ❌ 净值不需同步 |
| `deleteFund()` | `FUND_DELETED` + `TRADE_UPDATED` | ✅ |
| `addTrade()` | `TRADE_ADDED` + `TRADE_UPDATED` | ✅ |
| `updateTrade()` | `TRADE_UPDATED` | ✅ |
| `deleteTrade()` | `TRADE_DELETED` | ✅ |
| `deleteTradesByFund()` | `TRADE_UPDATED` | ✅ |
| `importData()` | `DATA_IMPORTED` | ✅（直接调用） |
| `clearAll()` | `DATA_CLEARED` | ✅（直接调用） |

### syncAppService 事件监听器（lines 174-180）

```javascript
EventBus.on(EventType.FUND_ADDED, () => SyncAppService._onDataChanged());     // line 174
EventBus.on(EventType.FUND_UPDATED, () => SyncAppService._onDataChanged());   // line 175
EventBus.on(EventType.FUND_DELETED, () => SyncAppService._onDataChanged());   // line 176
// line 177 空白
EventBus.on(EventType.TRADE_ADDED, () => SyncAppService._onDataChanged());    // line 178
EventBus.on(EventType.TRADE_UPDATED, () => SyncAppService._onDataChanged());  // line 179
EventBus.on(EventType.TRADE_DELETED, () => SyncAppService._onDataChanged());  // line 180
```

**未监听的 DATA 类型事件**：`DATA_IMPORTED`、`DATA_CLEARED` — sync 完全不监听。

### 三重推送调用链详解

```
addFund() 中的三重推送:
  1. EventBus.emit(FUND_ADDED)    → sync:174  → _onDataChanged() → notifyBusinessDataChanged('event')
  2. EventBus.emit(FUND_UPDATED)  → sync:175  → _onDataChanged() → notifyBusinessDataChanged('event')
  3. fundAppService:23: notifyBusinessDataChanged('event')                        ← 直接调用

addTrade() 中的三重推送:
  1. EventBus.emit(TRADE_ADDED)   → sync:178  → notifyBusinessDataChanged('event')
  2. EventBus.emit(TRADE_UPDATED) → sync:179  → notifyBusinessDataChanged('event')
  3. tradeAppService:28: notifyBusinessDataChanged('event')                       ← 直接调用

deleteFund() 中的三重推送:
  1. EventBus.emit(FUND_DELETED)  → sync:176  → notifyBusinessDataChanged('event')
  2. EventBus.emit(TRADE_UPDATED) → sync:179  → notifyBusinessDataChanged('event')
  3. fundAppService:99: notifyBusinessDataChanged('event')                        ← 直接调用

importData() 中的双重推送:
  1. EventBus.emit(DATA_IMPORTED) → sync 不监听此事件
  2. importAppService:108: notifyBusinessDataChanged('import')                   ← 直接调用

clearAll() 中的双重推送:
  1. EventBus.emit(DATA_CLEARED) → sync 不监听此事件
  2. importAppService:145: notifyBusinessDataChanged('clear')                    ← 直接调用
```

### _getPushDelay() 延迟语义

```javascript
// syncAppService.js
const delayMap = {
    import: 0,          // 导入：立即推送
    clear: 0,           // 清空：立即推送
    'batch-delete': 1000,  // 批量删除：1 秒延迟
    'batch-resume': 0,
    event: 2000,        // 普通事件：2 秒延迟
    unknown: 5000
};
```

| source | 当前延迟 | 移除直接调用后 | 变化 |
|--------|:-------:|:---------------:|:----:|
| `import` | 0s | 通过 `DATA_IMPORTED` 监听器 → `'event'` → 2s | 变慢 |
| `clear` | 0s | 通过 `DATA_CLEARED` 监听器 → `'event'` → 2s | 变慢 |
| `batch-delete` | 1s | 通过 `TRADE_UPDATED` 监听器 → `'event'` → 2s | 变慢 |

---

## 已有的保护机制

### _sanitizeFundsForSync 已存在（line 13-35）

```javascript
_sanitizeFundsForSync(fund) {
    const { netValue, estimatedValue, ...rest } = fund;
    return rest;
}
```

推送前会剥离净值字段，即使净值触发同步推送，云端也不会收到净值数据。**问题不在于数据污染，而在于不必要的推送消耗了 revision 和 pendingChanges。**

### CALCULATION_UPDATED 不触发同步

`CALCULATION_UPDATED` 只被 `StatisticsAppService` 和 `detail.js` 监听，sync 不监听。这是正确的设计 — 计算更新是运行时内存操作，不应触发同步。

---

## 修复方案

### 修复 1：区分结构字段与瞬态字段 + 新增 NET_VALUE_UPDATED 事件

在 `fundAppService.updateFund()` 中，将 `hasChanged` 拆分为两个判断：

```javascript
// 不需要同步到云端的字段（净值等 API 实时数据）
const TRANSIENT_FIELDS = new Set([
    'netValue', 'netValueDate',
    'estimatedValue', 'estimatedGrowth', 'estimatedDate',
    'nameSource', 'nameUpdateTime'
]);

// 元数据键（不计入任何变更判断）
const META_KEYS = new Set([
    'updatedAt', 'updateTime', 'lastSyncedAt', 'createdAt', 'deletedAt'
]);

// 是否有净值类变更（瞬态字段变化）
const hasNetValueChange = Object.keys(updates).some(key =>
    TRANSIENT_FIELDS.has(key) && JSON.stringify(existing[key]) !== JSON.stringify(updates[key])
);

// 是否有结构性变更（业务字段变化）
const hasStructuralChange = Object.keys(updates).some(key =>
    !META_KEYS.has(key) && !TRANSIENT_FIELDS.has(key) &&
    JSON.stringify(existing[key]) !== JSON.stringify(updates[key])
);
```

**关键**：净值刷新时，`FUND_UPDATED` 事件**不再发射**，改为发射独立的 `NET_VALUE_UPDATED` 事件。sync 监听器不监听 `NET_VALUE_UPDATED`，从而彻底切断净值刷新的同步链路：

| 场景 | hasNetValueChange | hasStructuralChange | FUND_UPDATED | NET_VALUE_UPDATED | 触发同步 |
|------|:-----------------:|:-------------------:|:------------:|:-----------------:|:-------:|
| 用户编辑 name/code | false | true | ✅ | ❌ | ✅ |
| 净值刷新 | true | false | **❌** | **✅** | ❌ |
| 两者同时变 | true | true | ✅ | ❌ | ✅ |
| 无变化 | false | false | ❌ | ❌ | ❌ |

UI 刷新方面：新建 `NET_VALUE_UPDATED` 事件，由 `overview.js`、`detail.js`、`fundManager.js` 监听（替代原有的 `FUND_UPDATED` 监听），确保净值变化仍能触发页面重渲染和缓存清除。

### 修复 2：消除重复推送 — 移除直接调用

移除 `fundAppService`、`tradeAppService` 和 `importAppService` 中所有直接调用 `notifyBusinessDataChanged('event')` 的代码：

| 文件 | 方法 | 行 | 直接调用 | 移除后果 |
|-----|------|-----|---------|---------|
| `fundAppService.js` | `addFund()` | 22-24 | `notifyBusinessDataChanged('event')` | 通过 `FUND_ADDED`/`FUND_UPDATED` 监听器触发（但仍 2 次） |
| `fundAppService.js` | `updateFund()` | 60-62 | `notifyBusinessDataChanged('event')` | 通过 `FUND_UPDATED` 监听器触发（1 次） |
| `fundAppService.js` | `deleteFund()` | 98-100 | `notifyBusinessDataChanged('event')` | 通过 `FUND_DELETED`/`TRADE_UPDATED` 监听器触发（但仍 2 次） |
| `tradeAppService.js` | `addTrade()` | 27-29 | `notifyBusinessDataChanged('event')` | 通过 `TRADE_ADDED`/`TRADE_UPDATED` 监听器触发（但仍 2 次） |
| `tradeAppService.js` | `updateTrade()` | 58-60 | `notifyBusinessDataChanged('event')` | 通过 `TRADE_UPDATED` 监听器触发（1 次） |
| `tradeAppService.js` | `deleteTrade()` | 75-77 | `notifyBusinessDataChanged('event')` | 通过 `TRADE_DELETED` 监听器触发（1 次） |
| `tradeAppService.js` | `deleteTradesByFund()` | 108-110 | `notifyBusinessDataChanged('batch-delete')` | 通过 `TRADE_UPDATED` 监听器触发（1 次） |
| `importAppService.js` | `importData()` | 107-109 | `notifyBusinessDataChanged('import')` | **同步失效** — sync 不监听 `DATA_IMPORTED` |
| `importAppService.js` | `clearAll()` | 144-146 | `notifyBusinessDataChanged('clear')` | **同步失效** — sync 不监听 `DATA_CLEARED` |

**结论**：仅移除直接调用不足以消除双重推送，且会破坏 `importData()` 和 `clearAll()` 的同步。需要配合修复 3。

### 修复 3：_onDataChanged(source) 参数化去重 + ImportAppService 事件监听

#### 3a. _onDataChanged(source) 参数化

将 `_onDataChanged` 改为接收 `source` 参数，保留原有延迟语义：

```javascript
_dataChangePending: false,

_onDataChanged(source = 'event') {
    if (SyncAppService._dataChangePending) return;
    SyncAppService._dataChangePending = true;
    setTimeout(() => {
        SyncAppService._dataChangePending = false;
        SyncAppService.notifyBusinessDataChanged(source);
    }, 0);
}
```

#### 3b. 监听器携带语义参数

```javascript
EventBus.on(EventType.FUND_ADDED, () => SyncAppService._onDataChanged('event'));
EventBus.on(EventType.FUND_UPDATED, () => SyncAppService._onDataChanged('event'));
EventBus.on(EventType.FUND_DELETED, () => SyncAppService._onDataChanged('event'));
EventBus.on(EventType.TRADE_ADDED, () => SyncAppService._onDataChanged('event'));
EventBus.on(EventType.TRADE_UPDATED, (data) => {
    const isBatchDelete = data?.reason === 'batch-delete';
    SyncAppService._onDataChanged(isBatchDelete ? 'batch-delete' : 'event');
});
EventBus.on(EventType.TRADE_DELETED, () => SyncAppService._onDataChanged('event'));
EventBus.on(EventType.DATA_IMPORTED, () => SyncAppService._onDataChanged('import'));
EventBus.on(EventType.DATA_CLEARED, () => SyncAppService._onDataChanged('clear'));
```

这样所有 source 语义完全保留：`import` → 0s、`clear` → 0s、`batch-delete` → 1s、`event` → 2s。

#### 3c. 新增 NET_VALUE_UPDATED 事件类型

在 `eventBus.js` 中新增事件常量：

```javascript
NET_VALUE_UPDATED: 'fund:net-value-updated',
```

在 `_setupEventListeners()` 中**不监听**此事件（不在监听列表中），确保净值变化不触发同步。

---

## 修改范围汇总

| # | 文件 | 修改内容 |
|:-:|------|---------|
| 1 | `js/eventBus.js` | 新增 `EventType.NET_VALUE_UPDATED` 常量 |
| 2 | `js/application/fundAppService.js` | `updateFund()` 拆分 `TRANSIENT_FIELDS`/`META_KEYS`；净值变化发射 `NET_VALUE_UPDATED` 而非 `FUND_UPDATED`；移除 `addFund()`/`deleteFund()`/`updateFund()` 中的直接 `notifyBusinessDataChanged` 调用 |
| 3 | `js/application/tradeAppService.js` | 移除所有方法中的直接 `notifyBusinessDataChanged` 调用 |
| 4 | `js/application/importAppService.js` | 移除 `importData()`/`clearAll()` 中的直接 `notifyBusinessDataChanged` 调用 |
| 5 | `js/application/syncAppService.js` | `_onDataChanged(source)` 参数化 + `_dataChangePending` 去重；监听器传递语义参数；添加 `DATA_IMPORTED`/`DATA_CLEARED` 监听器 |
| 6 | `js/overview.js` | 将 `FUND_UPDATED` 监听替换为 `NET_VALUE_UPDATED` 用于 UI 刷新 |
| 7 | `js/detail.js` | 将 `FUND_UPDATED` 监听替换为 `NET_VALUE_UPDATED` 用于 UI 刷新 |
| 8 | `js/fundManager.js` | 将 `FUND_UPDATED` 监听替换为 `NET_VALUE_UPDATED` 用于缓存清除 |

---

## 推送次数预期对比

| 操作 | 当前 | 修复后 |
|------|:----:|:------:|
| 编辑基金名称 | 2 次 | 1 次（事件→去重） |
| 新增基金 | 3 次 | 1 次（双事件→去重） |
| 净值刷新（28 只） | 56 次 | **0 次**（`NET_VALUE_UPDATED` 不触发同步） |
| 删除基金 | 3 次 | 1 次（双事件→去重） |
| 新增交易 | 3 次 | 1 次（双事件→去重） |
| 编辑交易 | 2 次 | 1 次（事件→去重） |
| 删除交易 | 2 次 | 1 次 |
| 批量删除交易 | 1 次 | 1 次（`batch-delete` 语义保留） |
| 导入数据 | 2 次（直接调用） | 1 次（`import` 语义保留，0s 延迟） |
| 清空数据 | 2 次（直接调用） | 1 次（`clear` 语义保留，0s 延迟） |

---

## 影响范围

| 维度 | 说明 |
|------|------|
| 同步推送 | 净值更新不再触发推送，pendingChanges 不再因 API 刷新而堆积 |
| UI 刷新 | 不变 — 净值/估值变化通过 `NET_VALUE_UPDATED` 事件触发 overview/detail 重渲染 |
| 统计缓存 | 不变 — `fundManager.js` 通过 `NET_VALUE_UPDATED` 事件清除缓存 |
| 用户编辑 | 不变 — name/code/remark/feeTiers 等变更仍会触发同步推送（去重后 1 次） |
| 新增/删除基金 | 不变 — 仍触发同步推送（去重后精确 1 次） |
| 交易记录变更 | 不变 — 仍触发同步推送（去重后精确 1 次） |
| 导入/清空 | 不变 — 仍触发同步推送（语义完全保留） |
| 延迟语义 | 全部保留 — `import`/`clear`/`batch-delete` 的推送延迟行为不变 |

---

## 验证测试

修复完成后需要在浏览器中验证：

1. **打开 DevTools Console**，过滤 `[Sync]` 日志
2. **首次同步测试**：
   - 打开无痕浏览器窗口
   - 同步拉取云端数据
   - 观察是否有 `pendingChanges` 被触发
   - 期望：拉取后没有 pendingChanges 增加
3. **用户操作测试**：
   - 编辑基金名称 → 1 次 `notifyBusinessDataChanged`（非 2 次）
   - 新增基金 → 1 次（非 3 次）
   - 新增交易 → 1 次（非 3 次）
   - 编辑交易 → 1 次（非 2 次）
   - 删除基金 → 1 次（非 3 次）
4. **净值刷新测试**：
   - 等待定时刷新或手动触发 `refreshAllFunds()`
   - 观察 `pendingChanges` 不应增加
   - 观察 overview 页面净值是否正常更新
5. **导入/清空测试**：
   - 导入数据 → 应有 1 次同步，0s 延迟
   - 清空数据 → 应有 1 次同步，0s 延迟
6. **回归测试**：
   - 总览页净值显示正常更新
   - 详情页净值显示正常更新
   - 同步推送后云端数据无异常
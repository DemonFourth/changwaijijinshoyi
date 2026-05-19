# 场外基金收益计算器 — 同步机制修复方案（剩余未修复项）

**基准文档：** `sync-mechanism-analysis.md`
**生成日期：** 2026-05-19
**修复阶段：** 第二阶段（未修复项全部覆盖）

---

## 修复完成度总览

| 级别 | 总计 | 已修复（第一阶段） | 待修复（本计划） |
|------|------|-------------------|-----------------|
| P0（阻塞性） | 9 项 | **9** (100%) | 0 |
| P1（功能性） | 17 项 | **14** (82%) | **3** |
| P2（体验/健壮性） | 15 项 | **2** (13%) | **13** |
| **合计** | **41 项** | **25** (61%) | **16** (39%) |

---

## 待修复项完整清单

### P1 级别（3 项）

| ID | 位置 | 描述 | 影响 |
|----|------|------|------|
| BUG-31 | `syncUtils.js:77-78` + `syncAppService.js:516-520` | **lastSyncedAt=0 总触发"双方修改"**：从未同步实体 lastSyncedTime=0 → `localModifiedAfterSync=cloudModifiedAfterSync=true` → 每个实体都被标记冲突 | 大量假冲突 |
| BUG-16 | `public/trades.js:117-131` | **Public API POST 不记录 changelog 且不设 lastSyncedAt** | 审计缺失、首次同步假冲突 |
| E-09 | `push.js` + `syncAppService.js` | **无删除同步（tombstone）**：实体删除不传播到云端 | 数据不一致 |

### P2 级别（13 项）

| ID | 位置 | 描述 | 影响 |
|----|------|------|------|
| P-GAP-01 | `pull.js` + `syncRepository.js` | **无增量拉取**：每次全量拉取 | 带宽浪费 |
| P-GAP-07 | `push.js` | **无 payload 限制**：大请求可压垮 D1 | 稳定性 |
| P-GAP-19 | `push.js`, `resolve.js` | **POST 无幂等性**：重复推送导致重复数据 | 数据一致性 |
| P-GAP-30 | `syncAppService.js:401` | **无 adapter 时返回 success:true**：误导调用方认为推送成功 | 逻辑错误 |
| E-12 | `syncAppService.js` | **拉取无重试机制**：推送有 3 次退避重试，拉取无 | 可用性 |
| BUG-12 | `syncStatusPresenter.js:147` | **同步工具"本地"卡片显示云端版本号** | UI 混淆 |
| BUG-18 | `modal.js:126-135` | **showSyncConflict 死代码回退路径**：退到不存在的 `'syncConflict'` | 死代码 |
| BUG-19 | `syncConflictModalHelper.js` | **冲突弹窗无 scrollTop 重置**：多次打开后滚动位置错乱 | 用户体验 |
| BUG-20 | `syncFirstSyncHelper.js:86-88` | **首次同步弹窗关闭按钮不触发回调**：sync 悬停 | 状态滞留 |
| BUG-21 | `syncUtils.js:22` | **JSON.stringify 深比较依赖 key 顺序**：可能假冲突 | 稳定性 |
| BUG-22 | `public/trades.js:177-178` | **服务端 EPSILON 与客户端重复定义** | 代码冗余 |
| BUG-23 | `public/funds/[code].js:29` | **URL 尾部斜杠提取空字符串**：fundCode 为空 | 404 |
| BUG-24 | `authMiddleware.js` + `syncUtils.js` | **handleOptions 重复定义，CORS 头不一致** | 维护负担 |
| BUG-25 | `d1Schema.js:81-83` | **ensureTables 静默吞异常** | 问题难以排查 |
| BUG-27 | `syncAppService.js:98-108` | **visibilitychange 注释与行为不一致** | 可维护性 |
| BUG-34 | `syncAppService.js:401` | **success:true 误导**（同 P-GAP-30） | 逻辑错误 |
| UI-07 | `style.css:4432-4460` | **遗留的 `.sync-status` CSS 类与 `.sync-indicator` 并存** | 样式冗余 |

---

## 修复方案（4 批次，14 次提交）

### 批次 G — 数据完整性（3 次提交）

#### G1: fix(conflict): lastSyncedAt=0 不触发假冲突

**关联：** BUG-31, P-GAP-33

**问题：** `lastSyncedTime === 0` 时 `localModifiedAfterSync` 和 `cloudModifiedAfterSync` 均为 `true`，导致从未同步的实体每次都被标记为冲突。

**修复方案：** 区分"从未同步"和"同步后本地修改"两种状态。当 `lastSyncedTime === 0` 时：

- 检查对方的 `lastSyncedAt`：如果对方也为 null/未定义，视为**双方均无变更**，跳过冲突检测（保留本地）
- 只有一方有 `lastSyncedAt`：有的一方视为有变更
- 30 天首次同步阈值保持不变（作为兜底）

**修改文件：**

| 文件 | 行号 | 修改内容 |
|------|------|----------|
| `functions/_shared/syncUtils.js` | 75-78 | `lastSyncedTime === 0` 分支逻辑改为对比双方 `lastSyncedAt` 状态 |
| `js/application/syncAppService.js` | 516-520 | 同上逻辑同步到客户端 `_mergeEntities` |
| `js/application/syncAppService.js` | 525-529 | `_isEntityDataChanged` 已经排除动态字段，与 G1 配合彻底消除假冲突 |

**关键代码变更（server `detectConflicts`）：**

```javascript
// 当前（有 bug）:
const localModifiedAfterSync = lastSyncedTime === 0 || localTime > lastSyncedTime;
const cloudModifiedAfterSync = lastSyncedTime === 0 || cloudTime > lastSyncedTime;

// 修复后:
const cloudLastSyncedTime = cloudEntity.lastSyncedAt ? new Date(cloudEntity.lastSyncedAt).getTime() : 0;
const localModifiedAfterSync = localTime > lastSyncedTime;
const cloudModifiedAfterSync = cloudTime > cloudLastSyncedTime;
// 首次同步（双方都无 lastSyncedAt）：仅在 30 天阈值内且有实际数据差异时触发冲突
```

**测试：** `tests/lastSyncedAtConflict.test.cjs`

---

#### G2: feat(sync): 传播 deletedAt 墓碑

**关联：** E-09

**问题：** 实体删除后 `deletedAt` 被标记但不同步到云端，云端保留已删除的实体。

**修复方案：**

1. **Push**：`_sanitizeFundsForSync` 不再过滤 `deletedAt` 非空的实体；push 携带所有实体（包括已删除的）
2. **服务端 push**：接收实体时，如果 `deletedAt` 非空，从当前快照中移除对应实体
3. **Pull**：客户端 pull 到带 `deletedAt` 的实体时，从本地移除

**修改文件：**

| 文件 | 行号 | 修改内容 |
|------|------|----------|
| `js/application/syncAppService.js` | 18-28 | `_sanitizeFundsForSync` 不再跳过 deletedAt 非空的实体 |
| `functions/api/sync/push.js` | 63-76 | 合并时对 deletedAt 非空的云端实体执行 `filter()` 移除 |
| `js/application/syncAppService.js` | `_mergeData` | pull 合并时对 deletedAt 非空的实体从结果中过滤掉 |

---

#### G3: feat(sync): 增量拉取

**关联：** P-GAP-01

**问题：** pull 每次返回全量数据（funds + trades），即使是增量变更。

**修复方案：**

1. Pull 端点支持 `sinceRevision` 查询参数
2. 服务端返回 `sinceRevision` 之后的变更（基于 `change_log` 表或 snapshot revision 对比）
3. 客户端 pull 成功后记录 `cloudRevision`，下次 pull 带上

**修改文件：**

| 文件 | 修改内容 |
|------|----------|
| `functions/api/sync/pull.js` | 添加 `sinceRevision` 参数解析 |
| `functions/_shared/syncRepository.js` | 新增 `getChangesSince(revision)` 方法，返回增量变更 |
| `js/storage/cloudflareD1SyncAdapter.js` | pull 请求带上 `sinceRevision` |
| `js/application/syncAppService.js` | _executePull 成功后记录 cloudRevision，下次使用 |

**注意：** 这是减量优化，首次仍全量。`change_log` 表已经存在于 schema 中，但可能为空。如果 changelog 中无数据则回退到全量。

---

### 批次 H — 正确性修复（3 次提交）

#### H1: fix(public-api): POST trade 写 changelog + lastSyncedAt

**关联：** BUG-16, E-07

**问题：** `POST /api/public/trades` 创建 trade 时：① 不设置 `lastSyncedAt` ② 不写 `change_log`

**修改文件：**

| 文件 | 行号 | 修改内容 |
|------|------|----------|
| `functions/api/public/trades.js` | 128 | `newTrade` 加入 `lastSyncedAt: now` |
| `functions/api/public/trades.js` | 134 | 调用 `appendChangeLogs` 记录 changelog（或直接在 push 后写） |

**关键代码变更：**

```javascript
// newTrade 新增字段:
lastSyncedAt: now

// 写入后追加 changelog:
await appendChangeLogs(env, updateResult.revision, [newTrade], 'trade', 'upsert', 'default');
```

---

#### H2: fix(d1): ensureTables 不静默吞异常

**关联：** BUG-25

**问题：** `ensureTables` 捕获所有异常但仅 `console.error`，调用者无法感知表创建失败。

**修改文件：**

| 文件 | 行号 | 修改内容 |
|------|------|----------|
| `functions/_shared/d1Schema.js` | 81-83 | `catch` 块改为收集错误信息并重新抛出，或返回明确状态 |

**关键代码变更：**

```javascript
// 修复后:
} catch (error) {
    console.error('[D1Schema] table creation failed:', error.stack || error.message);
    throw error; // 让调用者处理
}
```

---

#### H3: fix(sync): 无 adapter 时返回 success:false

**关联：** BUG-34, P-GAP-30

**问题：** `_executePush` 和 `_executePull` 在无可用 adapter 时返回 `{ success: true, reason: 'not_configured' }`，误导调用方。

**修改文件：**

| 文件 | 行号 | 修改内容 |
|------|------|----------|
| `js/application/syncAppService.js` | 401 | `{ success: true, ... }` → `{ success: false, ... }` |
| `js/application/syncAppService.js` | 245-248 | pull 中对应位置同样修复 |
| `js/storage/cloudflareD1SyncAdapter.js` | 85-86 | catch 块返回 `{ success: false, reason: error.message }`（确保一致） |

---

### 批次 I — UI/UX 修复（8 次提交）

#### I1: fix(ui): 本地卡片版本号显示 N/A

**关联：** BUG-12, UI-01

**文件：** `js/syncStatusPresenter.js:147`

**修改：** 本地卡片的版本号改为 `-`（不适用），因为本地没有独立的 revision 号。

```javascript
// 修改前:
<span class="sync-tools-stat-value">${cloudRevision}</span>
<span class="sync-tools-stat-label">版本</span>

// 修改后:
<span class="sync-tools-stat-value">-</span>
<span class="sync-tools-stat-label">版本</span>
```

---

#### I2: fix(ui): 移除 showSyncConflict 死代码

**关联：** BUG-18, UI-04

**文件：** `js/modal.js:126-135`

**修改：** 移除 `Modal.show('syncConflict', syncResult)` 死代码分支。`SyncConflictModalHelper` 不可用时 `showSyncConflict` 直接 `console.error`。

```javascript
showSyncConflict(syncResult) {
    if (window.SyncConflictModalHelper && typeof window.SyncConflictModalHelper.show === 'function') {
        window.SyncConflictModalHelper.show(syncResult.conflicts || [], async (resolutions) => {
            await window.SyncAppService.resolveConflicts(syncResult.conflicts || [], resolutions);
        });
        return;
    }
    console.error('[Sync] SyncConflictModalHelper not available, cannot show conflict dialog');
}
```

---

#### I3: fix(ui): 冲突弹窗 scrollTop 重置

**关联：** BUG-19, UI-05

**文件：** `js/modal/syncConflictModalHelper.js:34`

**修改：** `show()` 中添加滚动重置：

```javascript
show: function (conflicts, onResolve) {
    const container = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    // 重置滚动位置
    if (body) body.scrollTop = 0;
    if (container) container.scrollTop = 0;
    // ...
```

---

#### I4: fix(ui): 首次同步弹窗关闭按钮绑定回调

**关联：** BUG-20, UI-06

**文件：** `js/modal/syncFirstSyncHelper.js`

**问题：** 关闭按钮（`.modal-close`）只调用 `window.Modal.hide()`，不触发 `onCancel` 回调，导致 sync 状态悬停。

**修改：** 在 `_initBindings`（或 `show`）中绑定关闭按钮事件，调用 `onCancel`。

```javascript
// 在绑定函数中增加:
var btnClose = document.querySelector('.modal-close');
if (btnClose) {
    SyncFirstSyncHelper._closeHandler = function () {
        if (typeof options.onCancel === 'function') {
            options.onCancel();
        }
        window.Modal.hide();
    };
    btnClose.addEventListener('click', SyncFirstSyncHelper._closeHandler);
}
```

---

#### I5: fix(ui): trailing slash 防御

**关联：** BUG-23

**文件：** `functions/api/public/funds/[code].js:29`

**修改：** 过滤路径中的空字符串：

```javascript
var pathParts = url.pathname.split('/').filter(function (p) { return p; });
var fundCode = pathParts[pathParts.length - 1];
```

---

#### I6: fix(ui): visibilitychange 注释修正

**关联：** BUG-27

**文件：** `js/application/syncAppService.js:98-108`

**修改：** 修正注释使其与实际逻辑一致——当页面**切换到后台**（hidden）时触发推送：

```javascript
document.addEventListener('visibilitychange', function () {
    // 页面切换到后台时触发推送
    if (!document.hidden) {
        return;
    }
    // ...
});
```

---

#### I7: fix(ui): 移除遗留 CSS 类

**关联：** UI-07

**文件：** `css/style.css`（`.sync-status` 相关样式）

**操作：** 查找并移除 `.sync-status` 相关 CSS 规则（与当前使用的 `.sync-indicator` 重复）。

---

#### I8: fix(conflict): JSON.stringify 排序后比较

**关联：** BUG-21

**文件：** `functions/_shared/syncUtils.js:22`

**问题：** `JSON.stringify(local[key])` 对于对象值，key 顺序不同会导致误判差异。

**修改：** 对对象值进行排序后再序列化比较：

```javascript
function stableStringify(obj) {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    if (Array.isArray(obj)) return JSON.stringify(obj.map(stableStringify));
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) {
        return JSON.stringify(k) + ':' + stableStringify(obj[k]);
    }).join(',') + '}';
}

// 在 isDataChanged 中使用:
if (stableStringify(local[key]) !== stableStringify(cloud[key])) return true;
```

---

### 批次 J — 服务端增强（2 次提交）

#### J1: fix(server): handleOptions 去重

**关联：** BUG-24

**文件：** `functions/_shared/authMiddleware.js:134-142`

**修改：** 移除 `authMiddleware.js` 中的 `handleOptions` 导出，所有端点的 CORS 预检统一使用 `syncUtils.js` 的版本。更新 `authMiddleware.js` 的 `unauthorizedResponse`、`badRequestResponse` 等方法的 CORS 头与 syncUtils 保持一致。

---

#### J2: fix(server): 移除冗余 EPSILON

**关联：** BUG-22

**文件：** `functions/api/public/trades.js:177-178`

**修改：** 删除局部定义的 `const EPSILON`，改为引用导入或内联：

```javascript
// 删除行:
const EPSILON = 0.0001;

// 使用处直接内联:
if (Math.abs(fee - calculatedFee) > 0.0001) {
```

---

#### J3: fix(server): payload 大小限制

**关联：** P-GAP-07

**文件：** `functions/api/sync/push.js`

**修改：** 在处理 body 前检查 `Content-Length`：

```javascript
const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
if (contentLength > 1024 * 1024) { // 1MB 上限
    return jsonResponse({
        success: false,
        error: 'payload_too_large',
        message: 'Request body exceeds 1MB limit'
    }, 413, request);
}
```

---

### 批次 K — 健壮性增强（1 次提交）

#### K1: feat(sync): pull 重试 + idempotency

**关联：** E-12, P-GAP-19

**文件：** `js/application/syncAppService.js`

**修改：** `_executePull` 添加退避重试：

```javascript
async _executePull() {
    // ... 前置检查 ...
    SyncAppService._syncInProgress = true;
    try {
        const result = await SyncAppService._pullWithRetry(adapter);
        // ... 处理结果 ...
    } finally {
        SyncAppService._syncInProgress = false;
    }
},

async _pullWithRetry(adapter, attempt = 1) {
    try {
        return await adapter.pull();
    } catch (error) {
        if (attempt >= 3) throw error;
        await new Promise(r => setTimeout(r, 2000 * attempt));
        return SyncAppService._pullWithRetry(adapter, attempt + 1);
    }
}
```

---

### 批次 L — 测试补充（1 次提交）

| # | 测试文件 | 覆盖范围 | 测试场景数量 |
|---|---------|---------|-------------|
| L1 | `tests/lastSyncedAtConflict.test.cjs` | BUG-31 修复：lastSyncedAt=0 不触发假冲突；双方均有 lastSyncedAt 时正常检测冲突；30 天阈值边界 | 4 |
| L2 | `tests/tombstoneSync.test.cjs` | E-09 修复：deletedAt 实体 push 到云端 + 云端 pull 回本地时移除 | 3 |
| L3 | `tests/incrementalPull.test.cjs` | P-GAP-01 修复：sinceRevision 参数传递 + 增量返回 vs 全量返回 | 2 |
| L4 | `tests/publicApiTradeChangelog.test.cjs` | BUG-16 修复：POST 创建 trade 含 lastSyncedAt；changelog 被写入 | 2 |
| L5 | `tests/adapterErrorHandling.test.cjs` | BUG-34：无 adapter 时 success:false；adapter catch 块返回格式 | 3 |
| L6 | `tests/syncPullRetry.test.cjs` | E-12 修复：pull 重试次数 + 退避延迟 + 最终失败 | 2 |

**更新已有测试：**

| 文件 | 修改 |
|------|------|
| `tests/syncRepository.test.cjs` | 添加 getSnapshot / appendChangeLogs 测试用例 |
| `tests/syncIntegrationFlow.test.cjs` | 添加填充路径、清空路径场景 |

---

## 验收标准

### 功能性验收

- [ ] `lastSyncedAt` 为 null 的两个实体不触发冲突（两设备首次同步）
- [ ] 一个实体有 `lastSyncedAt`、另一个没有 → 有变更的胜出
- [ ] 双方都有 `lastSyncedAt` → 现有冲突检测逻辑不变
- [ ] 删除的基金/交易通过 push 传播到云端
- [ ] Pull 回来时本地自动删除已标记 `deletedAt` 的实体
- [ ] 增量 pull 仅返回 `sinceRevision` 之后的变更
- [ ] Public API POST trades 生成的 trade 包含 `lastSyncedAt`
- [ ] `ensureTables` 失败时返回错误而非静默通过
- [ ] 无 adapter 时 `_executePush` 返回 `{ success: false, reason: 'not_configured' }`

### UI 验收

- [ ] 同步工具模态框"本地"卡片版本号显示 `-`
- [ ] 冲突弹窗每次打开都重置滚动位置
- [ ] 首次同步弹窗关闭按钮正确触发取消回调
- [ ] 尾部斜杠的 API 请求不导致空 fundCode
- [ ] `visibilitychange` 注释与实际行为一致

### 代码质量验收

- [ ] `npm run lint` 0 errors
- [ ] `npm test` ≥74 pass
- [ ] 无死代码（showSyncConflict 回退分支已移除）
- [ ] `handleOptions` 无重复定义
- [ ] 无重复 `EPSILON` 常量

---

## 执行顺序

```
G1 (lastSyncedAt=0) → G2 (tombstone) → G3 (incremental pull)
  ↓
H1 (public API) → H2 (ensureTables) → H3 (success:false)
  ↓
I1~I8 (UI fixes, 可并行) + J1~J2 (server cleanup)
  ↓
K1 (pull retry)
  ↓
L1~L6 (tests)
  ↓
验收: lint → test → 手动验证清单
```
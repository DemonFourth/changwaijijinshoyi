# 场外基金收益计算器 — 同步机制全量分析验证文档

**生成日期：** 2026-05-19
**分析范围：** 同步架构、冲突管理、云端同步、Public API、UI/UX、安全、测试覆盖

---

## 目录

1. [架构总览](#1-架构总览)
2. [Pull 流程分析](#2-pull-流程分析)
3. [Push 流程分析](#3-push-流程分析)
4. [冲突检测机制分析](#4-冲突检测机制分析)
5. [首次同步流程分析](#5-首次同步流程分析)
6. [Public API 分析](#6-public-api-分析)
7. [安全分析](#7-安全分析)
8. [UI/UX 层分析](#8-uiux-层分析)
9. [边界情况与功能缺口](#9-边界情况与功能缺口)
10. [测试覆盖分析](#10-测试覆盖分析)
11. [完整 Bug 清单](#11-完整-bug-清单)
12. [推荐修复优先级](#12-推荐修复优先级)

---

## 1. 架构总览

```
[Browser: SyncAppService]
      ├── LocalStorageAdapter (localStorage CRUD)
      └── CloudflareD1SyncAdapter (HTTP → /api/sync/*)
               ↓
[Cloudflare Pages Functions]
      ├── /api/runtime-config   (GET, 运行时配置)
      ├── /api/sync/pull         (GET, 全量拉取)
      ├── /api/sync/push         (POST, 推送+冲突检测)
      ├── /api/sync/resolve      (POST, 冲突解决)
      └── /api/public/*          (Public API, 部分写需 X-API-Key)
               ↓
[D1 Database]
      ├── app_snapshot (revision, funds_json, trades_json)
      ├── change_log   (审计日志)
      └── sync_session (预留, 未使用)
```

- **同步策略：** Optimistic Concurrency Control（乐观并发控制），通过 `revision` 版本号协调
- **模式：** Push-Pull-Resolve 三步模式
- **存储：** 全量快照替换策略（非增量同步）

### 文件映射

| 组件 | 路径 | 行数 | 职责 |
|------|------|------|------|
| SyncAppService | `js/application/syncAppService.js` | 797 | 同步协调（Pull/Push/Resolve） |
| CloudflareD1SyncAdapter | `js/storage/cloudflareD1SyncAdapter.js` | 231 | 云端 HTTP 适配器 |
| LocalStorageAdapter | `js/storage/localStorageAdapter.js` | 57 | 本地存储 CRUD |
| StorageSchema | `js/storage/schema.js` | 84 | 数据模型工厂 |
| SyncAdapterRegistry | `js/storage/syncAdapterRegistry.js` | 36 | 适配器注册表 |
| SyncStatusPresenter | `js/syncStatusPresenter.js` | 260 | 同步 UI 渲染 |
| SyncFirstSyncHelper | `js/modal/syncFirstSyncHelper.js` | 91 | 首次同步三选一对话框 |
| SyncConflictModalHelper | `js/modal/syncConflictModalHelper.js` | 221 | 冲突解决弹窗 |
| pull.js | `functions/api/sync/pull.js` | 47 | 服务端拉取端点 |
| push.js | `functions/api/sync/push.js` | 65 | 服务端推送端点 |
| resolve.js | `functions/api/sync/resolve.js` | 64 | 服务端冲突解决端点 |
| syncRepository.js | `functions/_shared/syncRepository.js` | 123 | D1 数据访问层 |
| syncUtils.js | `functions/_shared/syncUtils.js` | 97 | 冲突检测 + CORS 工具 |
| d1Schema.js | `functions/_shared/d1Schema.js` | 84 | D1 表自动创建 |
| authMiddleware.js | `functions/_shared/authMiddleware.js` | 158 | API Key 校验 + 响应工具 |

### 核心数据结构

```javascript
// 同步元数据 (syncMeta)
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

// D1 app_snapshot 表
{
  id: 'main',
  user_id: 'default',
  revision: number,           // 单调递增版本号
  funds_json: string,         // JSON.stringify(funds)
  trades_json: string,        // JSON.stringify(trades)
  sync_meta_json: string | null,
  created_at: string,
  updated_at: string
}
```

---

## 2. Pull 流程分析

### 2.1 正常流程

```
SyncAppService._executePull()
  → 检查 _syncInProgress 锁
  → adapter.pull() → GET /api/sync/pull?deviceId=&cloudRevision=
    → syncRepository.getSnapshot() → D1 SELECT
    → 返回全量 { funds, trades, revision, serverTime }
  → 三种路径判断:
    ├─ [填充] local空 + cloud有 → 直接覆盖 local，设 lastSyncedAt，更新 syncMeta
    ├─ [清空] local有 + cloud空(revision更新) → 清空 local 数据
    └─ [合并] 双方都有数据 → 走冲突检测 / 首次同步判断
```

### 2.2 填充/清空路径的关键约束

- 必须使用 `StorageSchema.createEmptySnapshot()` 结果覆盖 `cloudFunds/cloudTrades`，而非从旧 localSnapshot 展开
- 必须对所有实体设置 `lastSyncedAt`
- 修复记录见 AGENTS.md "填充/清空后 cloudFunds 显示为 0" 章节

### 2.3 功能缺口

| ID | 问题 | 影响 | 严重度 |
|----|------|------|--------|
| P-GAP-01 | **无增量/条件拉取**：服务端无视 `cloudRevision` 参数，始终返回全量快照 | 大数据量时带宽浪费 | 中 |
| P-GAP-02 | **`deviceId` 参数从未使用**：`pull.js` 读取但从不记录或使用 | 无意义查询参数 | 低 |
| P-GAP-03 | **填充/清空路径可能丢失 `feeTiers` 字段**：云端 fund 实体缺字段未 normalize | 费率配置丢失 | 中 |

---

## 3. Push 流程分析

### 3.1 正常流程

```
notifyBusinessDataChanged(source)
  → increment pendingChanges, set syncStatus='pending'
  → setTimeout(() → _executePush(), delay)
    → sanitizeFundsForSync() 移除运行时计算字段
    → adapter.push() → POST /api/sync/push
      → 服务端比较 revision
        ├─ revision匹配 → updateSnapshot (++revision)
        ├─ revision不匹配 + source==='import' → 强制写入（无冲突检测）
        └─ revision不匹配 + source!=='import' → detectConflicts
          ├─ 有冲突 → 返回 conflict: true
          └─ 无冲突 → updateSnapshot
```

### 3.2 功能缺口

| ID | 问题 | 影响 | 严重度 |
|----|------|------|--------|
| P-GAP-04 | **`forcePushLocal()` 永远失败**：重置 cloudRevision 为 0 后 push，baseRevision=0 永远 != 服务端 revision，必定触发冲突 | 核心功能不可用 | **严重** |
| P-GAP-05 | **`forcePushLocal()` 无法强制推送**：应传 `source: 'import'` 绕过 revision 检查，但未实现 | 用户期望强制覆盖云端失败 | **严重** |
| P-GAP-06 | **`source: 'import'` 无验证**：任何客户端可设置 `source: 'import'` 绕过冲突检测直接覆盖云端 | 数据完整性风险 | 高 |
| P-GAP-07 | **无推送 payload 大小限制**：可推送超大 funds/trades 数组 | 内存/带宽消耗 | 中 |
| P-GAP-08 | **推送重试无 jitter**：退避延迟为 3000/6000/9000ms，幂等指数退避无随机抖动 | 多端同时重试时可能冲突 | 低 |
| P-GAP-28 | **pendingChanges 计数器竞态**：push 进行中用户继续修改数据，push 完成后 `_finalizePushSuccess` 将 pendingChanges 重置为 0，导致 push 期间产生的变更永远不会被同步 | 变更丢失 | **高** |
| P-GAP-29 | **`_executePush` 锁释放过早**：`_syncInProgress` 在第 424 行释放，但后续成功处理（446-451 行）仍在执行，释放后其他操作可发起新的 push | 并发安全 | 中 |
| P-GAP-30 | **无 adapter 时返回 `success: true` 误导调用方**：`_executePush` 第 398 行当无适配器时返回 `{ success: true, reason: 'not_configured' }`，调用方误认为操作成功 | 调用方逻辑误导 | 低 |
| P-GAP-31 | **`this` 绑定风险**：`visibilitychange` 回调中第 102 行使用 `this._executePush()`，回调中的 `this` 指向 `document` 而非 `SyncAppService`，实际执行的是 `document._executePush()`（undefined） | 页面关闭时推送静默失效 | 中 |

---

## 4. 冲突检测机制分析

### 4.1 统一检测算法（客户端 `_mergeEntities` + 服务端 `detectConflicts`）

```
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

// 触发冲突条件
if (localChangedAfterSync && cloudChangedAfterSync && 数据不同) → 冲突
```

### 4.2 关键细节

- 使用 `Date.getTime()`（毫秒时间戳）而非 ISO 字符串比较——ISO 字符串与 0 比较会得到 `NaN`
- 新增实体（只在一端存在的实体）不在冲突检测范围内

### 4.3 功能缺口

| ID | 问题 | 影响 | 严重度 |
|----|------|------|--------|
| P-GAP-09 | **entityType 使用启发式判断**：`localEntity.fundId ? 'trade' : 'fund'` —— 如果 fund 有 fundId 字段则误判 | 数据分类错误 | 中 |
| P-GAP-10 | **冲突检测不覆盖云端独有实体**：只检查 local 实体 vs cloud map，不反查 cloud 中新增实体 | 云端新增数据可能被静默丢弃 | 高 |
| P-GAP-11 | **冲突检测不覆盖本地删除**：本地删除的实体不会出现在冲突检测中，云端仍保留 | 删除不同步 | 中 |
| P-GAP-12 | **`updatedAt` 时间戳缺失时静默跳过冲突检测**：`new Date(undefined).getTime()` 返回 NaN，比较全为 false | 数据静默丢失 | 中 |
| P-GAP-13 | **merge 后未更新 `lastSyncedAt`**：cloud 覆盖 local 后，该实体的 `lastSyncedAt` 保持旧值 | 下次同步误判冲突 | 中 |
| P-GAP-14 | **`JSON.stringify` 深比较依赖 key 顺序**：如果 JSON 序列化 key 顺序不同，相同数据被判定为不同 | 假冲突 | 低 |
| P-GAP-15 | **服务端 `detectConflicts` 与客户端 `_mergeEntities` 算法重复**：未来修改可能不同步 | 维护风险 | 中 |
| P-GAP-32 | **字段清洗导致虚假冲突**：push 前客户端 `_sanitizeFundsForSync` 剥离 `netValue`、`estimatedValue` 等实时字段；服务端 `isDataChanged` 缺少这些字段的排除，清洗后的数据与云端含这些字段的数据比较时被判定为有差异 | 假冲突 | 高 |
| P-GAP-33 | **`lastSyncedAt === 0` 总触发"双方修改"**：从未同步过的实体 `lastSyncedTime` 为 0，导致 `localModifiedAfterSync` 和 `cloudModifiedAfterSync` 同时为 true，初次同步时每个实体都被标记为冲突 | 初次同步触发大量假冲突 | 高 |

---

## 5. 首次同步流程分析

### 5.1 流程图

```
_executePull() 检测到 firstSync（所有实体无 lastSyncedAt）
  → 返回 { firstSync: true, localFunds, localTrades, cloudFunds, cloudTrades }
  → 上层调用 SyncFirstSyncHelper.show(result, callback)
    → 弹出三选一对话框：
      ├─ [保留本地] → handleFirstSyncChoice('local') → 推送本地覆盖云端
      ├─ [使用云端] → handleFirstSyncChoice('cloud') → forceOverwriteLocal()
      └─ [合并]     → handleFirstSyncChoice('merge') → 执行正常合并流程
```

### 5.2 功能缺口

| ID | 问题 | 影响 | 严重度 |
|----|------|------|--------|
| P-GAP-16 | **首次同步对话框关闭（点 X）无回调**：Close 按钮不触发 onChoice，同步服务悬停等待 | 首次同步卡死，下次调用弹窗再次出现 | 中 |
| P-GAP-17 | **`manualSync()` 中 firstSync 后自动跳过 push**：firstSync 流程结束后不会自动触发 push | 用户需手动触发推送 | 低 |
| P-GAP-18 | **30 天阈值硬编码**：`30 * 24 * 60 * 60 * 1000` 不可配置 | 无法适应不同使用场景 | 低 |

---

## 6. Public API 分析

### 6.1 端点总览

| 端点 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/api/runtime-config` | GET | 无 | 返回 sync.enabled、storageMode |
| `/api/public/funds` | GET | 无 | 返回所有基金（非删除） |
| `/api/public/funds/:code` | GET | 无 | 单基金详情 |
| `/api/public/trades` | GET | 无 | 交易列表（可选 `?fundCode` 过滤） |
| `/api/public/trades` | POST | X-API-Key | 创建交易 |
| `/api/public/trades/:fundCode` | GET | 无 | 按基金代码过滤的交易列表 |
| `/api/public/help` | GET | 无 | API 文档（硬编码 Markdown） |
| `/api/sync/pull` | GET | **无** | 全量数据拉取 |
| `/api/sync/push` | POST | **无** | 数据推送写入 |
| `/api/sync/resolve` | POST | **无** | 冲突解决 |

### 6.2 功能缺口

| ID | 问题 | 影响 | 严重度 |
|----|------|------|--------|
| P-GAP-19 | **POST /api/public/trades 无幂等性保证**：相同交易可重复提交 | 重复数据 | 中 |
| P-GAP-20 | **POST /api/public/trades 不校验 `dividendMode` 值**：`'bonus'` 等非法值可存入 | 数据规范性 | 低 |
| P-GAP-21 | **POST /api/public/trades 不记录 changelog**：`appendChangeLogs` 未被调用 | 审计日志不完整 | 中 |
| P-GAP-22 | **POST /api/public/trades 不验证 `date` 有效性**：`2024-02-30` 等非法日期可过正则 | 数据准确性 | 低 |
| P-GAP-23 | **GET 端点无分页/排序**：全量返回没有 page/limit/sort 参数 | 大数据量性能 | 中 |
| P-GAP-24 | **URL 不处理尾部斜杠**：`/funds/005827/` 导致空字符串提取 | API 脆弱性 | 低 |
| P-GAP-25 | **无健康检查端点**（如 `/api/health`） | 运维缺失 | 低 |
| P-GAP-26 | **无 OpenAPI/Swagger 文档**：help 端点返回难以机器消费的硬编码 Markdown | 开发者体验 | 低 |
| P-GAP-27 | **服务端 `EPSILON` 与客户端重复定义**：`trades.js` 定义自己的 `EPSILON = 0.0001` | 两处定义可能不同步 | 低 |

---

## 7. 安全分析

| ID | 问题 | 位置 | 影响 | 严重度 |
|----|------|------|------|--------|
| SEC-01 | **CORS 配置冲突**：adapter 发 `credentials: 'include'`，服务端返回 `Access-Control-Allow-Origin: *`。浏览器拒绝此类请求 | `cloudflareD1SyncAdapter.js:186` + `syncUtils.js:78` | **CORS 请求完全失败** | **严重** |
| SEC-02 | **`/api/sync/*` 全无认证**：任何人知晓 URL 即可读取/写入全部数据 | `pull.js`, `push.js`, `resolve.js` | 数据完全暴露 | **严重** |
| SEC-03 | **`source: 'import'` 旁路**：任何推送可冒充 import 绕过冲突检测直接写入 | `push.js:34` | 数据完整性 | 高 |
| SEC-04 | **无速率限制**：所有端点可被无限制攻击 | 全局 | 拒绝服务 | 中 |
| SEC-05 | **API Key 使用 `===` 比较**：存在时序攻击风险（小规模场景可接受） | `authMiddleware.js:25` | 密钥泄漏 | 低 |
| SEC-06 | **错误信息暴露实现细节**：`internalErrorResponse(error.message)` 返回原始 message | `authMiddleware.js`, `public/trades.js` | 信息泄露 | 低 |
| SEC-07 | **`handleOptions` 在两个文件中重复定义**：`syncUtils.js` vs `authMiddleware.js`，CORS 头不一致 | `syncUtils.js:89`, `authMiddleware.js:134` | CORS 配置维护风险 | 低 |

### 7.1 CORS 详细分析

| 来源 | `Access-Control-Allow-Origin` | `Access-Control-Allow-Credentials` | `Access-Control-Allow-Headers` |
|------|------|------|------|
| `syncUtils.js:jsonResponse()` | `*` | 未设 | `Content-Type, Cookie` |
| `syncUtils.js:handleOptions()` | `*` | 未设 | `Content-Type, Cookie` |
| `authMiddleware.js:handleOptions()` | `*` | 未设 | `Content-Type, X-API-Key` |
| Adapter fetch 配置 | — | `include` | — |

**问题链**：
1. Angular/axios 等现代 HTTP 库检测到不同域时默认不发送 credentials
2. Adapter 显式设置 `credentials: 'include'` 要求 Cookie 信息
3. 服务端返回 `Access-Control-Allow-Origin: *` 且无 `Access-Control-Allow-Credentials: true`
4. 浏览器拒绝：当 credentials 为 `include` 时，Origin 不能为 `*`

---

## 8. UI/UX 层分析

### 8.1 组件关系

```
┌─ 头部 sync-indicator (#sync-status) ───────────────────┐
│  点击 → Modal.show('syncTools') → 同步工具模态框        │
│    ├─ 手动同步 → SyncAppService.manualSync()            │
│    ├─ 强制上传 → SyncAppService.forcePushLocal()        │
│    ├─ 强制下载 → SyncAppService.forceOverwriteLocal()   │
│    └─ 刷新云端 → SyncAppService.refreshCloudMeta()      │
├─ sync-status-banner (Overview/Detail) ───────[当前不可点击]┤
├─ 首次同步三选一弹窗 ───────────────────────────────────────┤
└─ 冲突解决弹窗 ────────────────────────────────────────────┘
```

### 8.2 功能缺口

| ID | 问题 | 位置 | 严重度 |
|----|------|------|--------|
| UI-01 | **同步工具模态框"本地"卡片显示云端版本号**：`_buildSyncToolsBodyHtml()` 第 136 行使用 `${cloudRevision}` 展示在"本地"区域 | `syncStatusPresenter.js:136` | 中 |
| UI-02 | **同步状态横幅 `data-action="open-sync-tools"` 无事件处理**：`Overview.renderSyncStatusBanner()` 和 `Detail.renderSyncStatusBanner()` 均为空方法 | `overview.js:152`, `detail.js:195` | 中 |
| UI-03 | **冲突对比表缺少 `netValue` 行**：`_getDiffFields()` 检测 `netValue` 差异，但 `TRADE_FIELDS` 不包含 `netValue` | `syncConflictModalHelper.js:53-71` | 中 |
| UI-04 | **`Modal.showSyncConflict()` 存在死代码回退路径**：回退到 `Modal.show('syncConflict')` 但 modalConfigs 中无 'syncConflict' 配置 | `modal.js:126-135` | 低 |
| UI-05 | **冲突弹窗无滚动重置**：不同于 `Modal.show()` 的 `body.scrollTop = 0` | `syncConflictModalHelper.js` | 低 |
| UI-06 | **首次同步弹窗关闭后无恢复路径**：使用 X 关闭后 sync 悬停，下次调用自动重弹 | `syncFirstSyncHelper.js` | 低 |
| UI-07 | **遗留的 `.sync-status` CSS 类与当前 `.sync-indicator` 样式并存** | `style.css:4432-4460` | 低 |
| UI-08 | **强制推送/拉取确认无异步处理**：`confirm()` 同步阻塞后无 loading 清理 | `syncStatusPresenter.js:231,244` | 低 |

---

## 9. 边界情况与功能缺口

### 9.1 数据完整性

| ID | 问题 | 位置 | 严重度 |
|----|------|------|--------|
| E-01 | **D1 `updateSnapshot` 无 `WHERE revision = ?` 乐观锁**：并发请求可同时写入不同数据且 revision 相同，相互覆盖 | `syncRepository.js:77-91` | **严重** |
| E-02 | **`ensureTables` 首次并发初始化竞态**：两个请求同时看到 `cnt = 0` 同时 INSERT，一个失败 | `d1Schema.js:68-76` | 低（不影响功能，下次请求可恢复） |
| E-03 | **全量替换策略：客户端推送缺失数据**：push 替换整个 D1 快照，如果客户端缺失某些云端实体，云端数据丢失 | `push.js:49` | **高** |
| E-04 | **`createFundEntity` 无 ID 回退**：`fund.id` 为空时 entity.id 为 undefined，`JSON.stringify` 丢弃该 key | `schema.js:42-57` | 中 |
| E-05 | **resolve.js 无 resolution 数组长度验证**：conflicts/resolutions 长度不一致时静默默认选择 local | `resolve.js:40` | 中 |
| E-06 | **resolve.js 与 push.js 的并发冲突**：resolve 读取快照→修改→写回，但未加锁 | `resolve.js:38-48` | 中 |
| E-07 | **Public API POST 不设置 `lastSyncedAt`**：新 trade 无 lastSyncedAt，影响后续冲突检测 | `public/trades.js` | 中 |
| E-08 | **`ensureTables` 无迁移机制**：schema 变更需手动处理 | `d1Schema.js` | 低（当前 schema 稳定） |
| E-15 | **冲突解决不保存到本地**：`resolveConflicts()` 构建了 `resolvedFunds/resolvedTrades` 数组，但从不写回 localStorage，用户选择"使用云端"后本地数据仍为旧版本 | `syncAppService.js:564-598` | **高** |
| E-16 | **Resolve 端点无 revision 检查**：`resolve.js` 更新 `updateSnapshot` 时未传入客户端的 `baseRevision` 验证，并发冲突解决的中间变更被静默覆盖 | `resolve.js:41-56` | 中 |
| E-17 | **异常不释放 `_syncInProgress` 锁**：`_executePush` 和 `_executePull` 中异步方法无 `try-catch-finally` 兜底，异常抛出时锁永久持有 | `syncAppService.js:390-455, 232-388` | 中 |
| E-18 | **查询参数序列化 `"undefined"` 字符串**：`cloudflareD1SyncAdapter.js:192-194` 的 `Object.entries(body).map(...)` 未过滤 `undefined` 值，`encodeURIComponent(undefined)` 结果为 `"undefined"` | 服务端收到错误的查询参数 | 低 |

### 9.2 同步功能缺口

| ID | 问题 | 严重度 |
|----|------|--------|
| E-09 | **无删除同步（tombstone）**：实体删除不传播到云端 | **严重** |
| E-10 | **无增量 push/pull**：每次推拉发全量数据 | 中 |
| E-11 | **无 push 超时保护**：`_executePull` 对 `adapter.pull()` 无 SyncAppService 层的超时封装（adapter 内部有 10s） | 低 |
| E-12 | **拉取无重试**：推送有 3 次退避重试，拉取无 | 中 |
| E-13 | **`startBackgroundSync` 无进度/结果通知**：后台同步静默完成，用户感知不到 | 低 |
| E-14 | **可见性变化推送方向与注释矛盾**：注释写"用户回到页面时推送"，实际代码在变为 hidden 时触发 | 低（语义问题） |

---

## 10. 测试覆盖分析

### 10.1 同步测试文件总览

| 文件 | Tests | 覆盖点 | 严重缺口 |
|------|-------|--------|----------|
| `syncAppService.test.cjs` | 9 | notifyBusinessDataChanged、push 成功/重试/事件、pull 事件 | forcePushLocal/forceOverwriteLocal、startBackgroundSync、并发安全 |
| `syncIntegrationFlow.test.cjs` | 4 | 端到端 push、pull 合并、冲突检测 | 填充路径、清空路径、首次同步、交易合并 |
| `syncRepository.test.cjs` | 1 | updateSnapshot INSERT 路径 | getSnapshot、appendChangeLogs、UPDATE 路径、并发 |
| `cloudflareD1SyncAdapter.test.cjs` | 4 | 存在性、配置状态、push 端点 | pull/resolve 端点、HTTP 错误、payload 格式 |
| `syncAdapterRegistry.test.cjs` | 2 | 注册表、markSyncComplete | getCurrentAdapter、registerAdapter、listAdapters |
| `localStorageAdapterSync.test.cjs` | 1 | getCurrentSyncAdapter 存在性 | 功能逻辑 |
| `modalSyncConflictFlow.test.cjs` | 1 | resolveConflicts 事件 | 本地数据更新、revision 更新、状态清理 |
| `syncStatusBanner.test.cjs` | 2 | error/pending 状态的 banner HTML | idle/syncing/conflict、DOM 交互 |
| `syncFeedback.test.cjs` | 1 | 推送失败 toast | 成功/冲突/离线 toast |
| `appSyncCompensation.test.cjs` | 1 | 启动冲突弹窗 | 高度模拟，真实逻辑少 |
| `toolPageSyncVisibility.test.cjs` | 1 | 源码字符串检查 | 脆弱的外貌测试 |
| `toolPageSyncSection.test.cjs` | 1 | 按钮 HTML 存在 | 其余 syncStatus、事件绑定 |

### 10.2 零覆盖区域

```
- 首次同步三选一流程（三种选择）
- 填充路径（local 空 → cloud 有）
- 清空路径（local 有 → cloud 空）
- forcePushLocal() / forceOverwriteLocal() / forcePullCloud()
- _mergeEntities 详细冲突检测逻辑（多场景组合）
- 30 天第一次同步阈值边界
- lastSyncedAt=0 时的首次同步冲突
- 服务端 getSnapshot / appendChangeLogs
- resolve.js 完整流程（多种选择）
- 并发 push 场景（TOCTOU 竞态）
- CORS 处理
- 删除同步
- Public API POST 路径完整验证
- adapter._request 重复实现 → _request 方法派发
- pendingChanges 计数器竞态
- 冲突解决后本地写回
- 字段清洗与虚假冲突（isDataChanged 排除字段）
- 锁释放过早导致并发问题
- resolve revision 检查
- 服务端输入校验缺失
- this 绑定导致 visibilitychange 推送静默失效
- 查询参数 "undefined" 字符串序列化
```

### 10.3 测试质量问题

| 问题 | 影响 |
|------|------|
| **模拟不匹配风险**：`syncFeedback.test.cjs` 和 `modalSyncConflictFlow.test.cjs` 模拟 `getCurrentSyncAdapter`，但 `_executePush` 实际使用 `SyncAdapterRegistry.getCurrentAdapter()` | 测试通过但生产失败 |
| **脆弱的外貌测试**：`toolPageSyncVisibility.test.cjs` 使用 `toString()` + `includes()` 检查源码 | 重构时极不稳定 |
| **强模拟**：`appSyncCompensation.test.cjs` 模拟整个 SyncAppService | 保障价值最小化 |
| **服务端覆盖不足**：`syncRepository.test.cjs` 3 个导出函数中仅测试 1 个，且仅测试插入路径 | 服务端逻辑几乎无验证 |
| **无 end-to-end 推送链条测试**：从 `FundAppService.addFund` → `notifyBusinessDataChanged` → `setTimeout` → `_executePush` → 适配器推送 → revision 更新的完整链条未被任何单个测试覆盖 | 集成风险 |

---

## 11. 完整 Bug 清单（按严重度排序）

### 严重 (Critical)

| ID | 位置 | 描述 | 影响 |
|----|------|------|------|
| BUG-01 | `syncUtils.js:78` + `cloudflareD1SyncAdapter.js:186` | **CORS 凭证冲突**：adapter 发送 `credentials: 'include'`，服务端返回 `Access-Control-Allow-Origin: *`，浏览器拒绝跨域请求 | 所有 sync HTTP 请求在浏览器中失败 |
| BUG-02 | `syncAppService.js:608-616` | **`forcePushLocal()` 永久失败**：重置 cloudRevision 为 0，导致 baseRevision=0 与服务端 revision 不匹配，必然触发冲突 | 用户无法强制推送本地覆盖云端 |
| BUG-03 | `syncRepository.js:54-91` | **D1 写操作无乐观锁**：`updateSnapshot` 使用 SELECT→读 revision→UPDATE 模式，但 UPDATE 无 `WHERE revision = ?`，并发时 revision 递增序列破坏 | 数据被静默覆盖 |
| BUG-04 | `push.js:34-49` | **全量替换丢失云端独有实体**：push 用 client 的 funds/trades 替换整个 D1 快照，client 缺失的云端实体被静默删除 | 数据丢失 |
| BUG-05 | `_mergeEntities` (client) + `detectConflicts` (server) | **冲突检测不覆盖云端新增实体**：只检查 local→cloud，不反查 cloud 中新实体 | 云端新增数据在合并时丢失 |

### 高 (High)

| ID | 位置 | 描述 | 影响 |
|----|------|------|------|
| BUG-06 | `push.js:34` | **`source: 'import'` 旁路**：任何请求可设 `source: 'import'` 跳过冲突检测 | 数据完整性 |
| BUG-07 | `syncAppService.js:534-537` | **merge 后不更新 `lastSyncedAt`**：cloud 覆盖 local 后，实体保持旧的 `lastSyncedAt` | 下次同步误判冲突 |
| BUG-08 | `syncAppService.js:623-676` | **`forceOverwriteLocal()` 未 normalize 云端实体**：cloud fund 可能缺字段（如 feeTiers） | 费率配置丢失 |
| BUG-09 | Server-side all sync endpoints | **`/api/sync/*` 端点全无认证** | 数据完全暴露 |
| BUG-10 | `syncUtils.js:47-50` | **entityType 启发式误判**：`fundId ? 'trade' : 'fund'`，极不可靠 | 冲突分类错误 |
| BUG-28 | `syncAppService.js:47-71` | **pendingChanges 计数器竞态**：push 期间用户继续修改数据，`_finalizePushSuccess` 将 pendingChanges 重置为 0，期间产生的变更永久丢失 | 变更丢失 |
| BUG-29 | `syncAppService.js:564-598` | **冲突解决不保存本地**：`resolveConflicts()` 推云端后从不写回 localStorage，用户选择"使用云端"后本地仍是旧数据 | 数据不一致 |

### 中 (Medium)

| ID | 位置 | 描述 | 影响 |
|----|------|------|------|
| BUG-11 | `syncConflictModalHelper.js:53-71` | **`netValue` 在冲突 diff 中被比较但不显示**：diffFields 包含 netValue 但 TRADE_FIELDS 无 netValue | diff 计数与显示不一致 |
| BUG-12 | `syncStatusPresenter.js:136` | **同步工具模态框"本地"卡片显示云端版本号**：`${cloudRevision}` 放在了错误的位置 | UI 混淆 |
| BUG-13 | `syncAppService.js:232-388` | **拉取无超时保护**：`_executePull` 对 `adapter.pull()` 无超时封装 | 拉取无限等待 |
| BUG-14 | `schema.js:42-57` | **`createFundEntity` 无 ID 回退**：fund.id 为空时 entity.id 为 undefined，`JSON.stringify` 丢弃 | 数据完整性 |
| BUG-15 | `resolve.js:40` | **resolution 数组长度不匹配时静默默认 local**：未验证长度 | 潜在数据不一致 |
| BUG-16 | `public/trades.js` | **POST 创建 trade 不记录 changelog**且不设 `lastSyncedAt` | 审计/同步问题 |
| BUG-17 | `overview.js:152` + `detail.js:195` | **`renderSyncStatusBanner()` 为空方法**：banner 有 `data-action` 但无事件处理 | banner 不可点击 |
| BUG-30 | `syncUtils.js` + `syncAppService.js:_isEntityDataChanged` | **字段清洗导致虚假冲突**：`_sanitizeFundsForSync` 剥离 netValue/estimatedValue，服务端 `isDataChanged` 未排除这些字段 | 假冲突 |
| BUG-31 | `syncAppService.js:_mergeEntities` + `syncUtils.js:detectConflicts` | **`lastSyncedAt=0` 总触发"双方修改"**：从未同步实体 lastSyncedTime=0 → `localModifiedAfterSync=cloudModifiedAfterSync=true` → 每个实体都被标记冲突 | 大量假冲突 |
| BUG-32 | `push.js:28-30` + `resolve.js:28-30` | **服务端无输入校验**：push/resolve 端点对接收的 funds/trades 不做类型/结构校验，损坏数据一次推送即可污染云端 | 数据完整性 |
| BUG-33 | `syncAppService.js:390-455` | **锁在结果处理前释放**：`_syncInProgress` 第 424 行释放（早于 success 处理 446-451 行） | 并发安全 |
| BUG-37 | `resolve.js:41-56` | **Resolve 端点无 revision 检查**：`updateSnapshot` 未传入客户端的 `baseRevision`，并发冲突解决时中间变更被静默覆盖 | 并发安全 |

### 低 (Low)

| ID | 位置 | 描述 |
|----|------|------|
| BUG-18 | `modal.js:126-135` | `showSyncConflict` 回退到不存在的 `'syncConflict'` modal config |
| BUG-19 | `syncConflictModalHelper.js` | 冲突弹窗无 scrollTop 重置 |
| BUG-20 | `syncFirstSyncHelper.js:86-88` | 关闭按钮不触发回调，同步悬停 |
| BUG-21 | `syncUtils.js:16` | `JSON.stringify` 深比较依赖 key 顺序，可能假冲突 |
| BUG-22 | `public/trades.js:177-178` | 服务端 `EPSILON` 与客户端 `Utils.EPSILON` 重复定义 |
| BUG-23 | `public/funds/[code].js:28` | URL 尾部斜杠 `.../005827/` 提取空字符串 |
| BUG-24 | `_shared/authMiddleware.js` + `syncUtils.js` | `handleOptions` 在两个文件中重复定义，CORS 头不一致 |
| BUG-25 | `d1Schema.js:81-83` | `ensureTables` 静默吞异常，后续操作失败原因不明确 |
| BUG-26 | `public/help.js` | API 文档硬编码，易过期 |
| BUG-27 | `syncAppService.js:95-105` | visibilitychange 注释与行为不一致（改为 hidden 时触发，注释写"回到页面"） |
| BUG-34 | `syncAppService.js:398` | 无 adapter 时 `_executePush` 返回 `success: true`，误导调用方 |
| BUG-35 | `syncAppService.js:102` | `visibilitychange` 回调中 `this` 指向 `document` 而非 `SyncAppService`，`this._executePush()` 静默失败 |
| BUG-36 | `cloudflareD1SyncAdapter.js:192-194` | `encodeURIComponent(undefined)` 序列化为 `"undefined"` 字符串 |

---

## 12. 推荐修复优先级

### P0（阻塞性 — 立即修复）

```
BUG-01  [CORS 凭证冲突]      → 服务端 jsonResponse 反射 origin + 移除 adapter credentials:'include'
BUG-02  [forcePushLocal 永久失败] → fetch 当前 cloudRevision 后再 push，或传 { source: 'import' }
BUG-03  [D1 无乐观锁]         → UPDATE 加 WHERE revision = ? + 检查 affectedRows
BUG-04  [全量替换丢失实体]     → push 时合并云端+本地数据再提交
BUG-05  [云端新增实体不检测]   → 反查 cloudMap 中 localMap 没有的实体
BUG-09  [sync 端点无认证]     → 至少加 X-API-Key 校验（与 public POST 一致）
E-01   [D1 无乐观锁]         → 同 BUG-03
BUG-35 [this 绑定风险]        → visibilitychange 回调中 this → SyncAppService
BUG-33 [锁释放过早]           → _executePush/_executePull 加 try-finally
FIX-NEW-A [pendingChanges 竞态] → push 前记录 prePushPendingCount，完成后只减增量
FIX-NEW-H [this 绑定]          → 同 BUG-35
FIX-NEW-F [锁释放时机]         → 同 BUG-33
```

### P1（功能性 — 尽快修复）

```
BUG-06  [source: 'import' 旁路]          → 验证 source 值或移除该旁路
BUG-07  [merge 后 lastSyncedAt 未更新]   → merge 后显式设当前时间
BUG-08  [forceOverwriteLocal 未 normalize] → 经过 createFundEntity/createTradeEntity
BUG-10  [entityType 启发式]               → 在 entity 中加入显式 entityType 字段
BUG-11  [netValue 冲突 diff 不显示]       → 在 TRADE_FIELDS 加入 netValue
BUG-12  [本地/云端版本号混淆]              → 移除"本地"列版本号或显示 N/A
BUG-13  [拉取无超时]                      → 给 adapter.pull() 加 AbortController timeout
BUG-14  [createFundEntity 无 ID]          → 加 `id: fund.id || Utils.generateId()`
BUG-15  [resolution 长度验证]              → 校验 resolutions 数组长度
BUG-16  [Public API changelog]             → POST trades 追加 changelog + lastSyncedAt
BUG-17  [banner 不可点击]                  → 绑定 data-action 事件处理
BUG-28  [pendingChanges 竞态]             → 同 FIX-NEW-A
BUG-29  [冲突解决不保存本地]               → resolveConflicts 成功后以 user choice 更新本地 snapshot
BUG-30  [字段清洗虚假冲突]                 → 服务端 isDataChanged 扩充 SKIP_FIELDS 含 netValue 等
BUG-31  [lastSyncedAt=0 触发冲突]          → 无 lastSyncedAt 的实体视为该端无变更；Public API 写入 lastSyncedAt
BUG-32  [服务端无输入校验]                 → push/resolve 加 entity 结构校验（syncId、type、code/name）
BUG-37  [Resolve 无 revision 检查]         → resolve 请求体加 baseRevision，UPDATE 时加到 WHERE
E-03   [全量替换策略]                      → 同 BUG-04
E-09   [无删除同步]                       → 同步 deletedAt 标记的实体
E-15   [冲突解决不保存本地]                → 同 BUG-29
E-16   [Resolve revision 检查]             → 同 BUG-37
E-17   [异常不释放锁]                     → 同 BUG-33（try-finally）
P-GAP-04 [forcePushLocal 失败]            → 同 BUG-02
P-GAP-10 [云端实体不检测]                  → 同 BUG-05
P-GAP-28 [pendingChanges 竞态]            → 同 FIX-NEW-A
P-GAP-29 [锁释放过早]                     → 同 BUG-33
P-GAP-32 [字段清洗虚假冲突]               → 同 BUG-30
P-GAP-33 [lastSyncedAt=0 触发冲突]         → 同 BUG-31
SEC-01  [CORS 冲突]                       → 同 BUG-01
SEC-02  [sync 端点无认证]                  → 同 BUG-09
```

### P2（体验/健壮性 — 规划修复）

```
P-GAP-01  无增量拉取         → 实现条件拉取（基于 revision）
P-GAP-06  import 旁路        → 同 BUG-06
P-GAP-07  无 payload 限制    → 校验请求体大小
P-GAP-19  POST 无幂等性      → 加 idempotency key 或基于 syncId 去重
P-GAP-23  GET 无分页         → 加 page/limit 参数
P-GAP-30  无 adapter 返回success:true → 改为 success: false
P-GAP-31  this 绑定风险       → 同 BUG-35
UI-01~08  UI 问题合集        → 按条修复
E-12      拉取无重试          → 给 _executePull 加退避重试
E-18      查询参数 "undefined" → adapter._request 过滤 undefined 值
BUG-18~27 低优先级清单        → 逐步清理
BUG-34    误导 success:true   → 同 P-GAP-30
BUG-36    "undefined" 参数    → 同 E-18
```

---

## 附录 A：相关文件路径索引

| 文件 | 行数 | 功能 |
|------|------|------|
| `js/application/syncAppService.js` | 797 | 同步协调 |
| `js/storage/cloudflareD1SyncAdapter.js` | 231 | 云端适配器 |
| `js/storage/localStorageAdapter.js` | 57 | 本地存储 |
| `js/storage/schema.js` | 84 | 数据模型 |
| `js/storage/syncAdapterRegistry.js` | 36 | 适配器注册 |
| `js/syncStatusPresenter.js` | 260 | 同步 UI |
| `js/modal/syncFirstSyncHelper.js` | 91 | 首次同步弹窗 |
| `js/modal/syncConflictModalHelper.js` | 221 | 冲突弹窗 |
| `js/modal.js` | ~200 | 模态框系统 |
| `js/app.js` | ~360 | 应用启动 |
| `functions/api/sync/pull.js` | 47 | 拉取端点 |
| `functions/api/sync/push.js` | 65 | 推送端点 |
| `functions/api/sync/resolve.js` | 64 | 冲突解决 |
| `functions/api/runtime-config.js` | 30 | 运行时配置 |
| `functions/api/public/funds.js` | 63 | 基金列表 |
| `functions/api/public/funds/[code].js` | 74 | 单基金 |
| `functions/api/public/trades.js` | 210 | 交易 CRUD |
| `functions/api/public/trades/[fundCode].js` | 89 | 基金交易 |
| `functions/api/public/help.js` | 326 | API 文档 |
| `functions/_shared/syncRepository.js` | 123 | D1 数据访问 |
| `functions/_shared/syncUtils.js` | 97 | 冲突检测工具 |
| `functions/_shared/d1Schema.js` | 84 | 表创建 |
| `functions/_shared/authMiddleware.js` | 158 | API 认证 |
| `css/style.css` (sync 相关) | ~750 | 同步样式 |
| `tests/syncAppService.test.cjs` | — | 同步服务测试 |
| `tests/syncIntegrationFlow.test.cjs` | — | 集成测试 |
| `tests/syncRepository.test.cjs` | — | D1 测试 |
| `tests/cloudflareD1SyncAdapter.test.cjs` | — | 适配器测试 |
| `tests/syncAdapterRegistry.test.cjs` | — | 注册表测试 |
| `tests/localStorageAdapterSync.test.cjs` | — | 本地存储测试 |
| `tests/modalSyncConflictFlow.test.cjs` | — | 冲突弹窗测试 |
| `tests/syncStatusBanner.test.cjs` | — | UI 测试 |
| `tests/syncFeedback.test.cjs` | — | 反馈测试 |
| `tests/appSyncCompensation.test.cjs` | — | 启动测试 |
| `tests/toolPageSyncVisibility.test.cjs` | — | 工具页测试 |
| `tests/toolPageSyncSection.test.cjs` | — | 工具段测试 |

---

## 附录 B：测试覆盖矩阵

| 功能点 | 有测试? | 测试文件 | 场景数 |
|--------|---------|----------|--------|
| SyncAppService 存在性 | ✓ | `syncAppService.test.cjs` | 1 |
| notifyBusinessDataChanged | ✓ | `syncAppService.test.cjs` | 4 |
| _executePush 成功 | ✓ | `syncAppService.test.cjs` | 1 |
| _executePush 重试 | ✓ | `syncAppService.test.cjs` | 1 |
| _executePull 事件 | ✓ | `syncAppService.test.cjs` | 1 |
| 可见性补偿 | ✓ | `syncAppService.test.cjs` | 1 |
| 端到端 push 集成 | ✓ | `syncIntegrationFlow.test.cjs` | 2 |
| 端到端 pull 合并 | ✓ | `syncIntegrationFlow.test.cjs` | 1 |
| 冲突检测 | ✓ | `syncIntegrationFlow.test.cjs` | 1 |
| updateSnapshot INSERT | ✓ | `syncRepository.test.cjs` | 1 |
| 适配器注册 | ✓ | `syncAdapterRegistry.test.cjs` | 2 |
| 适配器配置状态 | ✓ | `cloudflareD1SyncAdapter.test.cjs` | 3 |
| 适配器 push 端点 | ✓ | `cloudflareD1SyncAdapter.test.cjs` | 1 |
| 推送失败 toast | ✓ | `syncFeedback.test.cjs` | 1 |
| resolveConflicts 事件 | ✓ | `modalSyncConflictFlow.test.cjs` | 1 |
| UI banner HTML | ✓ | `syncStatusBanner.test.cjs` | 2 |
| 启动冲突弹窗 | ✓ | `appSyncCompensation.test.cjs` | 1 |
| 同步工具段 HTML | ✓ | `toolPageSyncSection.test.cjs` | 1 |
| 工具页同步面板 | ✓ | `toolPageSyncVisibility.test.cjs` | 1 |
| **零覆盖功能:** |
| 首次同步三选一 | ✗ | — | 0 |
| 填充路径 | ✗ | — | 0 |
| 清空路径 | ✗ | — | 0 |
| forcePushLocal | ✗ | — | 0 |
| forceOverwriteLocal | ✗ | — | 0 |
| forcePullCloud | ✗ | — | 0 |
| refreshCloudMeta | ✗ | — | 0 |
| _sanitizeFundsForSync | ✗ | — | 0 |
| _mergeEntities 冲突分支 | ✗ | — | 0 |
| 服务端 getSnapshot | ✗ | — | 0 |
| 服务端 appendChangeLogs | ✗ | — | 0 |
| 服务端 detectConflicts | ✗ | — | 0 |
| resolve.js 流程 | ✗ | — | 0 |
| CORS 处理 | ✗ | — | 0 |
| 删除同步 | ✗ | — | 0 |
| Public API POST | ✗ | — | 0 |
| 并发写入 | ✗ | — | 0 |
| 30 天阈值边界 | ✗ | — | 0 |
| pendingChanges 竞态 | ✗ | — | 0 |
| 冲突解决本地写回 | ✗ | — | 0 |
| 字段清洗/虚假冲突 | ✗ | — | 0 |
| 锁释放时机/并发安全 | ✗ | — | 0 |
| resolve revision 检查 | ✗ | — | 0 |
| 服务端输入校验 | ✗ | — | 0 |
| this 绑定 / visibilitychange | ✗ | — | 0 |
| "undefined" 参数序列化 | ✗ | — | 0 |

---

## 附录 C：核心代码片段引用

### `forcePushLocal()` 损坏路径

```javascript
// syncAppService.js:608-616
forcePushLocal: async function() {
    // ...
    window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: 0 });    // 重置为 0
    const syncMeta = window.LocalStorageAdapter.getSyncMeta();
    const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
    // 推送时 baseRevision=0，但云端 revision>0 → 必然触发冲突
    const result = await SyncAppService._executePush();
    // ...
}
```

### CORS 冲突

```javascript
// cloudflareD1SyncAdapter.js:186 — 客户端：要求凭证
return fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',              // ← 要求 Cookie/认证头
    signal: controller.signal,
    body: body
});

// syncUtils.js:78 — 服务端：允许所有来源
function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',   // ← 但 credentials 要求具体 origin
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Cookie'
        }
    });
}
```

### D1 无乐观锁

```javascript
// syncRepository.js:54-91
async function updateSnapshot(env, payload, userId) {
    const current = await getSnapshot(env, userId);
    const newRevision = (current.revision || 0) + 1;
    // ... 序列化 funds/trades ...
    // UPDATE 无 WHERE revision = oldRevision → 并发时互相覆盖
    const result = await env.DB.prepare(
        `INSERT INTO app_snapshot (id, user_id, revision, funds_json, trades_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id, user_id) DO UPDATE SET
            revision = excluded.revision,
            funds_json = excluded.funds_json,
            trades_json = excluded.trades_json,
            updated_at = excluded.updated_at`
    ).bind('main', userId, newRevision, serializedFunds, serializedTrades, now).run();
    return { success: true, revision: newRevision };
}
```

---

*本文档由 opencode 自动分析生成，覆盖范围包括所有客户端同步逻辑、服务端 API、UI/UX 组件及测试文件。*
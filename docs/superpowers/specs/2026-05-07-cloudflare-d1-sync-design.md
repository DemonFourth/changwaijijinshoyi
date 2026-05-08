# Cloudflare D1 云同步设计

## 背景

当前项目已经完成本地存储分层与同步入口预留，关键结构包括：
- `js/storage/localStorageAdapter.js`：本地 snapshot 统一读写入口
- `js/storage/localSyncAdapter.js`：当前本地同步适配器占位实现
- `js/storage/syncAdapterRegistry.js`：同步 provider 注册与选择入口
- `js/storage/schema.js`：`funds`、`trades`、`syncMeta` 的标准数据结构

项目后续希望支持部署后跨设备使用，但仍保持“本地优先”的体验：页面应先显示本地数据，不因云端请求阻塞；云端作为同步副本与跨设备共享通道，而不是唯一数据源。

## 目标

- 保持本地优先，打开页面时优先使用本地数据立即渲染
- 使用 Cloudflare Workers + D1 提供单用户云同步能力
- 密码保护作为可选能力，通过环境变量控制开关
- 云端同步仅覆盖核心业务数据：`funds`、`trades`、`syncMeta`
- 本地修改先落地，再后台同步到云端
- 云端返回后自动比对本地差异，仅在有冲突时打扰用户
- 云端不可用时应用仍可正常使用本地数据
- 未部署 Cloudflare Workers / D1 时，应用默认退回纯本地模式，不影响本地使用

## 非目标

- 不实现多用户系统
- 不实现 OAuth、邮箱验证码等完整鉴权体系
- 不同步主题、视图偏好、筛选状态、本地缓存
- 不在首版实现复杂的多人实时协同
- 不将收益、持仓、分组、手续费等运行时结果持久化到云端

## 设计原则

- 本地主，云端辅
- 启动不阻塞
- 自动合并优先，人工介入最少
- 冲突处理以记录级为单位，不做整包覆盖
- 删除操作必须可同步，防止旧数据复活
- 页面层不直接接云端，统一通过 adapter / application / repository 分层接入

## 总体架构

### 前端

前端继续以本地 snapshot 为主数据源。

- `LocalStorageAdapter` 继续作为本地持久化入口
- 新增 `CloudflareD1SyncAdapter`，注册到 `SyncAdapterRegistry`
- 未检测到 Cloudflare 同步配置时，`SyncAdapterRegistry` 默认选择 `local` provider
- 页面、manager、repository 不直接访问 Workers 接口
- 同步流程由 application / storage 层统一调度

建议新增职责：
- `js/storage/cloudflareD1SyncAdapter.js`：封装 pull / push / resolve / auth status
- `js/application/syncAppService.js`：封装启动同步、后台推送、冲突处理流程
- `js/storage/schema.js`：扩展同步元信息字段
- `js/modal/`：新增冲突处理弹窗 helper

### 云端

Cloudflare Workers 提供 HTTP API，D1 负责存储单用户云端数据副本。

Workers 负责：
- 密码校验与 session 管理
- 拉取云端快照或变更数据
- 接收本地增量变更并更新云端
- 返回冲突检测结果或保存冲突待处理状态

D1 负责：
- 保存当前业务快照
- 保存版本信息
- 保存可选的变更日志与会话信息

## 启动与同步时序

### 页面启动

1. 前端启动时先从本地 `LocalStorageAdapter` 读取 snapshot
2. 若本地有数据，立即渲染 overview / detail，不等待云端
3. 后台发起鉴权状态检查
4. 若启用了密码保护且未登录，显示密码页；登录成功后继续后台 pull
5. 若未启用密码或已登录，直接发起 pull
6. pull 完成后与本地进行差异检测
7. 无差异：静默完成，不打扰用户
8. 有非冲突差异：自动合并并更新本地
9. 有冲突差异：提示用户选择处理方式

### 本地写入后同步

1. 用户新增 / 编辑 / 删除基金或交易
2. 先写本地 snapshot，并更新记录 `updatedAt`
3. 将变更加入后台同步队列
4. 异步 push 到云端
5. 若云端基线未变化，提交成功并更新本地 `syncMeta`
6. 若云端在共同基线后发生冲突修改，返回冲突结果并标记待处理状态
7. 用户处理冲突后，再触发一次 resolve / push

## 数据模型

### 本地 snapshot

在现有结构基础上扩展同步字段：

```js
{
  schemaVersion: 1,
  funds: [{
    id,
    syncId,
    code,
    name,
    remark,
    feeTiers,
    createdAt,
    updatedAt,
    deletedAt
  }],
  trades: [{
    id,
    syncId,
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
    deletedAt
  }],
  syncMeta: {
    provider,
    deviceId,
    lastSyncAt,
    lastPulledAt,
    lastPushedAt,
    cloudRevision,
    syncStatus,
    pendingChanges,
    lastError
  }
}
```

字段说明：
- `syncId`：跨设备识别同一条业务记录的稳定标识
- `updatedAt`：记录最后修改时间，用于冲突判断
- `deletedAt`：软删除时间戳，用于 tombstone 同步
- `deviceId`：当前设备本地唯一标识
- `cloudRevision`：本地已知的云端版本号
- `syncStatus`：如 `idle` / `syncing` / `conflict` / `error`
- `pendingChanges`：待同步变更数量或摘要
- `lastError`：上次同步失败原因

### 云端 D1 表设计

首版建议至少 3 张表。

#### 1. `app_snapshot`

保存当前云端有效数据与版本。

建议字段：
- `id`：固定单租户主键，可写死为 `main`
- `revision`：整数版本号，每次成功写入递增
- `funds_json`：当前 `funds` 快照 JSON
- `trades_json`：当前 `trades` 快照 JSON
- `sync_meta_json`：可选，保存云端同步元信息
- `updated_at`：最近云端更新时间

#### 2. `change_log`

用于调试、审计与后续增量优化。

建议字段：
- `id`
- `revision`
- `entity_type`：`fund` / `trade`
- `sync_id`
- `operation`：`upsert` / `delete`
- `payload_json`
- `device_id`
- `created_at`

#### 3. `sync_session`

用于密码开启时的会话管理。

建议字段：
- `session_id`
- `created_at`
- `expires_at`
- `last_seen_at`
- `ip_hash`（可选）
- `user_agent_hash`（可选）

## 冲突判定与合并规则

### 基本原则

同步按记录级处理，不做整个 snapshot 覆盖。

以 `syncId` 识别同一业务对象。当同一 `syncId` 在本地与云端都发生变更时，再判断是否可自动合并或需要人工处理。

### 自动合并场景

以下情况可自动合并：
- 记录只在本地修改，云端未变
- 记录只在云端修改，本地未变
- 本地新增、云端不存在
- 云端新增、本地不存在
- 两边修改的是不同 `syncId` 记录
- 一侧删除、另一侧未修改且版本未前进

### 冲突场景

以下情况标记为冲突：
- 同一 `syncId` 在本地与云端都在共同基线后被修改
- 同一 `syncId` 一侧删除，另一侧在共同基线后又被编辑
- 本地 push 时使用的 `cloudRevision` 已落后，且对应记录在云端已变化

### 冲突解决策略

默认策略：
- 非冲突记录自动合并
- 冲突记录集中列出，让用户逐项选择

用户可选操作：
- 使用本地版本
- 使用云端版本
- 手动合并后保存

手动合并适用于：
- 基金备注、费率配置、名称等字段
- 交易备注等低风险文本字段

对于关键结构字段，如 `type`、`shares`、`amount`、`date`，首版建议不做字段级自动拼接，仍以“本地 / 云端二选一”为主，避免生成不可信记录。

### 删除策略

删除统一采用 tombstone 方案：
- 本地删除时不直接物理移除，而是写入 `deletedAt`
- push 时将删除状态同步到云端
- pull 时若发现云端有 `deletedAt`，本地同记录也进入删除态
- 只有在确认不再参与同步后，才允许后续清理 tombstone

这样可以避免：
- 某设备删除后，另一台旧设备再次把旧记录上传回来
- 本地与云端由于延迟造成“删除复活”

## 鉴权与密码页

### 密码开关

密码保护为可选能力，由 Workers 环境变量控制：
- `AUTH_ENABLED`：是否开启密码页校验
- `APP_PASSWORD`：访问密码
- `SESSION_SECRET`：session 签名密钥

### 登录行为

当 `AUTH_ENABLED` 为开启状态时：
- 前端访问应用后先请求 `GET /auth/status`
- 未登录则显示密码输入页
- 用户输入密码后调用 `POST /auth/login`
- Workers 校验成功后设置 HttpOnly session cookie
- 前端收到成功结果后进入应用并触发后台 pull

当 `AUTH_ENABLED` 为关闭状态时：
- 前端不显示密码页
- 直接进入本地渲染与后台同步流程

### 设计约束

- 密码与开关仅存在于 Workers 环境变量，不下发到前端
- session 只用于访问云同步接口，不参与业务数据计算
- 密码页只作为部署后访问保护，不改变本地优先同步模型

## Workers API 设计

### `GET /auth/status`

用途：
- 判断是否开启密码保护
- 判断当前 session 是否有效

返回建议：

```json
{
  "authEnabled": true,
  "authenticated": false
}
```

### `POST /auth/login`

请求：

```json
{
  "password": "..."
}
```

成功后：
- 设置 HttpOnly cookie
- 返回登录成功状态

### `POST /auth/logout`

用途：
- 清理 session
- 前端切回未认证状态

### `GET /sync/pull`

用途：
- 获取云端当前版本
- 获取云端记录集合或变更摘要

请求可携带：
- `deviceId`
- `cloudRevision`
- `lastPulledAt`

首版建议直接返回当前全量快照与版本号，先简化实现；后续再基于 `change_log` 演进为增量返回。

返回建议：

```json
{
  "revision": 12,
  "funds": [],
  "trades": [],
  "serverTime": "2026-05-07T00:00:00.000Z"
}
```

### `POST /sync/push`

用途：
- 提交本地变更到云端
- 基于 `baseRevision` 做乐观并发控制

请求建议：

```json
{
  "deviceId": "device-a",
  "baseRevision": 12,
  "funds": [],
  "trades": []
}
```

返回可能为：
- `success`：写入成功，返回新 `revision`
- `conflict`：检测到冲突，返回冲突记录集合
- `error`：鉴权失败或服务异常

### `POST /sync/resolve`

用途：
- 用户在冲突弹窗中确认后，将最终版本提交到云端

请求建议：
- 提交冲突项的最终定稿记录
- 携带当前 `baseRevision`

## 前端交互设计

### 默认体验

- 页面打开后直接使用本地数据
- 用户不需要等待云同步完成
- 若后台同步无差异，不显示额外提示

### 状态提示

建议在页面顶部或设置区域增加轻量同步状态：
- 未同步
- 同步中
- 已同步
- 冲突待处理
- 同步失败

状态提示应轻量，不阻塞正常使用。

### 冲突提示弹窗

只有在存在真正冲突时才弹出。

弹窗应展示：
- 冲突对象类型：基金 / 交易
- 冲突对象关键字段摘要
- 本地版本与云端版本对比
- 可选操作：使用本地 / 使用云端 / 手动合并

对于交易记录，建议优先展示：
- 日期
- 类型
- 金额
- 份额
- 手续费
- 备注

### 人工触发操作

在设置或工具页增加：
- 立即同步
- 重试同步
- 查看同步状态
- 以本地覆盖云端
- 以云端覆盖本地
- 导出本地备份

其中覆盖类操作应有二次确认，避免误操作。

## 失败与降级策略

### 云端不可用

- 页面继续使用本地数据
- 将 `syncStatus` 标为 `error`
- 保留待同步变更，等待下次自动或手动重试

### 未部署 Cloudflare

- 若本地环境、静态托管环境或自定义部署环境未提供 Workers 同步入口
- 应用启动时不应报错，不应阻塞页面渲染
- `SyncAdapterRegistry` 应默认回退到 `local` provider
- 不显示强制性的密码页与云同步失败弹窗
- 同步相关入口可显示为“未配置云同步”或直接隐藏高级同步能力

### 鉴权失效

- 若密码保护开启且 session 失效
- pull / push 返回未认证状态
- 前端保留当前本地数据
- 弹出重新输入密码入口，不清空本地业务数据

### 网络中断

- 不回滚已保存的本地修改
- 仅标记待同步状态
- 网络恢复后可自动重试或用户手动触发

## 实现分层建议

### 前端文件落点

建议按现有约定新增或调整：

- `js/storage/cloudflareD1SyncAdapter.js`
  - 封装 `/auth/*` 与 `/sync/*` 请求
  - 实现 `getStatus`、`pull`、`push`、`resolve`、`markSyncComplete`

- `js/application/syncAppService.js`
  - 启动后台同步流程
  - 管理同步状态更新
  - 协调自动合并与冲突弹窗

- `js/storage/schema.js`
  - 扩展 `syncMeta` 默认字段

- `js/storage/migrations.js`
  - 将旧 snapshot 迁移到新 `syncMeta` 结构

- `js/modal/syncConflictModalHelper.js`
  - 冲突弹窗展示与提交选择

- `js/toolPage.js` 或设置区域
  - 增加手动同步与同步状态入口

### 分层约束

- 页面层只负责状态展示与用户交互
- application 层协调同步流程
- adapter 层负责协议与存储 provider 细节
- repository 仍只处理本地业务数据读写
- 不允许在 overview / detail / modal 中直接 fetch Workers 接口

## 测试策略

需要覆盖以下测试重点：

### 单元测试

- `StorageSchema` 新字段默认值
- `StorageMigrations` 旧快照迁移到新 `syncMeta`
- 同步差异计算逻辑
- 冲突识别逻辑
- tombstone 合并逻辑

### 集成测试

- 启动时本地先渲染，再后台 pull
- pull 无差异时静默完成
- pull 有非冲突差异时自动合并
- pull 有冲突时进入冲突弹窗流程
- 本地写入后进入后台 push
- push 成功后更新 `cloudRevision`
- push 基线落后时进入冲突态
- 删除后不会被旧设备数据复活

### 异常测试

- Workers 不可用
- D1 读写失败
- session 过期
- 密码错误
- 网络断开后恢复重试
- 未部署 Workers / D1 时自动回退纯本地模式

## 分阶段实施建议

### 阶段 1：同步框架接入

- 扩展 `syncMeta` 结构
- 新增 `CloudflareD1SyncAdapter`
- 完成 `SyncAdapterRegistry` 接入 cloudflare provider
- 新增 `syncAppService` 基础流程
- 页面实现“本地先渲染 + 后台 pull”

### 阶段 2：云端鉴权与基础同步

- 搭建 Workers + D1
- 接入环境变量密码开关
- 完成 `auth/status`、`auth/login`、`pull`、`push`
- 实现全量快照 pull / push
- 完成同步状态提示

### 阶段 3：冲突处理与删除同步

- 引入记录级差异检测
- 完成 tombstone 删除同步
- 增加冲突弹窗与 resolve 接口
- 增加手动同步与覆盖操作

### 阶段 4：增量优化

- 利用 `change_log` 优化增量 pull / push
- 降低全量快照传输频率
- 完善日志与排障信息

## 验收标准

- 部署后应用可以在 Cloudflare 环境下运行
- 未部署 Cloudflare Workers / D1 时，应用仍可作为纯本地版本正常运行
- 本地已有数据时，页面打开无需等待云端即可显示
- 云端无差异时不打扰用户
- 云端有差异时能自动合并非冲突记录
- 云端与本地存在冲突时能提示用户处理
- 本地删除记录不会在后续同步中被旧数据复活
- Workers / D1 异常时应用仍可使用本地数据
- 密码开关关闭时无密码页，开启时必须先通过密码验证
- 业务页面不直接依赖云端接口实现细节

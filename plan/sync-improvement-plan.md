# 同步机制改进方案

## 已发现的问题

### Bug A：冲突弹窗字段显示为 undefined

- **文件**：`js/modal/syncConflictModalHelper.js`
- **根因**：`_renderConflictItem` 中将 `conflict.entityType` 翻译为中文 `'基金'`/`'交易'` 后，同一变量被传入 `_getDiffFields` 和 `_formatVersionDetail`。下游用中文值与 `'fund'` 比较 → 永远 false → 基金冲突被当作交易渲染，交易字段全部 undefined
- **修复**：显示用变量改名为 `entityTypeLabel`，下游方法全部使用 `conflict.entityType`

### Bug B：填充路径 syncMeta 被旧值覆盖（导致 cloudFunds=0）

- **文件**：`js/application/syncAppService.js`，`_executePull()` 填充路径
- **根因**：`localSnapshot` 在 line 257 加载，此时 `cloudFunds/cloudTrades` 尚未被 line 263-266 更新。line 271 `newSnapshot = { ...localSnapshot }` 展开旧 syncMeta，line 276 `saveSnapshot` 将旧的 `cloudFunds: 0` 写回 localStorage
- **修复**：构造 `newSnapshot` 时直接指定正确的 `cloudFunds/cloudTrades`，并重置 `pendingChanges: 0`、标记 `lastSyncedAt`

### Bug C：清空路径存在相同问题

- **文件**：`js/application/syncAppService.js`，`_executePull()` 清空路径
- **根因**：同上，`newSnapshot = { ...localSnapshot }` 展开旧 syncMeta
- **修复**：同 Bug B

### Bug D：填充后显示"待同步 N 项"

- **文件**：`js/application/syncAppService.js`，`_executePull()` 填充路径
- **根因**：填充路径未调用 `_finalizePushSuccess`，各实体的 `lastSyncedAt` 未设置、`pendingChanges` 未归零。后续 app 加载流程触发数据变更事件（如更新净值/名称）→ `pendingChanges` 被递增
- **修复**：填充路径中设置所有实体的 `lastSyncedAt`，并重置 `pendingChanges: 0`

### Bug E：forcePullCloud 无法真正强制覆盖

- **文件**：`js/application/syncAppService.js`
- **根因**：`forcePullCloud()` 仅重置 `cloudRevision = 0` 后走 `_executePull()`，后者进入 `_mergeEntities()` 合并逻辑，冲突时本地始终获胜
- **修复**：新增独立方法 `forceOverwriteLocal()`，直接替换本地快照为云端数据，跳过合并

### Bug F：首次同步双方有数据时触发大量冲突

- **文件**：`js/application/syncAppService.js` + 新建 `js/modal/syncFirstSyncHelper.js`
- **根因**：`lastSyncedAt` 全为 0，`_mergeEntities()` 对每条记录判定冲突
- **修复**：在 `_executePull()` 中检测首次同步条件（`syncMeta.lastSyncAt` 为空且双方均有数据），返回特殊标志，由调用方弹出选择对话框

### Bug G：客户端与服务器冲突检测算法不一致

- **文件**：`js/application/syncAppService.js`，`_mergeEntities()`
- **根因**：服务端 `syncUtils.js:53` 有 30 天兜底逻辑，客户端没有
- **修复**：客户端 `_mergeEntities()` 增加 30 天兜底分支

## 实施顺序

| 序号 | 任务 | 文件 | 类型 |
|------|------|------|------|
| 1 | 冲突弹窗 entityType 变量名修复 | `syncConflictModalHelper.js` | Bugfix |
| 2 | 填充/清空路径 syncMeta 修复 | `syncAppService.js` | Bugfix |
| 3 | 新增 forceOverwriteLocal() | `syncAppService.js` | 新增 |
| 4 | 首次同步检测 + 弹窗 | `syncAppService.js` + `syncFirstSyncHelper.js` | 新增 |
| 5 | 统一冲突检测算法 | `syncAppService.js` | 增强 |
| 6 | syncStatusPresenter 绑定新方法 | `syncStatusPresenter.js` | 调整 |
| 7 | 补充测试 | 新建/修改 test 文件 | 测试 |
| 8 | lint + test 验证 | - | 验证 |

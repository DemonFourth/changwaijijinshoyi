# 场外基金收益计算器

一个面向支付宝场外基金交易场景的收益计算 Web 应用，支持本地优先使用、可选 Cloudflare Pages + D1 云同步、加权平均成本法收益统计、FIFO 手续费计算与多轮持仓分析。

**设计原则**：场外基金以长期持有为主，默认按收益率排序，图表与交互更适配长周期观察；在架构上坚持页面编排、应用服务写入、仓储/适配器持久化分层，降低功能迭代时的耦合成本。

## 功能特性

### 核心功能
- ✅ 基金管理：添加、编辑、删除基金
- ✅ 实时数据：自动获取基金净值与估算数据
- ✅ 交易记录：记录买入、卖出、分红等交易（支持备注）
- ✅ 加权平均成本法：用于持仓成本、浮动盈亏、已实现收益统计
- ✅ FIFO 手续费计算：用于按持有天数匹配卖出费率
- ✅ 数据导入导出：JSON 格式备份与恢复
- ✅ 本地优先：页面打开即可使用本地快照

### UI 与分析能力
- ✅ 深色/浅色主题切换：CSS 设计令牌驱动，支持系统主题适配
- ✅ 卡片/列表双视图：支持按收益率/收益额/市值/名称排序
- ✅ 多轮持仓分组：自动识别建仓、加仓、减仓、清仓周期
- ✅ 详情页图表分析：收益趋势、买卖对比、收益率变化
- ✅ 大数字格式化：自动转万/亿，悬浮显示完整值
- ✅ 交易记录分页筛选：按类型/日期范围筛选，支持分页
- ✅ Top5 盈亏榜单：盈利/亏损基金快速查看
- ✅ FIFO 计算验证：验证收益与手续费计算链路
- ✅ 基金转换计算器：支持转换费用测算与交易记录落库

### 云同步能力
- ✅ Cloudflare Pages Functions + D1：无独立 Worker 的同步接口部署方式
- ✅ 本地优先 + 云端补齐：先渲染本地，再做后台同步
- ✅ push / pull / resolve：支持上传、拉取、冲突解决
- ✅ tombstone 软删除：防止旧数据回流复活
- ✅ 记录级冲突检测：用户逐项选择本地版或云端版
- ✅ 同步状态跟踪：`pendingChanges`、`syncStatus`、`lastSyncAt`、`lastSyncedAt`
- ✅ 手动同步：工具箱支持立即同步、强制上传、强制下载

### 技术特性
- 🎯 原生 HTML / CSS / JavaScript，无前端框架
- 🎯 自定义模块注册 + 事件总线，模块解耦
- 🎯 本地存储与云同步适配器分层，便于后续扩展 provider
- 🎯 运行时配置加载，自动判断本地模式或混合存储模式
- 🎯 GB2312 编码处理，兼容基金 API 返回格式

## 使用方式

### 本地使用
1. 直接用浏览器打开 `index.html`
2. 若无 `/api/*` 接口，则自动工作在本地模式
3. 页面会提示“当前使用本地数据”

### 云端部署

#### 1. 创建 D1 数据库
1. Cloudflare Dashboard → Workers & Pages → D1 → Create Database
2. 名称可设为：`fund-calculator-db`

#### 2. 部署 Pages（前端 + Pages Functions）
1. Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 选择 GitHub 仓库和分支
3. Build command 留空，Build output directory 留空
4. 在 Settings → Bindings 中添加 D1 绑定
5. 绑定名填写：`DB`

> 无需额外环境变量。运行时会检测 `env.DB` 是否存在：存在则启用云同步，不存在则自动降级为本地模式。

#### 3. 验证
1. 打开 Pages URL
2. 无 `/api/*` 时应提示“当前使用本地数据”
3. 有 `/api/*` 且 D1 已绑定时应提示“当前使用混合存储（本地 + 云端同步）”
4. 在工具箱点击“立即同步”验证云端同步链路

## 项目结构

```text
jijinshouyi/
├── index.html
├── css/
│   ├── tokens.css
│   └── style.css
├── js/
│   ├── namespace.js
│   ├── moduleRegistry.js
│   ├── eventBus.js
│   ├── config.js
│   ├── utils.js
│   ├── app.js
│   ├── overview.js
│   ├── detail.js
│   ├── modal.js
│   ├── toolPage.js
│   ├── dataService.js
│   ├── fundManager.js
│   ├── tradeManager.js
│   ├── chartManager.js
│   ├── router.js
│   ├── runtimeConfigLoader.js
│   ├── storage.js
│   ├── calculatorV2.js
│   ├── fifoCalculator.js
│   ├── fifoValidator.js
│   ├── feeCalculator.js
│   ├── conversionCalculator.js
│   ├── fundAPI.js
│   ├── application/
│   │   ├── appSettingsService.js
│   │   ├── fundAppService.js
│   │   ├── importAppService.js
│   │   ├── syncAppService.js
│   │   └── tradeAppService.js
│   ├── repositories/
│   │   ├── fundRepository.js
│   │   └── tradeRepository.js
│   ├── storage/
│   │   ├── schema.js
│   │   ├── migrations.js
│   │   ├── localStorageAdapter.js
│   │   ├── localSyncAdapter.js
│   │   ├── cloudflareD1SyncAdapter.js
│   │   └── syncAdapterRegistry.js
│   ├── detail/
│   │   ├── detailEditHelper.js
│   │   ├── detailFundUpdateHelper.js
│   │   ├── detailHoldingHelper.js
│   │   ├── detailMenuHelper.js
│   │   └── detailTradeActionHelper.js
│   └── modal/
│       ├── syncConflictModalHelper.js
│       └── tradeModalHelper.js
├── functions/
│   ├── api/
│   │   ├── runtime-config.js
│   │   └── sync/
│   │       ├── pull.js
│   │       ├── push.js
│   │       └── resolve.js
│   └── _shared/
│       ├── d1Schema.js
│       ├── syncRepository.js
│       └── syncUtils.js
├── tests/
│   ├── helpers/
│   │   └── loadBrowserModules.cjs
│   └── *.test.cjs
├── lib/
│   └── echarts.min.js
└── README.md
```

## 架构分层

### 1. 页面层
页面层文件如 `js/overview.js`、`js/detail.js`、`js/modal.js`、`js/toolPage.js` 只负责：
- 页面编排
- DOM 事件绑定
- 调用 helper / manager / application service
- 响应事件总线刷新页面

**约束**：页面层不直接承担底层存储细节，不新增散落的 LocalStorage 读写。

### 2. Application 层
`js/application/*.js` 负责业务写操作与用例编排：
- `FundAppService`：基金新增、编辑、删除
- `TradeAppService`：交易新增、编辑、删除
- `ImportAppService`：导入/清空业务数据
- `AppSettingsService`：设置、导入导出入口
- `SyncAppService`：同步状态、push / pull / resolve、补偿链路

**约束**：新增业务写操作优先走 application 层，而不是直接从页面层调用存储。

### 3. Repository / Manager 层
- `js/repositories/*.js`：仓储访问，聚合 snapshot 中的基金/交易读写
- `FundManager` / `TradeManager`：页面和计算展示使用的运行时读取入口

**约束**：
- 页面/UI 侧优先通过 manager 读数据
- application 层和数据聚合层可通过 repository 读写业务数据

### 4. Storage / Adapter 层
- `StorageSchema`：统一数据模型归一化
- `StorageMigrations`：schema 迁移
- `LocalStorageAdapter`：本地 snapshot 持久化
- `LocalSyncAdapter` / `CloudflareD1SyncAdapter`：同步 provider 适配器
- `SyncAdapterRegistry`：provider 注册与选择

**约束**：
- 不允许新增代码直接散落读写旧 `fundsKey/tradesKey` 结构
- 新增云端 provider 时，必须按 adapter 方式接入，禁止把云端调用直接写进页面层或 manager 层

## 同步机制

### 本地优先基线
应用启动时先加载本地 snapshot，再根据运行时配置决定是否连接 `/api/sync/*`。这样即使云端不可用，页面也能立即展示本地数据。

### 同步核心数据
云端同步只覆盖核心业务域：
- `funds`
- `trades`
- `syncMeta`

以下内容保留本地，不参与云同步：
- 主题偏好
- 视图偏好
- 筛选状态
- 本地缓存

### 关键字段
- `syncId`：业务实体的同步主键
- `deletedAt`：tombstone 软删除时间
- `lastSyncedAt`：该实体最近成功同步到云端的时间
- `pendingChanges`：待同步变更数量
- `syncStatus`：同步状态（如 `idle` / `pending` / `error`）
- `lastSyncAt` / `lastPushedAt`：最近同步与推送时间

### push / pull / resolve 流程
1. 本地业务写操作完成后，通过 `SyncAppService.notifyBusinessDataChanged()` 标记待同步
2. `push` 成功后：
   - 更新 `syncMeta`
   - 回填实体 `lastSyncedAt`
3. `pull` 合并云端快照后：
   - 写回本地 snapshot
   - 广播 `SYNC_DATA_APPLIED`
4. 若检测到冲突：
   - 返回冲突列表
   - 通过 `SyncConflictModalHelper` 提示用户选择本地版/云端版
   - `resolve` 成功后广播统一刷新事件

### 刷新链路
同步数据落地后，统一通过 `EventType.SYNC_DATA_APPLIED` 触发：
- `Overview.refresh()`
- `Detail.refresh()`
- `ToolPage.renderSyncStatus()`

### 失败补偿与重试
- 页面关闭 / 隐藏时触发同步补偿
- push 失败后按退避策略重试
- 达到上限后落为错误状态，避免无限重试

## 核心算法

### 加权平均成本法
**用途**：计算基金持仓成本与收益。

规则：
1. 买入：持仓总成本 += 买入金额（含手续费）
2. 卖出：持仓总成本 -= 卖出份额 × 持仓成本价
3. 持仓成本价 = 持仓总成本 / 持仓总份额
4. 每次买入后重新计算成本价

### FIFO
**用途**：计算卖出手续费，不用于收益统计。

规则：
1. 按买入时间顺序构建 FIFO 队列
2. 卖出时从最早买入批次依次扣减
3. 一笔卖出可跨多个买入批次
4. 每个批次按持有天数匹配卖出费率区间

### 两种计算方式的职责边界

| 维度 | 加权平均成本法 | FIFO |
|------|----------------|------|
| 用途 | 持仓成本、浮动盈亏、已实现收益 | 卖出手续费 |
| 批次处理 | 不区分批次，统一成本价 | 区分批次，先进先出 |
| 主要文件 | `js/calculatorV2.js` | `js/fifoCalculator.js`、`js/feeCalculator.js` |

## 数据存储

### 业务快照
业务数据以统一 snapshot 结构存储，由 `LocalStorageAdapter` 管理，并通过 `StorageSchema` 做字段归一化。

### 典型本地数据
- 基金与交易快照
- `syncMeta`
- 应用设置
- 主题设置
- 视图偏好

### 导出格式
```json
{
  "version": "1.0.0",
  "exportTime": "2024-01-19T10:00:00.000Z",
  "funds": [],
  "trades": [],
  "settings": {}
}
```

## 开发规范

### 代码风格
- 禁止在对象方法内部使用 `this` 调用其他方法，应使用明确对象名
- 回答与协作说明以中文为主，专有名词除外
- 新增功能优先复用现有目录结构与 helper

### 分层约束
- 页面层只负责编排、事件绑定、调用 helper / service
- 业务写操作统一优先走 `js/application/*.js`
- 数据读取统一优先通过 manager 或 repository
- 持久化统一通过 `LocalStorageAdapter` 与 `StorageSchema`
- 计算结果保持运行时生成，不持久化到业务模型

### 测试约束
修改以下关键路径时，必须补或更新 `node:test` 测试：
- 数据模型与存储
- application 层
- 同步链路
- `detail` / `modal` / `overview` 关键路径

### 同步扩展约束
- 同步统一通过 `LocalStorageAdapter.getCurrentSyncAdapter()` 与 `SyncAdapterRegistry`
- 新增 provider 必须实现 adapter 接口
- 禁止把云端请求直接散落到页面层、manager 层

## 开发与验证

### 安装依赖
```bash
npm install
```

### 运行测试
```bash
npm test
```

### 运行代码检查
```bash
npm run lint
```

也可拆分执行：
```bash
npm run lint:js
npm run lint:css
```

> 当前 lint 结果允许存在少量历史 warning，但不应新增 error。

## 浏览器兼容性
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## 注意事项
1. 基金代码必须是 6 位数字
2. 交易日期格式为 `YYYY-MM-DD`
3. 份额和金额必须大于 0
4. 卖出份额不能超过当前持有份额
5. 建议定期导出数据备份

## 版本历史

### v2.3.0
- ✅ 引入 application / repository / storage adapter 分层
- ✅ 增强本地优先云同步链路与冲突处理
- ✅ 补强同步测试、集成测试与统一刷新事件链路

### v2.2.0 (2026-04-28)
- ✅ FIFO 计算验证功能
- ✅ 交易记录表格重构
- ✅ Badge 样式优化
- ✅ 多个 bug 修复

### v2.1.0 (2026-04-27)
- ✅ 涨跌颜色统一管理
- ✅ 多轮持仓分组展示
- ✅ 分红再投资支持
- ✅ 基金名称硬编码管理

### v2.0.0 (2026-04-25)
- ✅ CSS 设计令牌体系
- ✅ 深色/浅色主题切换
- ✅ ECharts 专业图表
- ✅ 卡片/列表双视图 + 多字段排序

## 许可证
MIT License

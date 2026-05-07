# 架构重构与可迁移存储设计

## 目标
- 云端只同步 funds 与 trades
- theme、viewPrefs、临时筛选、图表状态、本地缓存继续保留在本地
- 所有收益、持仓、分组、手续费结果运行时计算，不持久化

## 新数据模型
```js
{
  schemaVersion: 1,
  funds: [{
    id,
    code,
    name,
    remark,
    feeTiers,
    createdAt,
    updatedAt,
    deletedAt,
    syncId
  }],
  trades: [{
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
  }],
  syncMeta: {
    provider,
    deviceId,
    lastSyncAt
  }
}
```

## 分层边界
- ui：Overview、Detail、Modal、ToolPage
- application：FundAppService、TradeAppService
- domain：CalculatorV2、FIFO、FeeCalculator
- infrastructure：LocalStorageAdapter、Repository、FundAPI、Router、ChartManager

## 迁移策略
- 启动时优先读取 snapshotKey
- 若不存在 snapshot，则从旧 fundsKey / tradesKey 迁移
- 迁移后写回统一 snapshot
- 旧 settings/theme 继续沿用原 key

## 第一阶段范围
- 建立 schema、migrations、LocalStorageAdapter
- 引入 FundRepository / TradeRepository
- 让 DataService、FundManager、TradeManager 通过新层读写
- 保持页面功能与现有交互不回退

## 第二阶段
- 引入 CloudSyncAdapter 接口
- 支持 upsert / pull / push / conflict resolution
- 删除操作全面切换为软删除同步策略

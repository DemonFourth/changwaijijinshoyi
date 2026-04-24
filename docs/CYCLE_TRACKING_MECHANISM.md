# 持仓周期追踪机制说明

## ✅ 已实现的功能

### 1. 持仓周期追踪机制

**自动识别持仓周期**:
```javascript
// 算法逻辑
买入 → 持仓=0 → 新周期开始
卖出 → 持仓=0 → 周期结束(清仓)

// 示例
2024-01-01 买入100份 → 周期1开始
2024-02-01 卖出100份 → 周期1结束
2024-03-01 买入100份 → 周期2开始
2024-04-01 危出50份  → 周期2继续
2024-05-01 买入50份  → 周期2继续(加仓)
2024-06-01 危出100份 → 周期2结束
```

### 2. 周期历史数据结构

**每个周期独立存储**:
```javascript
{
    id: 1,                          // 周期ID
    startDate: '2024-01-01',        // 开始日期
    endDate: '2024-02-01',          // 结束日期
    status: 'closed',               // active | closed
    
    // 独立的投入/产出数据
    totalInvest: 1000,              // 该周期总投入
    totalBuyAmount: 1000,           // 买入金额
    totalBuyFee: 0,                 // 买入手续费
    totalShares: 100,               // 买入份额
    
    totalSellAmount: 1200,          // 卖出金额
    totalSellFee: 10,               // 危出手续费
    sellCount: 1,                   // 危出次数
    
    // 独立的收益数据
    realizedProfit: 190,            // 已实现收益
    floatingProfit: 0,              // 浮动收益(已清仓为0)
    totalProfit: 190,               // 周期总收益
    profitRate: 19,                 // 周期收益率
    
    // 持仓天数
    holdingDays: 31,                // 持仓天数
    
    // 交易明细
    trades: [...],                  // 该周期所有交易
    tradeDetails: [...],            // 交易详情
    realizedDetails: [...]          // 危出收益明细
}
```

### 3. 多轮持仓查询

**查询接口**:
```javascript
// 获取所有持仓周期
const result = CalculatorV2.calculateFundProfit(trades, netValue);
const cycles = result.cycles;

// 查询单个周期
const cycle1 = cycles.find(c => c.id === 1);

// 查询已结束的周期
const closedCycles = cycles.filter(c => c.status === 'closed');

// 查询进行中的周期
const activeCycles = cycles.filter(c => c.status === 'active');

// 查询特定时间段的周期
const cycleIn2024 = cycles.filter(c => 
    c.startDate >= '2024-01-01' && c.startDate <= '2024-12-31'
);
```

### 4. 加仓对比数据独立保存

**每轮独立存储，不会相互影响**:
```javascript
// 周期1: 无加仓
{
    id: 1,
    totalInvest: 1000,
    totalShares: 100,
    costPerShare: 10,  // 成本10元/份
    trades: [
        { type: 'buy', shares: 100, amount: 1000 },
        { type: 'sell', shares: 100, amount: 1200 }
    ]
}

// 周期2: 有加仓
{
    id: 2,
    totalInvest: 1600,
    totalShares: 150,
    costPerShare: 10.67,  // 摊薄成本10.67元/份
    trades: [
        { type: 'buy', shares: 100, amount: 1000 },  // 首次买入
        { type: 'buy', shares: 50, amount: 600 },    // 加仓
        { type: 'sell', shares: 150, amount: 1800 }
    ]
}
```

**关键点**: 
- ✅ 每个周期的成本独立计算
- ✅ 加仓只影响当前周期
- ✅ 不会影响历史周期数据
- ✅ 可以追溯每轮的表现

### 5. 摊薄成本隔离

**问题**: 传统计算方式，所有交易混在一起，摊薄成本会受历史影响

**解决**: 周期隔离，每个周期独立计算

```javascript
// 传统方式(错误)
总成本 = (1000 + 600) / (100 + 50) = 10.67元/份
// 问题: 周期1已清仓，不应该影响周期2

// 周期隔离方式(正确)
周期1成本 = 1000 / 100 = 10元/份
周期2成本 = (1000 + 600) / (100 + 50) = 10.67元/份
// 正确: 每个周期独立计算
```

## 📊 数据结构设计

### 完整的周期数据结构
```javascript
{
    // 基础信息
    id: 1,
    startDate: '2024-01-01',
    endDate: '2024-02-01',
    status: 'closed',
    holdingDays: 31,
    
    // 投入统计(独立)
    totalInvest: 1000,
    totalBuyAmount: 1000,
    totalBuyFee: 0,
    totalShares: 100,
    buyCount: 1,              // 买入次数
    avgBuyPrice: 10,          // 平均买入价
    
    // 危出统计(独立)
    totalSellAmount: 1200,
    totalSellFee: 10,
    sellCount: 1,
    avgSellPrice: 1200,       // 平均卖出价
    
    // 持仓信息(独立)
    holdingShares: 0,
    holdingCost: 0,
    holdingValue: 0,
    costPerShare: 10,         // 摊薄成本
    
    // 收益信息(独立)
    realizedProfit: 190,
    floatingProfit: 0,
    totalProfit: 190,
    profitRate: 19,
    annualizedRate: 228,      // 年化收益率
    
    // 明细数据(独立)
    trades: [...],            // 原始交易
    tradeDetails: [...],      // 交易详情
    realizedDetails: [...],   // 危出收益明细
    
    // 对比数据(独立)
    benchmark: {
        maxDrawdown: 0,       // 最大回撤
        maxProfit: 190,       // 最大收益
        winRate: 100          // 胜率
    }
}
```

### 汇总数据结构
```javascript
{
    cycles: [...],  // 所有周期
    
    summary: {
        // 周期统计
        totalCycles: 2,
        closedCycles: 1,
        activeCycles: 1,
        
        // 投入统计
        totalInvest: 2600,
        totalBuyAmount: 2600,
        totalBuyFee: 0,
        
        // 危出统计
        totalSellAmount: 3000,
        totalSellFee: 20,
        totalFee: 20,
        
        // 收益统计
        totalRealizedProfit: 380,
        totalFloatingProfit: 50,
        totalProfit: 430,
        profitRate: 16.54,
        
        // 当前持仓
        currentHolding: {
            shares: 50,
            cost: 500,
            value: 550,
            floatingProfit: 50
        }
    }
}
```

## 🔍 使用示例

### 1. 基本使用
```javascript
// 计算收益
const trades = DataService.getTradesByFund(fundId);
const result = CalculatorV2.calculateFundProfit(trades, fund.netValue);

// 查看所有周期
console.log('持仓周期:', result.cycles);

// 查看汇总
console.log('总收益:', result.summary.totalProfit);
console.log('总收益率:', result.summary.profitRate);
```

### 2. 查询历史周期
```javascript
// 查询已结束的周期
const closedCycles = result.cycles.filter(c => c.status === 'closed');

closedCycles.forEach(cycle => {
    console.log(`周期${cycle.id}:`);
    console.log(`  时间: ${cycle.startDate} ~ ${cycle.endDate}`);
    console.log(`  投入: ¥${cycle.totalInvest}`);
    console.log(`  收益: ¥${cycle.totalProfit}`);
    console.log(`  收益率: ${cycle.profitRate}%`);
    console.log(`  持仓天数: ${cycle.holdingDays}天`);
});
```

### 3. 对比不同周期
```javascript
// 对比周期表现
result.cycles.forEach(cycle => {
    console.log(`周期${cycle.id}:`);
    console.log(`  成本: ¥${cycle.costPerShare.toFixed(2)}/份`);
    console.log(`  收益率: ${cycle.profitRate.toFixed(2)}%`);
    console.log(`  年化: ${(cycle.profitRate * 365 / cycle.holdingDays).toFixed(2)}%`);
});
```

### 4. 追溯加仓影响
```javascript
// 查看加仓对成本的影响
const cycle = result.cycles[1];  // 周期2
const trades = cycle.trades;

let cumulativeCost = 0;
let cumulativeShares = 0;

trades.filter(t => t.type === 'buy').forEach((trade, i) => {
    cumulativeCost += trade.amount + trade.fee;
    cumulativeShares += trade.shares;
    
    console.log(`第${i+1}次买入:`);
    console.log(`  份额: ${trade.shares}`);
    console.log(`  金额: ¥${trade.amount}`);
    console.log(`  累计成本: ¥${(cumulativeCost / cumulativeShares).toFixed(2)}/份`);
});
```

## 📈 数据持久化建议

### 当前状态
- ✅ 计算逻辑完整
- ✅ 数据结构完整
- ❌ 未持久化周期数据

### 建议方案
```javascript
// 保存周期历史
function saveCycleHistory(fundId, cycles) {
    const history = {
        fundId,
        updateTime: new Date().toISOString(),
        cycles: cycles.map(c => ({
            id: c.id,
            startDate: c.startDate,
            endDate: c.endDate,
            status: c.status,
            totalInvest: c.totalInvest,
            totalProfit: c.totalProfit,
            profitRate: c.profitRate,
            holdingDays: c.holdingDays
        }))
    };
    
    localStorage.setItem(`cycle_history_${fundId}`, JSON.stringify(history));
}

// 加载周期历史
function loadCycleHistory(fundId) {
    const data = localStorage.getItem(`cycle_history_${fundId}`);
    return data ? JSON.parse(data) : null;
}
```

## ✅ 总结

### 已实现
1. ✅ 持仓周期自动识别
2. ✅ 周期历史数据结构
3. ✅ 多轮持仓查询
4. ✅ 加仓对比数据独立保存
5. ✅ 摊薄成本隔离
6. ✅ 历史表现追溯

### 待实现
1. ⏳ 持仓天数计算
2. ⏳ 年化收益率
3. ⏳ 周期数据持久化
4. ⏳ UI显示周期历史
5. ⏳ 周期对比图表

### 核心优势
- **数据隔离**: 每个周期独立计算，互不影响
- **历史追溯**: 可以查看每轮持仓的详细表现
- **加仓追踪**: 清晰记录加仓对成本的影响
- **多轮对比**: 可以对比不同周期的收益率

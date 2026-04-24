# 收益计算设计文档

## 需求分析

### 1. 多轮持仓场景
```
时间线示例:
2024-01-01  买入 100份  → 持仓周期1开始
2024-02-01  卖出 100份  → 持仓周期1结束，清仓
2024-03-01  买入 100份  → 持仓周期2开始
2024-04-01  危出 50份   → 持仓周期2继续
2024-05-01  买入 50份   → 持仓周期2继续
2024-06-01  危出 100份  → 持仓周期2结束，清仓
```

### 2. 持仓周期定义
- **开始**: 买入操作且之前持仓为0
- **结束**: 卖出操作后持仓变为0（清仓）
- **持续**: 持仓>0期间的所有买入卖出操作

### 3. 收益计算规则

#### 单个持仓周期收益
```
持仓周期收益 = 已实现收益 + 浮动收益

已实现收益 = 该周期内所有卖出收益之和
           = Σ(危出金额 - 成本 - 手续费)

浮动收益 = 当前市值 - 持仓成本
         = 持有份额 × 当前净值 - 持仓成本

持仓周期收益率 = 持仓周期收益 / 投入成本 × 100%
```

#### 总收益
```
总收益 = 所有持仓周期收益之和
       = Σ(周期1收益 + 周期2收益 + ...)

总收益率 = 总收益 / 总投入 × 100%
```

## 数据结构设计

### 持仓周期对象
```javascript
{
    id: 'cycle-xxx',
    startDate: '2024-01-01',      // 开始日期
    endDate: '2024-02-01',        // 结束日期(如果已清仓)
    status: 'closed',             // active | closed
    
    // 投入统计
    totalInvest: 1000,            // 总投入金额
    totalShares: 100,             // 总买入份额
    
    // 当前状态(仅active周期)
    holdingShares: 0,             // 持有份额
    holdingCost: 0,               // 持仓成本
    holdingValue: 0,              // 当前市值
    
    // 收益统计
    realizedProfit: 100,          // 已实现收益
    floatingProfit: 0,            // 浮动收益(仅active周期)
    totalProfit: 100,             // 周期总收益
    profitRate: 10,               // 周期收益率
    
    // 交易记录
    trades: [...]                 // 该周期的所有交易
}
```

### 计算结果对象
```javascript
{
    // 所有持仓周期
    cycles: [
        { id: 1, status: 'closed', totalProfit: 100, profitRate: 10 },
        { id: 2, status: 'active', totalProfit: 50, profitRate: 5 }
    ],
    
    // 汇总统计
    summary: {
        totalCycles: 2,           // 总周期数
        closedCycles: 1,          // 已结束周期
        activeCycles: 1,          // 进行中周期
        
        totalInvest: 2000,        // 总投入
        totalProfit: 150,         // 总收益
        profitRate: 7.5,          // 总收益率
        
        // 当前持仓(仅active周期)
        currentHolding: {
            shares: 50,
            cost: 500,
            value: 550,
            floatingProfit: 50
        }
    }
}
```

## 算法实现

### 1. 识别持仓周期
```javascript
function identifyHoldingCycles(trades) {
    const cycles = [];
    let currentCycle = null;
    let holdingShares = 0;
    
    // 按日期排序
    const sortedTrades = trades.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    for (const trade of sortedTrades) {
        if (trade.type === 'buy') {
            // 买入
            if (holdingShares === 0) {
                // 开始新的持仓周期
                currentCycle = {
                    id: generateId(),
                    startDate: trade.date,
                    status: 'active',
                    trades: []
                };
                cycles.push(currentCycle);
            }
            
            holdingShares += trade.shares;
            currentCycle.trades.push(trade);
            
        } else if (trade.type === 'sell') {
            // 卖出
            holdingShares -= trade.shares;
            currentCycle.trades.push(trade);
            
            if (holdingShares === 0) {
                // 清仓，结束当前周期
                currentCycle.endDate = trade.date;
                currentCycle.status = 'closed';
                currentCycle = null;
            }
        }
    }
    
    return cycles;
}
```

### 2. 计算单个周期收益
```javascript
function calculateCycleProfit(cycle, currentNetValue) {
    let totalInvest = 0;
    let totalShares = 0;
    let holdingShares = 0;
    let holdingCost = 0;
    let realizedProfit = 0;
    
    // FIFO队列
    const holdingQueue = [];
    
    for (const trade of cycle.trades) {
        if (trade.type === 'buy') {
            const cost = trade.amount + trade.fee;
            totalInvest += cost;
            totalShares += trade.shares;
            holdingShares += trade.shares;
            holdingCost += cost;
            
            holdingQueue.push({
                shares: trade.shares,
                cost: cost,
                pricePerShare: cost / trade.shares
            });
            
        } else if (trade.type === 'sell') {
            holdingShares -= trade.shares;
            
            // FIFO匹配计算成本
            let remainingShares = trade.shares;
            let costAmount = 0;
            
            while (remainingShares > 0 && holdingQueue.length > 0) {
                const holding = holdingQueue[0];
                const matchShares = Math.min(remainingShares, holding.shares);
                const matchCost = holding.pricePerShare * matchShares;
                
                costAmount += matchCost;
                holding.shares -= matchShares;
                remainingShares -= matchShares;
                
                if (holding.shares <= 0) {
                    holdingQueue.shift();
                }
            }
            
            holdingCost -= costAmount;
            
            // 计算已实现收益
            const profit = trade.amount - costAmount - trade.fee;
            realizedProfit += profit;
        }
    }
    
    // 计算浮动收益
    const holdingValue = holdingShares * currentNetValue;
    const floatingProfit = holdingValue - holdingCost;
    
    // 周期总收益
    const totalProfit = realizedProfit + floatingProfit;
    const profitRate = totalInvest > 0 ? (totalProfit / totalInvest * 100) : 0;
    
    return {
        ...cycle,
        totalInvest,
        totalShares,
        holdingShares,
        holdingCost,
        holdingValue,
        realizedProfit,
        floatingProfit,
        totalProfit,
        profitRate
    };
}
```

### 3. 计算总收益
```javascript
function calculateTotalProfit(cycles) {
    let totalInvest = 0;
    let totalProfit = 0;
    let closedCycles = 0;
    let activeCycles = 0;
    
    let currentHolding = {
        shares: 0,
        cost: 0,
        value: 0,
        floatingProfit: 0
    };
    
    for (const cycle of cycles) {
        totalInvest += cycle.totalInvest;
        totalProfit += cycle.totalProfit;
        
        if (cycle.status === 'closed') {
            closedCycles++;
        } else {
            activeCycles++;
            // 累加当前持仓
            currentHolding.shares += cycle.holdingShares;
            currentHolding.cost += cycle.holdingCost;
            currentHolding.value += cycle.holdingValue;
            currentHolding.floatingProfit += cycle.floatingProfit;
        }
    }
    
    const profitRate = totalInvest > 0 ? (totalProfit / totalInvest * 100) : 0;
    
    return {
        cycles,
        summary: {
            totalCycles: cycles.length,
            closedCycles,
            activeCycles,
            totalInvest,
            totalProfit,
            profitRate,
            currentHolding
        }
    };
}
```

## 显示设计

### 详情页显示
```
持仓周期统计
├─ 总周期数: 2
├─ 已结束: 1
└─ 进行中: 1

周期1 (已结束)
├─ 时间: 2024-01-01 ~ 2024-02-01
├─ 投入: ¥1,000.00
├─ 收益: ¥100.00
└─ 收益率: 10.00%

周期2 (进行中)
├─ 时间: 2024-03-01 ~ 至今
├─ 投入: ¥1,000.00
├─ 已实现收益: ¥50.00
├─ 浮动收益: ¥50.00
├─ 总收益: ¥100.00
└─ 收益率: 10.00%

汇总
├─ 总投入: ¥2,000.00
├─ 总收益: ¥200.00
└─ 总收益率: 10.00%

当前持仓
├─ 持有份额: 50
├─ 持仓成本: ¥500.00
├─ 当前市值: ¥550.00
└─ 浮动收益: ¥50.00
```

## 实现计划

1. ✅ 设计数据结构和算法
2. ⏳ 修改Calculator.js实现新算法
3. ⏳ 修改detail.js显示持仓周期
4. ⏳ 添加持仓周期切换功能
5. ⏳ 测试多轮持仓场景
6. ⏳ 更新文档

## 注意事项

1. **向后兼容**: 旧数据需要能正确计算
2. **性能优化**: 大量交易时计算效率
3. **数据验证**: 确保交易记录合理性
4. **UI友好**: 清晰展示多周期信息

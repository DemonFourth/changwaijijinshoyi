# Holding-Info区域数据说明

## 数据项说明

### 1. 持有份额
- **含义**: 当前持有的基金份额总数
- **计算**: 累计买入份额 - 累计卖出份额
- **数据来源**: `summary.currentHolding.shares`

### 2. 持仓成本
- **含义**: 当前持仓的总成本（已扣除卖出部分）
- **计算**: 使用FIFO算法计算当前持仓的成本
- **数据来源**: `summary.currentHolding.cost`

### 3. 每份成本
- **含义**: 当前持仓的平均每份成本
- **计算**: 持仓成本 / 持有份额
- **数据来源**: 计算值 `currentHolding.cost / currentHolding.shares`

### 4. 当前市值
- **含义**: 当前持仓按最新净值计算的价值
- **计算**: 持有份额 × 当前净值
- **数据来源**: `summary.currentHolding.value`

### 5. 浮动盈亏
- **含义**: 当前持仓的未实现盈亏
- **计算**: 当前市值 - 持仓成本
- **数据来源**: `summary.currentHolding.floatingProfit`

### 6. 持仓收益率 ⚠️
- **含义**: 当前持仓的收益率（只计算浮动收益）
- **计算**: 浮动盈亏 / 持仓成本 × 100%
- **数据来源**: 计算值 `floatingProfit / cost * 100`
- **注意**: 这个收益率**不包含**已实现收益

### 7. 已实现收益
- **含义**: 已经卖出获得的收益
- **计算**: 累计卖出金额 - 对应的买入成本
- **数据来源**: `summary.totalRealizedProfit`

### 8. 总收益
- **含义**: 总收益 = 已实现收益 + 浮动收益
- **计算**: totalRealizedProfit + totalFloatingProfit
- **数据来源**: `summary.totalProfit`

### 9. 总收益率 ⭐
- **含义**: 真正的总收益率（包含所有收益）
- **计算**: 总收益 / 总投入 × 100%
- **数据来源**: `summary.profitRate`
- **注意**: 这个收益率**包含**已实现收益和浮动收益

## 两个收益率的区别

### 持仓收益率 vs 总收益率

**示例**:
```
总投入: ¥100,000
已实现收益: ¥5,294.27 (已卖出获得的收益)
浮动收益: ¥32,327.98 (当前持仓的浮动收益)
总收益: ¥37,622.25

持仓成本: ¥86,000 (当前持仓的成本)
当前市值: ¥118,327.98

持仓收益率 = 32,327.98 / 86,000 × 100% = 37.61%
总收益率 = 37,622.25 / 100,000 × 100% = 37.62%
```

**为什么不同？**
- 持仓收益率只计算当前持仓的浮动收益
- 总收益率计算所有收益（已实现 + 浮动）
- 如果有已实现收益，两者会不同

## 数据验证方法

在浏览器控制台运行:
```javascript
// 验证脚本
const funds = DataService.loadFunds();
const fund = funds[0];
const trades = TradeManager.getTradesByFund(fund.id);
const stats = CalculatorV2.calculateFundProfit(trades, fund.netValue);

console.log('持仓收益率:', (stats.summary.currentHolding.floatingProfit / stats.summary.currentHolding.cost * 100).toFixed(2) + '%');
console.log('总收益率:', stats.summary.profitRate.toFixed(2) + '%');
console.log('已实现收益:', stats.summary.totalRealizedProfit.toFixed(2));
console.log('浮动收益:', stats.summary.totalFloatingProfit.toFixed(2));
```

## 常见问题

### Q: 为什么持仓收益率和总收益率不同？
A: 因为持仓收益率只计算浮动收益，总收益率包含已实现收益。

### Q: 哪个收益率更准确？
A: 总收益率更准确，因为它反映了真实的投资回报。

### Q: 如果没有卖出，两个收益率会一样吗？
A: 是的，如果没有已实现收益，两个收益率会相同。

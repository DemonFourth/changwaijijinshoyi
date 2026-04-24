// 完整验证holding-info区域所有数据

console.log('\n=== Holding-Info数据验证 ===\n');

const funds = DataService.loadFunds();
const fund = funds[0];
const trades = TradeManager.getTradesByFund(fund.id);
const stats = CalculatorV2.calculateFundProfit(trades, fund.netValue);

console.log('1. 基金信息:');
console.log('   代码:', fund.code);
console.log('   名称:', fund.name);
console.log('   当前净值:', fund.netValue);

console.log('\n2. 交易记录汇总:');
let totalBuy = 0, totalSell = 0, totalBuyShares = 0, totalSellShares = 0;
trades.forEach(t => {
    if (t.type === 'buy') {
        totalBuy += parseFloat(t.amount);
        totalBuyShares += parseFloat(t.shares);
    } else if (t.type === 'sell') {
        totalSell += parseFloat(t.amount);
        totalSellShares += parseFloat(t.shares);
    }
});
console.log('   买入总额:', totalBuy.toFixed(2));
console.log('   买入份额:', totalBuyShares.toFixed(2));
console.log('   卖出总额:', totalSell.toFixed(2));
console.log('   危出份额:', totalSellShares.toFixed(2));
console.log('   当前持有份额:', (totalBuyShares - totalSellShares).toFixed(2));

console.log('\n3. CalculatorV2计算结果:');
const summary = stats.summary;
const holding = summary.currentHolding;

console.log('   === Summary ===');
console.log('   总投入:', summary.totalInvest.toFixed(2));
console.log('   总收益:', summary.totalProfit.toFixed(2));
console.log('   总收益率:', summary.profitRate.toFixed(2) + '%');
console.log('   已实现收益:', summary.totalRealizedProfit.toFixed(2));
console.log('   浮动收益:', summary.totalFloatingProfit.toFixed(2));

console.log('\n   === Current Holding ===');
console.log('   持有份额:', holding.shares.toFixed(2));
console.log('   持仓成本:', holding.cost.toFixed(2));
console.log('   当前市值:', holding.value.toFixed(2));
console.log('   浮动盈亏:', holding.floatingProfit.toFixed(2));

console.log('\n4. 手动验证计算:');
const currentShares = totalBuyShares - totalSellShares;
const currentNetValue = fund.netValue;
const currentValue = currentShares * currentNetValue;
console.log('   当前份额:', currentShares.toFixed(2));
console.log('   当前净值:', currentNetValue);
console.log('   当前市值:', currentValue.toFixed(2));
console.log('   (份额 × 净值)');

console.log('\n5. 持仓收益率计算:');
// 持仓收益率 = 浮动盈亏 / 持仓成本 × 100%
const holdingProfitRate = holding.cost > 0 ? (holding.floatingProfit / holding.cost * 100) : 0;
console.log('   持仓成本:', holding.cost.toFixed(2));
console.log('   浮动盈亏:', holding.floatingProfit.toFixed(2));
console.log('   持仓收益率:', holdingProfitRate.toFixed(2) + '%');
console.log('   (浮动盈亏 / 持仓成本 × 100%)');

console.log('\n6. 总收益率计算:');
// 总收益率 = 总收益 / 总投入 × 100%
const totalProfitRate = summary.totalInvest > 0 ? (summary.totalProfit / summary.totalInvest * 100) : 0;
console.log('   总投入:', summary.totalInvest.toFixed(2));
console.log('   总收益:', summary.totalProfit.toFixed(2));
console.log('   总收益率:', totalProfitRate.toFixed(2) + '%');
console.log('   (总收益 / 总投入 × 100%)');

console.log('\n7. 数据一致性检查:');
console.log('   总收益 = 已实现 + 浮动:', (summary.totalRealizedProfit + summary.totalFloatingProfit).toFixed(2));
console.log('   与stats.totalProfit比较:', summary.totalProfit.toFixed(2));
console.log('   差异:', Math.abs(summary.totalProfit - (summary.totalRealizedProfit + summary.totalFloatingProfit)).toFixed(6));

console.log('\n8. 每份成本:');
const costPerShare = holding.shares > 0 ? holding.cost / holding.shares : 0;
console.log('   每份成本:', costPerShare.toFixed(4));
console.log('   (持仓成本 / 持有份额)');

console.log('\n=== 验证结束 ===\n');

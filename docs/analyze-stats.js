// 在浏览器控制台运行此脚本，详细分析stats数据

const fundId = DataService.loadFunds()[0].id;
const stats = FundManager.getFundStats(fundId);

console.log('\n=== Stats数据详细分析 ===');
console.log('\n1. Summary:');
console.log('  totalProfit:', stats.summary.totalProfit);
console.log('  profitRate:', stats.summary.profitRate);
console.log('  totalRealizedProfit:', stats.summary.totalRealizedProfit);
console.log('  totalFloatingProfit:', stats.summary.totalFloatingProfit);
console.log('  totalInvest:', stats.summary.totalInvest);
console.log('  currentHolding:', stats.summary.currentHolding);

console.log('\n2. Cycles:');
stats.cycles.forEach((cycle, i) => {
    console.log(`\n  Cycle ${i + 1}:`);
    console.log('    status:', cycle.status);
    console.log('    totalInvest:', cycle.totalInvest);
    console.log('    totalProfit:', cycle.totalProfit);
    console.log('    profitRate:', cycle.profitRate);
    console.log('    holdingDays:', cycle.holdingDays);
    console.log('    trades count:', cycle.trades.length);
});

console.log('\n3. Backward Compatible:');
console.log('  holding:', stats.holding);
console.log('  realized:', stats.realized);
console.log('  total:', stats.total);

console.log('\n4. Raw trades:');
const trades = TradeManager.getTradesByFund(fundId);
console.log('  Total trades:', trades.length);
trades.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.type} ${t.amount} ${t.shares} shares on ${t.date}`);
});

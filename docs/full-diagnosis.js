// 完整诊断脚本 - 在浏览器控制台运行

console.log('\n=== 完整诊断开始 ===\n');

// 1. 获取基金和交易数据
const funds = DataService.loadFunds();
console.log('1. 基金数量:', funds.length);

if (funds.length === 0) {
    console.log('❌ 没有基金数据');
} else {
    const fund = funds[0];
    console.log('2. 基金信息:', fund.name, fund.code);
    console.log('   净值:', fund.netValue);

    // 2. 获取交易记录
    const trades = TradeManager.getTradesByFund(fund.id);
    console.log('3. 交易记录数量:', trades.length);

    if (trades.length === 0) {
        console.log('❌ 没有交易记录');
    } else {
        console.log('   交易记录:');
        trades.forEach((t, i) => {
            console.log(`   ${i + 1}. ${t.date} ${t.type} ¥${t.amount} (${t.shares}份)`);
        });

        // 3. 调用CalculatorV2计算
        console.log('\n4. CalculatorV2计算:');
        const result = CalculatorV2.calculateFundProfit(trades, fund.netValue);

        console.log('   Cycles数量:', result.cycles.length);
        result.cycles.forEach((cycle, i) => {
            console.log(`\n   Cycle ${i + 1}:`);
            console.log('     Status:', cycle.status);
            console.log('     Start:', cycle.startDate);
            console.log('     End:', cycle.endDate || '进行中');
            console.log('     Total Invest:', cycle.totalInvest);
            console.log('     Total Profit:', cycle.totalProfit);
            console.log('     Profit Rate:', cycle.profitRate);
            console.log('     Holding Days:', cycle.holdingDays);
            console.log('     Holding Shares:', cycle.holdingShares);
            console.log('     Holding Cost:', cycle.holdingCost);
            console.log('     Holding Value:', cycle.holdingValue);
            console.log('     Floating Profit:', cycle.floatingProfit);
            console.log('     Realized Profit:', cycle.realizedProfit);
        });

        console.log('\n5. Summary:');
        console.log('   Total Cycles:', result.summary.totalCycles);
        console.log('   Closed Cycles:', result.summary.closedCycles);
        console.log('   Active Cycles:', result.summary.activeCycles);
        console.log('   Total Invest:', result.summary.totalInvest);
        console.log('   Total Profit:', result.summary.totalProfit);
        console.log('   Profit Rate:', result.summary.profitRate);
        console.log('   Total Realized:', result.summary.totalRealizedProfit);
        console.log('   Total Floating:', result.summary.totalFloatingProfit);

        console.log('\n6. Current Holding:');
        console.log('   Shares:', result.summary.currentHolding.shares);
        console.log('   Cost:', result.summary.currentHolding.cost);
        console.log('   Value:', result.summary.currentHolding.value);
        console.log('   Floating:', result.summary.currentHolding.floatingProfit);

        console.log('\n7. Backward Compatible:');
        console.log('   holding:', result.holding);
        console.log('   realized:', result.realized);
        console.log('   total:', result.total);
    }
}

console.log('\n=== 诊断结束 ===\n');

// ============================================
// 完整诊断脚本 - 在主页面控制台运行
// ============================================

console.log('========== 完整诊断 ==========\n');

// 1. 获取基金
const funds = DataService.loadFunds();
const fund = funds[0];
console.log(`基金: ${fund.name} (${fund.code})`);
console.log(`基金ID: ${fund.id}`);
console.log(`当前净值: ${fund.netValue}\n`);

// 2. 获取交易记录
const trades = DataService.getTradesByFund(fund.id);
console.log(`交易记录数: ${trades.length}\n`);

// 3. 按日期排序
trades.sort((a, b) => new Date(a.date) - new Date(b.date));

// 4. 详细分析每笔交易
console.log('=== 交易明细 ===');
let cumulativeShares = 0;
let cumulativeCost = 0;

trades.forEach((t, i) => {
    const shares = parseFloat(t.shares);
    const amount = parseFloat(t.amount);
    const fee = parseFloat(t.fee);
    const netValue = parseFloat(t.netValue || 0);
    
    let costChange = 0;
    if (t.type === 'buy') {
        cumulativeShares += shares;
        costChange = amount + fee;
        cumulativeCost += costChange;
    } else {
        cumulativeShares -= shares;
        // 卖出时按比例减少成本
        if (cumulativeShares + shares > 0) {
            costChange = -cumulativeCost * shares / (cumulativeShares + shares);
            cumulativeCost += costChange;
        }
    }
    
    const typeText = t.type === 'buy' ? '买入' : '卖出';
    console.log(`${i+1}. ${t.date} | ${typeText}`);
    console.log(`   净值: ${netValue.toFixed(4)}`);
    console.log(`   份额: ${shares}`);
    console.log(`   金额: ${amount.toFixed(2)}`);
    console.log(`   手续费: ${fee.toFixed(2)}`);
    console.log(`   累计份额: ${cumulativeShares.toFixed(2)}`);
    console.log(`   累计成本: ${cumulativeCost.toFixed(2)}`);
    
    if (cumulativeShares < 0) {
        console.error('   ❌ 错误: 累计份额为负数！');
    }
    console.log('');
});

// 5. 统计
let buyCount = 0, sellCount = 0;
let buyShares = 0, sellShares = 0;
let buyAmount = 0, sellAmount = 0, sellFee = 0;

trades.forEach(t => {
    const shares = parseFloat(t.shares);
    const amount = parseFloat(t.amount);
    const fee = parseFloat(t.fee);
    
    if (t.type === 'buy') {
        buyCount++;
        buyShares += shares;
        buyAmount += amount;
    } else {
        sellCount++;
        sellShares += shares;
        sellAmount += amount;
        sellFee += fee;
    }
});

console.log('=== 统计 ===');
console.log(`买入: ${buyCount}笔, ${buyShares}份, ${buyAmount.toFixed(2)}元`);
console.log(`卖出: ${sellCount}笔, ${sellShares}份, ${sellAmount.toFixed(2)}元, 手续费${sellFee.toFixed(2)}元`);
console.log(`剩余份额: ${buyShares - sellShares}份`);

// 6. 使用Calculator计算
console.log('\n=== Calculator计算结果 ===');
const stats = Calculator.calculateFundProfit(trades, fund.netValue);

console.log('持仓信息:');
console.log(`  份额: ${stats.holding.shares.toFixed(2)}`);
console.log(`  成本: ${stats.holding.cost.toFixed(2)} 元`);
console.log(`  每份成本: ${stats.holding.costPerShare.toFixed(4)} 元`);
console.log(`  市值: ${stats.holding.value.toFixed(2)} 元`);
console.log(`  持仓收益: ${stats.holding.profit.toFixed(2)} 元`);
console.log(`  持仓收益率: ${stats.holding.profitRate.toFixed(2)}%`);

console.log('\n已实现收益:');
console.log(`  总额: ${stats.realized.profit.toFixed(2)} 元`);

if (stats.realized.details.length > 0) {
    console.log('  明细:');
    let totalRealized = 0;
    stats.realized.details.forEach((d, i) => {
        if (d.type === 'dividend') {
            console.log(`    ${i+1}. 分红: ${d.amount.toFixed(2)}元`);
            totalRealized += d.amount;
        } else {
            console.log(`    ${i+1}. 危出:`);
            console.log(`       份额: ${d.shares}`);
            console.log(`       危出金额: ${d.sellAmount.toFixed(2)}元`);
            console.log(`       成本: ${d.costAmount.toFixed(2)}元`);
            console.log(`       手续费: ${d.fee.toFixed(2)}元`);
            console.log(`       收益: ${d.profit.toFixed(2)}元`);
            totalRealized += d.profit;
        }
    });
    console.log(`  计算总和: ${totalRealized.toFixed(2)}元`);
}

console.log('\n总收益:');
console.log(`  金额: ${stats.total.amount.toFixed(2)} 元`);
console.log(`  收益率: ${stats.total.rate.toFixed(2)}%`);

// 7. 验证计算
console.log('\n=== 验证计算 ===');
const expectedHoldingShares = buyShares - sellShares;
console.log(`预期持仓份额: ${expectedHoldingShares}`);
console.log(`实际持仓份额: ${stats.holding.shares.toFixed(2)}`);
console.log(`匹配: ${Math.abs(expectedHoldingShares - stats.holding.shares) < 0.01 ? '✅' : '❌'}`);

// 8. 检查收益率是否变化
console.log('\n=== 收益率变化检查 ===');
console.log('如果添加卖出后收益率不变，可能原因:');
console.log('1. 危出收益被持仓亏损抵消');
console.log('2. 计算公式问题');
console.log('3. 数据未刷新');

// 计算简单收益率
const simpleReturn = sellAmount - sellFee - (buyAmount * sellShares / buyShares);
console.log(`\n简单估算卖出收益: ${simpleReturn.toFixed(2)}元`);
console.log(`实际已实现收益: ${stats.realized.profit.toFixed(2)}元`);

console.log('\n========== 诊断完成 ==========');

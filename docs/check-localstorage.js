// 检查localStorage数据

console.log('\n=== LocalStorage数据检查 ===\n');

// 检查基金数据
const fundsData = localStorage.getItem('funds');
console.log('1. Funds数据:');
if (fundsData) {
    const funds = JSON.parse(fundsData);
    console.log('   基金数量:', funds.length);
    funds.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.name} (${f.code})`);
        console.log(`      ID: ${f.id}`);
        console.log(`      净值: ${f.netValue}`);
    });
} else {
    console.log('   ❌ 没有基金数据');
}

// 检查交易数据
const tradesData = localStorage.getItem('trades');
console.log('\n2. Trades数据:');
if (tradesData) {
    const trades = JSON.parse(tradesData);
    console.log('   交易数量:', trades.length);
    trades.forEach((t, i) => {
        console.log(`   ${i + 1}. FundID: ${t.fundId}`);
        console.log(`      ${t.date} ${t.type} ¥${t.amount} (${t.shares}份)`);
    });
} else {
    console.log('   ❌ 没有交易数据');
}

console.log('\n=== 检查结束 ===\n');

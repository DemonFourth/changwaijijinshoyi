// 正确的修复脚本 - 使用正确的API

console.log('\n=== 修复基金名称 ===\n');

const funds = DataService.loadFunds();
const fund = funds[0];

console.log('当前名称:', fund.name);
console.log('基金代码:', fund.code);
console.log('基金ID:', fund.id);

// 获取新数据
FundAPI.getFundData(fund.code, false).then(data => {
    console.log('\n获取到的新数据:');
    console.log('名称:', data.name);
    console.log('净值:', data.netValue);
    console.log('估算净值:', data.estimatedValue);

    // 使用正确的API更新
    const updates = {
        name: data.name,
        netValue: data.netValue,
        netValueDate: data.netValueDate,
        estimatedValue: data.estimatedValue,
        estimatedDate: data.estimatedDate,
        estimatedGrowth: data.estimatedGrowth,
        updateTime: data.updateTime
    };

    // 正确的调用方式：传入fundId和updates
    const success = DataService.updateFund(fund.id, updates);

    if (success) {
        console.log('\n✅ 数据已更新！');
        console.log('正在刷新页面...');

        setTimeout(() => {
            location.reload();
        }, 1000);
    } else {
        console.error('❌ 更新失败');
    }
}).catch(err => {
    console.error('❌ 获取数据失败:', err);
});

console.log('\n=== 开始获取数据 ===\n');

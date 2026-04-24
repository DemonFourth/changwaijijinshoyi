// 快速修复基金名称乱码

console.log('\n=== 快速修复基金名称 ===\n');

const funds = DataService.loadFunds();
const fund = funds[0];

console.log('当前名称:', fund.name);
console.log('基金代码:', fund.code);

// 重新获取数据
FundAPI.fetchFundData(fund.code).then(data => {
    console.log('\n获取到的新数据:');
    console.log('名称:', data.name);
    console.log('净值:', data.netValue);
    console.log('估算净值:', data.estimatedValue);

    // 更新基金数据
    const updatedFund = {
        ...fund,
        name: data.name,
        netValue: data.netValue,
        netValueDate: data.netValueDate,
        estimatedValue: data.estimatedValue,
        estimatedDate: data.estimatedDate,
        estimatedGrowth: data.estimatedGrowth,
        updateTime: data.updateTime
    };

    // 保存
    DataService.updateFund(updatedFund);

    console.log('\n✅ 数据已更新！');
    console.log('请刷新页面查看效果');

    // 自动刷新页面
    setTimeout(() => {
        location.reload();
    }, 1000);
}).catch(err => {
    console.error('❌ 获取数据失败:', err);
    console.log('\n手动修复方法:');
    console.log('1. 删除该基金');
    console.log('2. 重新添加基金');
});

console.log('\n=== 开始获取数据 ===\n');

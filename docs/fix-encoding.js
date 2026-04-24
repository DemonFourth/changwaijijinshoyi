// 检查和修复基金名称编码问题

console.log('\n=== 基金名称编码检查 ===\n');

const funds = DataService.loadFunds();
const fund = funds[0];

console.log('1. 当前基金名称:', fund.name);
console.log('2. 字符编码:', Array.from(fund.name).slice(0, 10).map(c => `${c}(${c.charCodeAt(0)})`));
console.log('3. 是否包含中文:', /[\u4e00-\u9fa5]/.test(fund.name));

// 检查localStorage原始数据
const fundsData = localStorage.getItem('funds');
if (fundsData) {
    const parsed = JSON.parse(fundsData);
    console.log('\n4. localStorage中的数据:');
    console.log('   名称:', parsed[0].name);
    console.log('   字符编码:', Array.from(parsed[0].name).slice(0, 10).map(c => `${c}(${c.charCodeAt(0)})`));
}

// 尝试重新获取数据
console.log('\n5. 尝试重新获取基金数据...');
FundAPI.fetchFundData(fund.code).then(data => {
    console.log('   新数据:', data);
    console.log('   名称:', data.name);
    console.log('   是否包含中文:', /[\u4e00-\u9fa5]/.test(data.name));

    // 更新数据
    const updatedFund = { ...fund, ...data };
    DataService.updateFund(updatedFund);
    console.log('\n✅ 数据已更新，请刷新页面');
}).catch(err => {
    console.error('❌ 获取数据失败:', err);
});

console.log('\n=== 检查结束 ===\n');

// 在控制台运行此脚本查看fund对象的完整结构

const funds = DataService.loadFunds();
console.log('=== 基金对象完整结构 ===');
funds.forEach(fund => {
    console.log('\n基金:', fund.name);
    console.log('完整对象:', fund);
    console.log('所有字段:');
    Object.keys(fund).forEach(key => {
        console.log(`  ${key}: ${fund[key]}`);
    });
});

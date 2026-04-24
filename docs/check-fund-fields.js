// 检查fund对象的完整字段

console.log('\n=== Fund对象字段检查 ===\n');

const funds = DataService.loadFunds();
const fund = funds[0];

console.log('1. Fund对象:');
console.log(fund);

console.log('\n2. 所有字段:');
Object.keys(fund).forEach(key => {
    console.log(`   ${key}: ${fund[key]}`);
});

console.log('\n3. API返回的原始数据:');
// 检查localStorage中的原始数据
const fundsData = localStorage.getItem('funds');
if (fundsData) {
    const funds = JSON.parse(fundsData);
    console.log('   原始数据:', funds[0]);
}

console.log('\n=== 检查结束 ===\n');

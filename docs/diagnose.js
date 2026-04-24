// 诊断脚本：检查所有数据源
console.log('=== 数据源诊断 ===\n');

// 1. 检查localStorage
console.log('1. 检查localStorage...');
const localStorageData = localStorage.getItem('funds');
if (localStorageData) {
    try {
        const parsed = JSON.parse(localStorageData);
        console.log('localStorage基金数量:', parsed.length);
        parsed.forEach((fund, i) => {
            const hasChinese = /[\u4e00-\u9fa5]/.test(fund.name);
            console.log(`[${i}] ${fund.code}: "${fund.name}" ${hasChinese ? '✅' : '❌ 乱码'}`);
        });
    } catch (e) {
        console.error('localStorage解析失败:', e);
    }
} else {
    console.log('localStorage中没有基金数据');
}

// 2. 检查API缓存
console.log('\n2. 检查API缓存...');
if (FundAPI.cache && FundAPI.cache.size > 0) {
    console.log('API缓存大小:', FundAPI.cache.size);
    FundAPI.cache.forEach((value, key) => {
        const hasChinese = /[\u4e00-\u9fa5]/.test(value.data.name);
        console.log(`${key}: "${value.data.name}" ${hasChinese ? '✅' : '❌ 乱码'}`);
    });
} else {
    console.log('API缓存为空');
}

// 3. 检查统计缓存
console.log('\n3. 检查统计缓存...');
if (FundManager._statsCache && FundManager._statsCache.size > 0) {
    console.log('统计缓存大小:', FundManager._statsCache.size);
} else {
    console.log('统计缓存为空');
}

// 4. 检查DataService缓存
console.log('\n4. 检查DataService缓存...');
if (DataService.fundsCache) {
    console.log('DataService缓存基金数量:', DataService.fundsCache.length);
    DataService.fundsCache.forEach((fund, i) => {
        const hasChinese = /[\u4e00-\u9fa5]/.test(fund.name);
        console.log(`[${i}] ${fund.code}: "${fund.name}" ${hasChinese ? '✅' : '❌ 乱码'}`);
    });
} else {
    console.log('DataService缓存为空');
}

// 5. 测试API直接获取
console.log('\n5. 测试API直接获取...');
const testCode = '519732';
console.log('测试基金代码:', testCode);

FundAPI.getFundData(testCode, false).then(data => {
    console.log('API返回数据:');
    console.log('  基金代码:', data.code);
    console.log('  基金名称:', data.name);
    console.log('  是否中文:', /[\u4e00-\u9fa5]/.test(data.name));
    console.log('  净值:', data.netValue);
    console.log('  估算净值:', data.estimatedValue);
    console.log('  估算涨跌:', data.estimatedGrowth);
}).catch(err => {
    console.error('API获取失败:', err);
});

console.log('\n=== 诊断完成 ===');
console.log('如果看到乱码，请运行修复脚本：');
console.log('1. 清除localStorage: localStorage.removeItem("funds")');
console.log('2. 清除API缓存: FundAPI.clearCache()');
console.log('3. 刷新页面: location.reload()');

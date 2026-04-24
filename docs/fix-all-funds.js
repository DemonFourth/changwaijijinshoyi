// 彻底修复基金名称乱码问题

console.log('\n=== 彻底修复基金名称乱码 ===\n');

// 1. 检查当前数据
const funds = DataService.loadFunds();
console.log('1. 当前基金数据:');
funds.forEach((fund, i) => {
    console.log(`   ${i + 1}. ${fund.name} (${fund.code})`);
    console.log(`      字符编码:`, Array.from(fund.name).slice(0, 10).map(c => `${c}(${c.charCodeAt(0)})`));
    console.log(`      是否中文:`, /[\u4e00-\u9fa5]/.test(fund.name));
});

// 2. 重新获取并修复所有基金
async function fixAllFunds() {
    console.log('\n2. 开始修复所有基金...');
    
    for (const fund of funds) {
        console.log(`\n   修复基金: ${fund.code}`);
        
        try {
            // 重新获取数据
            const apiData = await FundAPI.getFundData(fund.code, false);
            console.log(`   API返回名称: ${apiData.name}`);
            console.log(`   是否中文:`, /[\u4e00-\u9fa5]/.test(apiData.name));
            
            // 更新基金数据
            const updates = {
                name: apiData.name,
                netValue: apiData.netValue,
                netValueDate: apiData.netValueDate,
                estimatedValue: apiData.estimatedValue,
                estimatedDate: apiData.estimatedDate,
                estimatedGrowth: apiData.estimatedGrowth,
                updateTime: apiData.updateTime
            };
            
            const success = DataService.updateFund(fund.id, updates);
            console.log(`   更新结果:`, success ? '✅ 成功' : '❌ 失败');
            
            // 等待一下避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`   获取失败:`, error.message);
        }
    }
    
    console.log('\n3. 修复完成，正在刷新页面...');
    setTimeout(() => {
        location.reload();
    }, 2000);
}

// 3. 检查DataService的存储逻辑
console.log('\n4. 检查DataService存储逻辑...');
const fundsData = localStorage.getItem('funds');
if (fundsData) {
    const parsed = JSON.parse(fundsData);
    console.log('   localStorage中的原始数据:');
    parsed.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.name} (${f.code})`);
    });
}

// 4. 检查fundAPI的编码处理
console.log('\n5. 检查fundAPI编码处理...');
console.log('   FundAPI.parseJSONPResponse中已有编码修复逻辑:');
console.log('   - 检查是否包含中文字符');
console.log('   - 如果不包含，尝试UTF-8解码修复');

// 5. 执行修复
console.log('\n=== 开始修复 ===\n');
fixAllFunds();

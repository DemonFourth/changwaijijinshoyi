// 最简单的修复方案
console.log('=== 最简单的修复方案 ===\n');

async function simpleFix() {
    try {
        console.log('步骤1: 清除所有缓存');
        FundAPI.clearCache();
        console.log('✅ API缓存已清除');
        
        console.log('\n步骤2: 获取基金数据');
        const funds = DataService.loadFunds();
        console.log('当前基金数量:', funds.length);
        
        for (const fund of funds) {
            console.log(`\n处理基金: ${fund.code}`);
            console.log('当前名称:', fund.name);
            
            // 直接调用API，不使用缓存
            const apiData = await FundAPI.getFundData(fund.code, false);
            console.log('API返回名称:', apiData.name);
            
            // 更新数据
            DataService.updateFund(fund.id, {
                name: apiData.name,
                netValue: apiData.netValue,
                netValueDate: apiData.netValueDate,
                estimatedValue: apiData.estimatedValue,
                estimatedDate: apiData.estimatedDate,
                estimatedGrowth: apiData.estimatedGrowth,
                updateTime: apiData.updateTime
            });
            
            console.log('✅ 已更新');
        }
        
        console.log('\n✅ 修复完成，刷新页面...');
        setTimeout(() => location.reload(), 1000);
        
    } catch (error) {
        console.error('修复失败:', error);
    }
}

// 执行
simpleFix();

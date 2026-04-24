// 完整修复方案：清除所有缓存并重新获取数据
console.log('=== 完整修复方案 ===\n');

async function completeFix() {
    try {
        console.log('步骤1: 清除所有缓存...');
        
        // 清除API缓存
        FundAPI.clearCache();
        console.log('✅ API缓存已清除');
        
        // 清除统计缓存
        if (FundManager.clearStatsCache) {
            FundManager.clearStatsCache();
            console.log('✅ 统计缓存已清除');
        }
        
        console.log('\n步骤2: 获取当前基金数据...');
        const funds = DataService.loadFunds();
        
        if (!funds || funds.length === 0) {
            console.log('❌ 没有找到基金数据');
            return;
        }
        
        console.log(`找到 ${funds.length} 个基金`);
        
        console.log('\n步骤3: 重新获取所有基金数据...');
        for (let i = 0; i < funds.length; i++) {
            const fund = funds[i];
            console.log(`\n[${i + 1}/${funds.length}] 处理基金: ${fund.code}`);
            console.log('当前名称:', fund.name);
            
            // 强制不使用缓存，重新获取
            const apiData = await FundAPI.getFundData(fund.code, false);
            console.log('API返回名称:', apiData.name);
            console.log('是否中文:', /[\u4e00-\u9fa5]/.test(apiData.name));
            
            // 更新基金数据
            const success = DataService.updateFund(fund.id, {
                name: apiData.name,
                netValue: apiData.netValue,
                netValueDate: apiData.netValueDate,
                estimatedValue: apiData.estimatedValue,
                estimatedDate: apiData.estimatedDate,
                estimatedGrowth: apiData.estimatedGrowth,
                updateTime: apiData.updateTime
            });
            
            if (success) {
                console.log('✅ 更新成功');
            } else {
                console.log('❌ 更新失败');
            }
        }
        
        console.log('\n步骤4: 验证修复结果...');
        const updatedFunds = DataService.loadFunds();
        updatedFunds.forEach(fund => {
            const hasChinese = /[\u4e00-\u9fa5]/.test(fund.name);
            console.log(`${fund.code}: ${fund.name} ${hasChinese ? '✅' : '❌'}`);
        });
        
        console.log('\n✅ 修复完成！2秒后刷新页面...');
        setTimeout(() => {
            location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('修复过程中出错:', error);
        console.error(error.stack);
    }
}

// 执行修复
completeFix();

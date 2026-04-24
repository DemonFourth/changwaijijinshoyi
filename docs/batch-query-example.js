// 批量查询使用示例
console.log('=== 批量查询使用示例 ===\n');

// 示例1: 添加多个基金
async function addMultipleFunds() {
    const fundCodes = [
        '519732', // 交银定期支付双息平衡混合
        '000001', // 华夏成长混合
        '110022', // 易方达消费行业股票
        '161725', // 招商中证白酒指数分级
        '519778', // 交银新成长混合
        '000011', // 华夏大盘精选混合
        '040008', // 华安策略优选混合
        '161005', // 富国天惠精选成长混合
        '519678', // 交银施罗德成长混合
        '000751'  // 嘉实新兴产业混合
    ];
    
    console.log(`准备添加 ${fundCodes.length} 个基金...`);
    
    try {
        // 批量获取数据（并发数5）
        const results = await FundAPI.batchGetFundData(fundCodes, 5);
        
        console.log(`获取成功: ${results.length} 个基金`);
        
        // 添加到系统
        let addedCount = 0;
        for (const data of results) {
            const fund = {
                id: Utils.generateId(),
                code: data.code,
                name: data.name,
                netValue: data.netValue,
                netValueDate: data.netValueDate,
                estimatedValue: data.estimatedValue,
                estimatedDate: data.estimatedDate,
                estimatedGrowth: data.estimatedGrowth,
                createTime: new Date().toISOString(),
                updateTime: new Date().toISOString()
            };
            
            const success = DataService.addFund(fund);
            if (success) {
                addedCount++;
                console.log(`✅ 添加成功: ${fund.code} - ${fund.name}`);
            } else {
                console.log(`⚠️ 已存在: ${fund.code}`);
            }
        }
        
        console.log(`\n✅ 完成！成功添加 ${addedCount} 个基金`);
        
    } catch (error) {
        console.error('批量添加失败:', error);
    }
}

// 示例2: 刷新所有基金数据
async function refreshAllFunds() {
    console.log('刷新所有基金数据...');
    
    try {
        await FundManager.refreshAllFunds();
        console.log('✅ 刷新完成');
    } catch (error) {
        console.error('刷新失败:', error);
    }
}

// 示例3: 自定义并发数
async function customConcurrency() {
    const fundCodes = ['519732', '000001', '110022', '161725', '519778'];
    
    console.log('测试不同并发数:');
    
    // 并发数1（串行）
    console.log('\n并发数1（串行）:');
    const start1 = Date.now();
    await FundAPI.batchGetFundData(fundCodes, 1);
    console.log(`耗时: ${Date.now() - start1}ms`);
    
    // 并发数3
    console.log('\n并发数3:');
    const start3 = Date.now();
    await FundAPI.batchGetFundData(fundCodes, 3);
    console.log(`耗时: ${Date.now() - start3}ms`);
    
    // 并发数5（默认）
    console.log('\n并发数5（默认）:');
    const start5 = Date.now();
    await FundAPI.batchGetFundData(fundCodes, 5);
    console.log(`耗时: ${Date.now() - start5}ms`);
}

// 使用说明
console.log('使用方法:');
console.log('1. addMultipleFunds() - 添加多个基金');
console.log('2. refreshAllFunds() - 刷新所有基金数据');
console.log('3. customConcurrency() - 测试不同并发数');
console.log('\n推荐并发数: 3-5（避免API压力过大）');

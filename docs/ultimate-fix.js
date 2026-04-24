// 终极修复方案：删除并重新添加基金

console.log('\n=== 终极修复：删除并重新添加基金 ===\n');

const funds = DataService.loadFunds();
console.log('当前基金数量:', funds.length);

if (funds.length === 0) {
    console.log('❌ 没有基金数据');
} else {
    const fund = funds[0];
    console.log('当前基金:', fund.name, '(', fund.code, ')');
    console.log('基金ID:', fund.id);
    
    // 保存基金代码
    const fundCode = fund.code;
    
    // 删除基金
    console.log('\n1. 删除基金...');
    const deleted = DataService.deleteFund(fund.id);
    console.log('删除结果:', deleted ? '✅ 成功' : '❌ 失败');
    
    if (deleted) {
        console.log('\n2. 重新添加基金...');
        
        // 重新获取数据
        FundAPI.getFundData(fundCode, false).then(data => {
            console.log('获取到的新数据:');
            console.log('名称:', data.name);
            console.log('是否中文:', /[\u4e00-\u9fa5]/.test(data.name));
            
            // 创建新的基金对象
            const newFund = {
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
            
            console.log('\n3. 添加新基金...');
            const added = DataService.addFund(newFund);
            console.log('添加结果:', added ? '✅ 成功' : '❌ 失败');
            
            if (added) {
                console.log('\n✅ 修复完成！正在刷新页面...');
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                console.error('❌ 添加失败');
            }
        }).catch(err => {
            console.error('❌ 获取数据失败:', err);
        });
    }
}

console.log('\n=== 执行结束 ===\n');

// 立即修复基金名称乱码问题
console.log('=== 立即修复基金名称乱码 ===\n');

// 方法1: 直接重新获取并更新基金数据
async function fixFundNameImmediately() {
    try {
        console.log('1. 获取当前基金数据...');
        const funds = DataService.loadFunds();
        
        if (!funds || funds.length === 0) {
            console.log('❌ 没有找到基金数据');
            return;
        }
        
        const fund = funds[0];
        console.log('当前基金:', fund.name, '(', fund.code, ')');
        
        console.log('\n2. 重新从API获取数据...');
        const apiData = await FundAPI.getFundData(fund.code, false);
        console.log('API返回数据:', apiData);
        console.log('API基金名称:', apiData.name);
        console.log('是否中文:', /[\u4e00-\u9fa5]/.test(apiData.name));
        
        console.log('\n3. 更新基金数据...');
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
            console.log('✅ 基金数据更新成功！');
            console.log('新名称:', apiData.name);
            
            console.log('\n4. 刷新页面...');
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            console.error('❌ 更新失败');
        }
    } catch (error) {
        console.error('修复过程中出错:', error);
    }
}

// 方法2: 手动修复乱码
function fixGarbledNameManually() {
    console.log('\n=== 手动修复乱码 ===');
    console.log('乱码分析:');
    console.log('"浜ら摱" = "交银" (UTF-8: E4 BA A4 E9 93 B6)');
    console.log('"瀹氭湡" = "定期" (UTF-8: E5 AE 9A E6 9C 9F)');
    console.log('"鏀粯" = "支付" (UTF-8: E6 94 AF E4 BB 98)');
    console.log('"鍙屾伅" = "双息" (UTF-8: E5 8F 8C E6 81 AF)');
    console.log('"骞宠　" = "平衡" (UTF-8: E5 B9 B3 E8 A1 A1)');
    console.log('"娣峰悎" = "混合" (UTF-8: E6 B7 B7 E5 90 88)');
    
    const funds = DataService.loadFunds();
    if (funds && funds.length > 0) {
        const fund = funds[0];
        const correctName = '交银定期支付双息平衡混合';
        
        console.log('\n当前名称:', fund.name);
        console.log('正确名称:', correctName);
        
        const success = DataService.updateFund(fund.id, {
            name: correctName
        });
        
        if (success) {
            console.log('✅ 手动修复成功！');
            console.log('刷新页面查看效果...');
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }
}

// 执行修复
console.log('选择修复方式:');
console.log('1. 自动重新获取数据 (推荐)');
console.log('2. 手动修复乱码');
console.log('\n执行: fixFundNameImmediately() 或 fixGarbledNameManually()');

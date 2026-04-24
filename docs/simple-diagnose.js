// 简化诊断：找出真正的问题
console.log('=== 简化诊断 ===\n');

// 1. 直接测试API
console.log('1. 直接测试API...');
const testCode = '519732';
const url = `http://fundgz.1234567.com.cn/js/${testCode}.js`;

// 临时回调
window.testCallback = function(data) {
    console.log('✅ API直接返回:');
    console.log('  基金名称:', data.name);
    console.log('  是否中文:', /[\u4e00-\u9fa5]/.test(data.name));
    
    // 2. 测试FundAPI
    console.log('\n2. 测试FundAPI...');
    FundAPI.getFundData(testCode, false).then(result => {
        console.log('✅ FundAPI返回:');
        console.log('  基金名称:', result.name);
        console.log('  是否中文:', /[\u4e00-\u9fa5]/.test(result.name));
        
        // 3. 检查localStorage
        console.log('\n3. 检查localStorage...');
        const stored = localStorage.getItem('funds');
        if (stored) {
            const funds = JSON.parse(stored);
            const fund = funds.find(f => f.code === testCode);
            if (fund) {
                console.log('✅ localStorage中:');
                console.log('  基金名称:', fund.name);
                console.log('  是否中文:', /[\u4e00-\u9fa5]/.test(fund.name));
            } else {
                console.log('❌ localStorage中没有该基金');
            }
        }
        
        // 4. 检查DataService
        console.log('\n4. 检查DataService...');
        const allFunds = DataService.loadFunds();
        const dsFund = allFunds.find(f => f.code === testCode);
        if (dsFund) {
            console.log('✅ DataService中:');
            console.log('  基金名称:', dsFund.name);
            console.log('  是否中文:', /[\u4e00-\u9fa5]/.test(dsFund.name));
        }
        
        console.log('\n=== 诊断完成 ===');
        console.log('如果API返回正常，但localStorage或DataService乱码，');
        console.log('说明问题在数据保存或读取过程中。');
    }).catch(err => {
        console.error('❌ FundAPI错误:', err);
    });
};

const script = document.createElement('script');
script.src = url;
document.head.appendChild(script);

// 测试批量查询功能
console.log('=== 测试批量查询 ===\n');

// 测试数据：多个基金代码
const testFundCodes = [
    '519732', // 交银定期支付双息平衡混合
    '000001', // 华夏成长混合
    '110022', // 易方达消费行业股票
    '161725', // 招商中证白酒指数分级
    '519778'  // 交银新成长混合
];

console.log('测试基金数量:', testFundCodes.length);
console.log('基金代码:', testFundCodes.join(', '));

// 方法1: 串行查询（当前实现）
async function testSerialQuery() {
    console.log('\n--- 方法1: 串行查询 ---');
    const startTime = Date.now();
    
    const results = [];
    for (const code of testFundCodes) {
        try {
            const data = await FundAPI.getFundData(code, false);
            results.push(data);
            console.log(`✅ ${code}: ${data.name}`);
        } catch (error) {
            console.error(`❌ ${code}: ${error.message}`);
        }
    }
    
    const endTime = Date.now();
    console.log(`\n串行查询耗时: ${endTime - startTime}ms`);
    console.log(`成功数量: ${results.length}/${testFundCodes.length}`);
    
    return results;
}

// 方法2: 并行查询（batchGetFundData）
async function testBatchQuery() {
    console.log('\n--- 方法2: 并行查询 (batchGetFundData) ---');
    const startTime = Date.now();
    
    try {
        const results = await FundAPI.batchGetFundData(testFundCodes);
        
        const endTime = Date.now();
        console.log(`\n并行查询耗时: ${endTime - startTime}ms`);
        console.log(`成功数量: ${results.length}/${testFundCodes.length}`);
        
        results.forEach(data => {
            console.log(`✅ ${data.code}: ${data.name}`);
        });
        
        return results;
    } catch (error) {
        console.error('批量查询失败:', error);
        return [];
    }
}

// 方法3: Promise.all并行查询
async function testPromiseAll() {
    console.log('\n--- 方法3: Promise.all并行查询 ---');
    const startTime = Date.now();
    
    const promises = testFundCodes.map(code => 
        FundAPI.getFundData(code, false).catch(err => {
            console.error(`❌ ${code}: ${err.message}`);
            return null;
        })
    );
    
    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);
    
    const endTime = Date.now();
    console.log(`\nPromise.all耗时: ${endTime - startTime}ms`);
    console.log(`成功数量: ${validResults.length}/${testFundCodes.length}`);
    
    validResults.forEach(data => {
        console.log(`✅ ${data.code}: ${data.name}`);
    });
    
    return validResults;
}

// 执行测试
async function runTests() {
    console.log('开始测试...\n');
    
    // 测试串行查询
    await testSerialQuery();
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试并行查询
    await testBatchQuery();
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试Promise.all
    await testPromiseAll();
    
    console.log('\n=== 测试完成 ===');
    console.log('结论:');
    console.log('- 串行查询: 逐个请求，耗时最长');
    console.log('- 并行查询: 同时发起所有请求，耗时最短');
    console.log('- Promise.all: 与并行查询相同');
}

runTests();

// 测试JSONP解析修复
console.log('=== 测试JSONP解析修复 ===\n');

// 模拟JSONP响应字符串
const jsonpResponse = 'jsonpgz({"fundcode":"519732","name":"浜ら摱瀹氭湡鏀粯鍙屾伅骞宠　娣峰悎","jzrq":"2026-04-23","dwjz":"8.0370","gsz":"7.9392","gszzl":"-1.22","gztime":"2026-04-24 13:31"});';

console.log('1. 原始JSONP字符串:');
console.log(jsonpResponse);

// 测试解析逻辑
function parseJSONPString(jsonpString) {
    console.log('\n2. 解析JSONP字符串...');
    console.log('输入类型:', typeof jsonpString);
    
    try {
        // 移除jsonpgz(和末尾的);
        const jsonString = jsonpString.replace(/^[^(]*\(|\);?$/g, '');
        console.log('清理后的JSON字符串:', jsonString);
        
        const parsedData = JSON.parse(jsonString);
        console.log('解析成功:', parsedData);
        console.log('基金代码:', parsedData.fundcode);
        console.log('基金名称:', parsedData.name);
        console.log('名称类型:', typeof parsedData.name);
        
        // 检查是否是乱码
        const hasChinese = /[\u4e00-\u9fa5]/.test(parsedData.name);
        console.log('是否包含中文字符:', hasChinese);
        
        // 检查乱码模式
        const isLikelyGarbled = parsedData.name.includes('浜ら摱') || 
            parsedData.name.includes('瀹氭湡') ||
            parsedData.name.includes('鏀粯') ||
            parsedData.name.includes('鍙屾伅') ||
            parsedData.name.includes('骞宠　') ||
            parsedData.name.includes('娣峰悎');
        console.log('是否乱码:', isLikelyGarbled);
        
        if (isLikelyGarbled) {
            console.log('\n3. 尝试修复乱码...');
            const originalName = parsedData.name;
            
            // 方法1: GBK解码
            const bytes = new Uint8Array(originalName.length);
            for (let i = 0; i < originalName.length; i++) {
                bytes[i] = originalName.charCodeAt(i);
            }
            
            // 尝试GBK解码
            const decoder = new TextDecoder('gbk');
            const gbkDecoded = decoder.decode(bytes);
            console.log('GBK解码结果:', gbkDecoded);
            console.log('GBK解码是否中文:', /[\u4e00-\u9fa5]/.test(gbkDecoded));
            
            // 尝试UTF-8解码
            const utf8Decoder = new TextDecoder('utf-8');
            const utf8Decoded = utf8Decoder.decode(bytes);
            console.log('UTF-8解码结果:', utf8Decoded);
            console.log('UTF-8解码是否中文:', /[\u4e00-\u9fa5]/.test(utf8Decoded));
            
            // 显示字符编码
            console.log('\n4. 字符编码分析:');
            console.log('原始字符串:', originalName);
            console.log('字符序列:');
            for (let i = 0; i < Math.min(originalName.length, 20); i++) {
                const char = originalName[i];
                const code = char.charCodeAt(0);
                console.log(`  [${i}] '${char}' = ${code} (0x${code.toString(16)})`);
            }
        }
        
        return parsedData;
    } catch (e) {
        console.error('解析失败:', e);
        return null;
    }
}

// 执行测试
const result = parseJSONPString(jsonpResponse);

console.log('\n=== 测试完成 ===');
console.log('如果看到"交银定期支付双息平衡混合"则表示修复成功！');

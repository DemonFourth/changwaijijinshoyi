# 开发规范与最佳实践

> 本文档记录了项目开发过程中遇到的所有问题、解决方案和最佳实践，确保不同开发者或AI Agent能够遵循统一的规范，避免重复问题。

## 目录

1. [代码规范](#代码规范)
2. [常见问题与解决方案](#常见问题与解决方案)
3. [架构设计原则](#架构设计原则)
4. [测试规范](#测试规范)
5. [Git提交规范](#git提交规范)
6. [文档规范](#文档规范)

---

## 代码规范

### 1. 对象方法调用规范 ⚠️ 重要

**问题**: 在对象方法内部调用同一对象的其他方法时，使用`this`可能导致作用域解析异常。

**错误示例**:
```javascript
const MyObject = {
    methodA() {
        // ❌ 错误：this可能不指向MyObject
        const result = this.methodB();
        return result;
    },
    
    methodB() {
        return { success: true };
    }
};
```

**正确示例**:
```javascript
const MyObject = {
    methodA() {
        // ✅ 正确：使用明确的对象名
        const result = MyObject.methodB();
        return result;
    },
    
    methodB() {
        // ✅ 如果需要调用其他方法，也使用对象名
        const data = MyObject.methodC();
        return { success: true, data };
    },
    
    methodC() {
        return { data: 'test' };
    }
};
```

**替代方案**（如果必须使用函数引用）:
```javascript
methodA() {
    // 创建函数引用
    const methodB = MyObject.methodB;
    // 使用call明确指定this上下文
    const result = methodB.call(MyObject, args);
    return result;
}
```

**适用场景**:
- 所有模块对象（TradeManager, FundManager, DataService等）
- 事件处理器中的方法调用
- 回调函数中的方法调用

### 2. 模块定义规范

**标准模块结构**:
```javascript
/**
 * 模块说明
 * @version 1.0.0
 */

const ModuleName = {
    /**
     * 初始化方法
     */
    init() {
        console.log('ModuleName initialized');
    },
    
    /**
     * 公共方法
     * @param {type} param - 参数说明
     * @returns {type} 返回值说明
     */
    publicMethod(param) {
        // 实现
    },
    
    // 私有方法（以下划线开头）
    _privateMethod() {
        // 实现
    }
};

// 注册到模块系统
ModuleRegistry.register('ModuleName', ModuleName);
```

### 3. 命名规范

**变量命名**:
```javascript
// ✅ 好的命名
const fundId = 'xxx';
const tradeData = {};
const totalAmount = 0;

// ❌ 不好的命名
const id = 'xxx';  // 不明确
const data = {};   // 太泛化
const total = 0;   // 缺少上下文
```

**函数命名**:
```javascript
// ✅ 动词开头，明确意图
function getFundById(id) { }
function addTrade(trade) { }
function validateTradeData(data) { }
function calculateReturn(fund) { }

// ❌ 不好的命名
function fund(id) { }      // 不是动词
function trade(trade) { }  // 与参数同名
function check(data) { }   // 不明确检查什么
```

**常量命名**:
```javascript
// ✅ 全大写，下划线分隔
const API_BASE_URL = 'http://example.com';
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT = 5000;
```

### 4. 错误处理规范

**统一错误处理**:
```javascript
// ✅ 使用try-catch包裹可能出错的代码
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('fetchData error:', error);
        Utils.showToast('获取数据失败', 'error');
        return null;
    }
}

// ✅ 验证函数返回统一格式
function validateData(data) {
    const errors = [];
    
    if (!data.id) {
        errors.push('ID不能为空');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
```

### 5. 异步处理规范

**Promise使用**:
```javascript
// ✅ 使用async/await
async function loadData() {
    try {
        const data = await DataService.load();
        return data;
    } catch (error) {
        console.error('Load failed:', error);
        return null;
    }
}

// ❌ 避免回调地狱
function loadData(callback) {
    DataService.load(function(data) {
        process(data, function(result) {
            save(result, function() {
                // 嵌套太深
            });
        });
    });
}
```

---

## 常见问题与解决方案

### 问题1: 函数未定义错误

**症状**:
```
Uncaught TypeError: this.methodName is not a function
```

**原因**: 
在对象方法内部使用`this`调用其他方法时，作用域解析异常。

**解决方案**:
```javascript
// 修改前
this.methodName()

// 修改后
ObjectName.methodName()
```

**预防措施**:
- 所有模块内部方法调用都使用明确的对象名
- 代码审查时检查所有`this.`调用
- ESLint规则检查（可配置）

### 问题2: CORS跨域错误

**症状**:
```
Access to fetch at 'http://example.com' from origin 'null' has been blocked by CORS policy
```

**原因**: 
使用file://协议打开HTML，或API不支持CORS。

**解决方案**:
```javascript
// 使用JSONP代替fetch
function fetchJSONP(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    window.callback = (data) => {
        callback(data);
        document.head.removeChild(script);
        delete window.callback;
    };
    document.head.appendChild(script);
}
```

**预防措施**:
- 外部API调用优先考虑JSONP
- 或使用代理服务器
- 或配置CORS头（如果有服务器控制权）

### 问题3: 编码问题（乱码）

**症状**:
中文字符显示为乱码。

**原因**: 
API返回的编码与预期不符。

**解决方案**:
```javascript
// 检测并修复编码
if (data && data.name) {
    const hasChinese = /[\u4e00-\u9fa5]/.test(data.name);
    if (!hasChinese) {
        // 尝试不同的解码方式
        data.name = decodeURIComponent(escape(data.name));
    }
}
```

**预防措施**:
- 明确API的编码格式
- 添加编码检测逻辑
- 提供编码配置选项

### 问题4: 路由问题（file://协议）

**症状**:
```
Failed to execute 'pushState' on 'History'
```

**原因**: 
History API在file://协议下不可用。

**解决方案**:
```javascript
// 使用hash路由代替
function navigate(path) {
    window.location.hash = path;
}

// 监听hash变化
window.addEventListener('hashchange', () => {
    const path = window.location.hash.slice(1);
    handleRoute(path);
});
```

**预防措施**:
- 优先使用hash路由
- 或使用本地服务器（如http-server）
- 添加协议检测和降级处理

### 问题5: 浏览器缓存问题

**症状**:
修改代码后，浏览器仍使用旧代码。

**解决方案**:
```bash
# 1. 硬刷新
Ctrl + F5 或 Ctrl + Shift + R

# 2. 清除缓存
Chrome: Ctrl + Shift + Delete

# 3. 添加版本参数
<script src="js/app.js?v=1.0.0"></script>

# 4. 禁用缓存（开发时）
Chrome DevTools -> Network -> Disable cache
```

**预防措施**:
- 每次重要修改后提醒清除缓存
- 使用版本号或时间戳
- 配置服务器缓存策略

---

## 架构设计原则

### 1. 模块化原则

**单一职责**:
```javascript
// ✅ 每个模块只负责一件事
const TradeManager = {
    // 只负责交易相关
    addTrade() { },
    deleteTrade() { },
    getTrades() { }
};

const FundManager = {
    // 只负责基金相关
    addFund() { },
    deleteFund() { },
    getFunds() { }
};
```

**依赖注入**:
```javascript
// ✅ 通过参数传递依赖
function calculateReturn(fund, trades, calculator) {
    return calculator.calculate(fund, trades);
}

// ❌ 避免硬编码依赖
function calculateReturn(fund) {
    const trades = DataService.getTrades(); // 硬编码
    return Calculator.calculate(fund, trades);
}
```

### 2. 事件驱动原则

**模块间通信**:
```javascript
// ✅ 使用事件总线
EventBus.emit(EventType.FUND_ADDED, { fund });

EventBus.on(EventType.FUND_ADDED, (data) => {
    // 处理基金添加事件
});

// ❌ 避免直接调用其他模块
FundManager.addFund(fund);
TradeManager.refresh(); // 紧耦合
```

### 3. 数据流原则

**单向数据流**:
```
用户操作 -> 事件触发 -> 数据更新 -> UI更新
```

**示例**:
```javascript
// 1. 用户操作
button.onclick = () => {
    // 2. 触发事件
    EventBus.emit(EventType.ADD_TRADE, tradeData);
};

// 3. 数据更新
EventBus.on(EventType.ADD_TRADE, (data) => {
    TradeManager.addTrade(data);
});

// 4. UI更新
EventBus.on(EventType.TRADE_ADDED, (trade) => {
    DetailPage.refresh();
});
```

---

## 测试规范

### 1. 单元测试

**测试文件命名**: `test-{模块名}.html`

**测试结构**:
```javascript
// 测试函数
function test(description, fn) {
    try {
        fn();
        console.log(`✅ ${description}`);
    } catch (error) {
        console.error(`❌ ${description}`, error);
    }
}

// 断言函数
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// 测试用例
test('addTrade should validate input', () => {
    const result = TradeManager.addTrade({});
    assert(result === null, 'Should return null for invalid input');
});
```

### 2. 集成测试

**测试流程**:
```javascript
// 1. 准备数据
const fund = await FundManager.addFund({ code: '519732' });

// 2. 执行操作
const trade = TradeManager.addTrade({
    fundId: fund.id,
    type: 'buy',
    shares: 100,
    amount: 1000
});

// 3. 验证结果
assert(trade !== null, 'Trade should be added');
assert(trade.fundId === fund.id, 'Trade should belong to fund');
```

---

## Git提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type类型**:
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档修改
- `style`: 代码格式修改（不影响功能）
- `refactor`: 重构（不是新功能也不是bug修复）
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**:
```bash
# 新功能
git commit -m "feat: 添加基金搜索功能"

# Bug修复
git commit -m "fix: 修复交易记录添加时的this上下文问题"

# 文档
git commit -m "docs: 更新README中的API说明"

# 重构
git commit -m "refactor: 重构计算引擎，提高性能"
```

### 分支管理

**分支命名**:
- `master`: 主分支
- `develop`: 开发分支
- `feature/xxx`: 功能分支
- `fix/xxx`: 修复分支
- `release/x.x.x`: 发布分支

**工作流**:
```bash
# 1. 创建功能分支
git checkout -b feature/add-search

# 2. 开发并提交
git add .
git commit -m "feat: 添加搜索功能"

# 3. 合并到develop
git checkout develop
git merge feature/add-search

# 4. 发布到master
git checkout master
git merge develop
git tag v1.1.0
```

---

## 文档规范

### 1. 代码注释

**函数注释**:
```javascript
/**
 * 计算基金收益
 * @param {Object} fund - 基金对象
 * @param {Array} trades - 交易记录数组
 * @returns {Object} 收益结果
 * @returns {number} returns.holdingReturn - 持仓收益
 * @returns {number} returns.realizedReturn - 已实现收益
 * @returns {number} returns.totalReturn - 总收益
 */
function calculateReturn(fund, trades) {
    // 实现
}
```

**复杂逻辑注释**:
```javascript
// 使用FIFO算法计算成本
// 1. 按买入时间排序
// 2. 从最早的买入开始匹配卖出
// 3. 计算每笔卖出的成本和收益
const sortedTrades = trades.sort((a, b) => 
    new Date(a.date) - new Date(b.date)
);
```

### 2. README文档

**标准结构**:
```markdown
# 项目名称

简短描述

## 功能特性

## 快速开始

## 项目结构

## API文档

## 开发指南

## 常见问题

## 版本历史

## 许可证
```

### 3. 问题文档

**记录格式**:
```markdown
## 问题标题

### 症状
描述问题的表现

### 原因
分析问题的根本原因

### 解决方案
提供详细的解决步骤

### 预防措施
如何避免类似问题
```

---

## 检查清单

### 代码提交前检查

- [ ] 代码符合命名规范
- [ ] 所有`this.`调用已替换为对象名
- [ ] 错误处理完整
- [ ] 添加了必要的注释
- [ ] ESLint检查通过
- [ ] Stylelint检查通过
- [ ] 功能测试通过
- [ ] 文档已更新

### 新功能开发检查

- [ ] 遵循单一职责原则
- [ ] 使用事件驱动通信
- [ ] 数据验证完整
- [ ] 错误提示友好
- [ ] 添加了测试用例
- [ ] 更新了文档

---

## 附录

### A. 常用工具函数

```javascript
// 生成唯一ID
Utils.generateId() // 'mobime5rbd61hf92t'

// 格式化数字
Utils.formatNumber(1234.5678, 2) // '1,234.57'

// 格式化日期
Utils.formatDate(new Date()) // '2024-01-19'

// 显示提示
Utils.showToast('操作成功', 'success')
Utils.showToast('操作失败', 'error')
```

### B. 事件类型

```javascript
// 基金相关
EventType.FUND_ADDED
EventType.FUND_UPDATED
EventType.FUND_DELETED

// 交易相关
EventType.TRADE_ADDED
EventType.TRADE_UPDATED
EventType.TRADE_DELETED

// 数据相关
EventType.DATA_IMPORTED
EventType.DATA_EXPORTED
```

### C. 配置项

```javascript
// API配置
Config.get('api.baseUrl')
Config.get('api.timeout')

// 存储配置
Config.get('storage.prefix')
Config.get('storage.maxSize')

// UI配置
Config.get('ui.pageSize')
Config.get('ui.dateFormat')
```

---

## 更新日志

### v1.0.0 (2024-04-24)
- 初始版本
- 记录所有开发过程中遇到的问题
- 建立统一的开发规范
- 提供最佳实践指南

---

**注意**: 本文档会持续更新，每次遇到新问题或改进时都应该更新相应章节。

**贡献**: 如果发现新的问题或有更好的解决方案，请更新本文档。

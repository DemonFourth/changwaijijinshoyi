# 场外基金收益计算器

一个用于计算场外基金（支付宝买卖的基金）收益的Web应用。

## 功能特性

### 核心功能
- ✅ 基金管理：添加、编辑、删除基金
- ✅ 实时数据：自动获取基金净值数据
- ✅ 交易记录：记录买入、卖出、分红等交易
- ✅ FIFO计算：先进先出成本计算算法
- ✅ 收益统计：持仓收益、已实现收益、总收益
- ✅ 数据持久化：LocalStorage本地存储
- ✅ 数据导入导出：JSON格式数据备份

### 技术特性
- 🎯 纯前端实现，无需后端服务
- 🎯 响应式设计，支持移动端
- 🎯 模块化架构，易于维护扩展
- 🎯 事件驱动，模块解耦
- 🎯 GB2312编码处理，正确解析基金API数据

## 快速开始

### 1. 打开应用
直接在浏览器中打开 `index.html` 文件即可使用。

### 2. 添加基金
1. 点击右上角"添加基金"按钮
2. 输入6位基金代码（如：519732）
3. 点击确定，系统会自动获取基金信息

### 3. 添加交易记录
1. 点击基金卡片进入详情页
2. 点击"添加交易"按钮
3. 填写交易信息：
   - 交易日期
   - 交易类型（买入/卖出/分红）
   - 份额
   - 金额
   - 手续费
4. 点击确定保存

### 4. 查看收益
- 汇总页：查看所有基金的总体收益情况
- 详情页：查看单只基金的详细收益分析

## 项目结构

```
jijinshouyi/
├── index.html              # 主页面
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── namespace.js       # 全局命名空间
│   ├── moduleRegistry.js  # 模块注册器
│   ├── eventBus.js        # 事件总线
│   ├── config.js          # 配置管理
│   ├── utils.js           # 工具函数
│   ├── storage.js         # 存储管理
│   ├── dataService.js     # 数据服务
│   ├── fundAPI.js         # 基金API
│   ├── calculator.js      # 计算引擎
│   ├── fundManager.js     # 基金管理器
│   ├── tradeManager.js    # 交易管理器
│   ├── router.js          # 路由管理
│   ├── modal.js           # 弹窗管理
│   ├── overview.js        # 汇总页
│   ├── detail.js          # 详情页
│   └── app.js             # 应用入口
├── docs/
│   ├── DIAGNOSIS.md       # 问题诊断文档
│   └── SOLUTION.md        # 解决方案文档
├── tests/
│   ├── test-api.html      # API测试
│   ├── test-debug.html    # 调试测试
│   ├── test-simple.html   # 简单测试
│   └── test-tradeManager.html  # TradeManager测试
└── README.md              # 说明文档
```

## 核心算法

### FIFO（先进先出）成本计算

当卖出基金时，按照买入的时间顺序计算成本：

1. **买入操作**：将买入记录加入持仓队列
2. **卖出操作**：
   - 从队列头部开始匹配份额
   - 按买入价格计算成本
   - 计算已实现收益 = 卖出金额 - 成本 - 手续费
3. **持仓成本**：当前持仓的总成本
4. **每份成本**：持仓成本 / 持有份额

### 收益计算

- **持仓收益** = 当前市值 - 持仓成本
- **已实现收益** = 所有卖出交易的收益总和
- **总收益** = 持仓收益 + 已实现收益
- **收益率** = 总收益 / 总投入 × 100%

## API说明

### 基金数据API
- **地址**：`http://fundgz.1234567.com.cn/js/{基金代码}.js`
- **格式**：JSONP（GB2312编码）
- **示例**：`http://fundgz.1234567.com.cn/js/519732.js`

### 返回数据格式
```javascript
jsonpgz({
    "fundcode": "519732",      // 基金代码
    "name": "万家行业优选混合",  // 基金名称
    "dwjz": "1.2345",          // 单位净值
    "jzrq": "2024-01-18",      // 净值日期
    "gsz": "1.2350",           // 估算净值
    "gztime": "2024-01-19",    // 估算日期
    "gszzl": "0.12"            // 估算增长率
})
```

## 数据存储

### LocalStorage键名
- `fund_calculator_funds`：基金数据
- `fund_calculator_trades`：交易记录
- `fund_calculator_settings`：应用设置
- `fund_calculator_theme`：主题设置

### 数据导出格式
```json
{
    "version": "1.0.0",
    "exportTime": "2024-01-19T10:00:00.000Z",
    "funds": [...],
    "trades": [...],
    "settings": {...}
}
```

## 浏览器兼容性

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## 注意事项

1. **基金代码**：必须是6位数字
2. **交易日期**：格式为 YYYY-MM-DD
3. **份额和金额**：必须大于0
4. **卖出限制**：卖出份额不能超过持有份额
5. **数据备份**：建议定期导出数据备份

## 开发说明

### 模块系统
应用采用自定义的模块注册系统：
```javascript
// 注册模块
ModuleRegistry.register('ModuleName', ModuleObject);

// 获取模块
const module = ModuleRegistry.get('ModuleName');
```

### 事件系统
模块间通过事件总线通信：
```javascript
// 订阅事件
EventBus.on(EventType.FUND_ADDED, (data) => {
    console.log('Fund added:', data);
});

// 触发事件
EventBus.emit(EventType.FUND_ADDED, { fund });
```

### 配置管理
统一管理应用配置：
```javascript
// 获取配置
const timeout = Config.get('api.timeout');

// 设置配置
Config.set('api.timeout', 15000);
```

## 版本历史

### v1.0.0 (2024-01-19)
- ✅ 初始版本发布
- ✅ 实现核心功能
- ✅ FIFO收益计算
- ✅ 基金API集成
- ✅ 数据导入导出

## 许可证

MIT License

## 作者

CodeArts Agent

## 反馈与建议

如有问题或建议，欢迎反馈！

# 场外基金收益计算器 - AGENTS.md

## 项目概述

**名称**：场外基金收益计算器 (fund-return-calculator)
**类型**：纯前端Web应用（无需后端服务）
**技术栈**：原生HTML/CSS/JavaScript + ECharts + LocalStorage

---

## 构建/测试/Lint命令

```bash
# 全部lint检查（JS + CSS）
npm run lint

# 仅JS检查
npm run lint:js

# 仅CSS检查
npm run lint:css

# 自动修复lint问题
npm run lint:fix

# 运行所有测试
npm test

# 运行单个测试文件
node --test tests/routerNavigation.test.cjs

# 运行匹配模式的测试
node --test tests/*.test.cjs
node --test tests/fund*.test.cjs
node --test tests/*sync*.test.cjs
```

---

## 代码风格指南

### 基本规则
- **缩进**：4个空格
- **引号**：单引号
- **分号**：必须
- **尾逗号**：不允许
- **变量声明**：优先使用`const`，其次`let`，禁止`var`
- **比较运算符**：使用`===` / `!==`，禁止`==` / `!`

### 函数与代码块
- 禁止空函数（可添加注释说明用途）
- 禁止多个连续空格
- 文件末尾保留一个换行符
- 禁止行尾空格

### 命名约定
- 构造函数/类：`PascalCase`（如`FundManager`,`TradeAppService`）
- 变量/函数：`camelCase`（如`fundList`,`calculateFee`）
- 常量：`UPPER_SNAKE_CASE`（如`SYNC_INTERVAL`）
- 私有变量/方法：`_`前缀（如`_internalState`）

### 禁止项
- 禁止`eval()`
- 禁止隐式`eval`
- 禁止`new Function()`
- 禁止在定义前使用变量
- 禁止变量遮蔽（shadowing）
- 禁止稀疏数组

### 注释规范
- 对象方法内部禁止使用`this`调用其他方法，应使用明确的对象名
- 复杂逻辑需添加说明注释
- 禁止无意义的空注释

---

## 导入与模块

### 全局对象（已声明）
项目使用全局对象模式，已在`.eslintrc.js`中声明：
```
FundCalculator, ModuleRegistry, EventBus, EventType, Config, Utils,
Storage, DataService, FundAPI, Calculator, CalculatorV2, FundManager,
TradeManager, Router, Modal, Overview, Detail, App, ThemeManager,
ChartManager, CycleGroupRenderer, CycleTradeDisplay, Paginator,
NameCache, NameValidator, FIFOCalculator, FIFOValidator,
BigNumberFormatter, echarts, ConversionCalculator, ToolPage
```

### 模块组织约定
- 页面层（`overview.js`, `detail.js`, `modal.js`）：负责页面编排、事件绑定、调用helper/service
- 业务写操作优先走application层：`js/application/*.js`
  - 基金相关：`FundAppService`
  - 交易相关：`TradeAppService`
  - 设置/导入导出：`AppSettingsService`
- 数据读取优先通过manager或repository
- 持久化统一通过`LocalStorageAdapter`与`StorageSchema`

---

## 数据模型

### Fund（基金对象）
```javascript
{
  id: string,           // 唯一标识
  name: string,        // 基金名称
  code: string,        // 基金代码
  netValue: number,    // 最新净值
  feeTiers: {          // 费率配置
    buyTiers: [{ minAmount, maxAmount, rate }],
    sellTiers: [{ minDays, maxDays, rate }]
  }
}
```

### Trade（交易记录）
```javascript
{
  id: string,          // 唯一标识
  fundId: string,      // 所属基金ID
  date: string,        // 交易日期
  type: 'buy'|'sell'|'dividend',
  netValue: number,    // 净值
  shares: number,      // 份额
  amount: number,      // 金额
  fee: number,         // 手续费
  remark: string,
  dividendMode: 'cash'|'reinvest'
}
```

---

## 计算引擎说明

### 加权平均成本法（`calculatorV2.js`）
- 用途：计算持仓成本和收益
- 买入：持仓总成本 += 买入金额（含手续费）
- 卖出：持仓总成本 -= 卖出份额 × 持仓成本价

### 浮动盈亏计算方法
```javascript
// 浮动盈亏（使用最新净值）- 详情页"浮动盈亏"字段
CalculatorV2.calculateFloatingProfit(trades, fund)
// 返回: { shares, cost, value, floatingProfit, profitRate }

// 预估浮动盈亏（使用估算净值）- 详情页"预估浮动盈亏"字段
CalculatorV2.calculateEstimatedFloatingProfit(trades, fund)
// 返回: { shares, cost, value, floatingProfit, profitRate }
```
- **浮动盈亏**：用 `netValue`（最新净值）计算，反映当前实际盈亏
- **预估浮动盈亏**：用 `estimatedValue`（估算净值）计算，反映盘后预估算盈亏
- 两者公式相同：`floatingProfit = 持有份额 × 净值 - 持仓成本`，但使用的净值不同

### FIFO（`fifoCalculator.js` + `feeCalculator.js`）
- 用途：计算卖出手续费（根据持有天数匹配费率）
- 费率区间为左闭右开：`minDays <= 持有天数 < maxDays`
- 持有天数 = 卖出日期 - 买入日期（向下取整）

---

## 开发规范

### 代码检查
每次修改后必须运行lint检查：
```bash
npm run lint    # 全部检查
npm run lint:fix  # 自动修复
```

### Git提交
- 每次修改后需要提交git记录
- 提交信息应简洁描述修改内容

### 目录约定
```
js/
├── application/    # 用例编排（FundAppService等）
├── repositories/  # 仓储访问
├── storage/       # schema、migration、adapter、sync
├── modal/         # modal相关helper
├── detail/        # detail页相关helper
└── *.js           # 核心模块
```

### 重要约束
- 计算结果（持仓、收益、手续费建议、分组结果）保持运行时生成，不持久化
- 云端同步范围仅限`funds`、`trades`、`syncMeta`
- 修改数据模型、存储、application层、detail/modal/overview关键路径时，必须补或更新测试

---

## 测试规范

### 测试文件命名
`tests/*.test.cjs`

### 运行单个测试
```bash
node --test tests/routerNavigation.test.cjs
```

### 测试框架
使用Node.js内置`node:test`模块（CommonJS格式）

---

## 常见问题

### 禁止在对象方法内部使用`this`
```javascript
// 错误
Method: function() {
  this.doSomething();
}

// 正确
Method: function() {
  ObjectName.doSomething();
}
```

### 金额单位转换
- 买入费率存储单位：元
- UI显示单位：万元（÷10000）
- 匹配规则：`minAmount <= 买入金额 < maxAmount`（左闭右开）

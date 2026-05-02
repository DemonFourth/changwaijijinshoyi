# 场外基金收益计算器

## 项目概述

**项目名称**：场外基金收益计算器 (fund-return-calculator)
**版本**：v2.3.0
**类型**：纯前端Web应用（无需后端服务）
**核心功能**：场外基金（支付宝买卖的基金）收益计算，支持交易记录、加权平均成本法、多轮持仓分组、收益统计、费率配置与自动计算

## 项目结构

```
jijinshouyi/
├── index.html              # 主页面
├── css/
│   ├── tokens.css        # CSS设计令牌（浅色+深色主题变量）
│   └── style.css        # 样式文件
├── js/
│   ├── namespace.js       # 全局命名空间
│   ├── moduleRegistry.js # 模块注册器
│   ├── eventBus.js      # 事件总线
│   ├── config.js       # 配置管理
│   ├── utils.js         # 工具函数
│   ├── themeManager.js  # 主题管理
│   ├── bigNumberFormatter.js # 大数字格式化
│   ├── paginator.js    # 分页组件
│   ├── storage.js      # 存储管理
│   ├── dataService.js # 数据服务
│   ├── fundAPI.js     # 基金API
│   ├── calculatorV2.js # 计算引擎（加权平均成本法）
│   ├── fifoCalculator.js # FIFO计算引擎
│   ├── fifoValidator.js # FIFO验证器
│   ├── feeCalculator.js # 费率计算引擎（买入金额+卖出FIFO持有天数）
│   ├── fundManager.js  # 基金管理器
│   ├── tradeManager.js # 交易管理器
│   ├── chartManager.js # ECharts图表管理
│   ├── router.js      # 路由管理
│   ├── modal.js       # 弹窗管理
│   ├── nameValidator.js # 名称验证
│   ├── nameCache.js  # 名称缓存
│   ├── cycleGroupRenderer.js # 持仓分组渲染
│   ├── cycleTradeDisplay.js # 分组交易显示
│   ├── overview.js   # 汇总页
│   ├── detail.js      # 详情页
│   └── app.js         # 应用入口
├── lib/
│   └── echarts.min.js # ECharts图表库
└── README.md         # 说明文档
```

## 数据模型

### Fund（基金对象）
```javascript
{
  id: string,           // 唯一标识
  name: string,         // 基金名称
  code: string,         // 基金代码
  netValue: number,     // 最新净值
  netValueDate: string, // 净值日期
  estimatedValue: number,  // 估算净值
  estimatedGrowth: number, // 估算涨跌幅
  updateTime: string,   // 更新时间
  remark: string,       // 备注
  feeTiers: {           // 费率配置
    buyTiers: [{        // 买入费率区间（按金额，存储单位：元）
      minAmount: number,  // 最低金额（元）
      maxAmount: number|null, // 最高金额（元），null表示无上限
      rate: number        // 费率百分比
    }],
    sellTiers: [{       // 卖出费率区间（按持有天数）
      minDays: number,    // 最低天数
      maxDays: number|null, // 最高天数，null表示无上限
      rate: number        // 费率百分比
    }]
  }
}
```

### Trade（交易记录）
```javascript
{
  id: string,           // 唯一标识
  fundId: string,       // 所属基金ID
  date: string,         // 交易日期
  type: string,         // 'buy' | 'sell' | 'dividend'
  netValue: number,     // 净值
  shares: number,       // 份额
  amount: number,       // 金额
  fee: number,          // 手续费
  remark: string,       // 备注
  dividendMode: string  // 'cash' | 'reinvest'（分红模式）
}
```

## DOM结构

### 页面结构
- `#app` 应用容器
  - `.header` 标题栏（含导出/导入/主题切换/设置按钮）
  - `#main-content` 主内容区
    - `#page-overview` 汇总页
      - `.stats-container` 统计卡片区（总投入/总市值/总收益/收益率）
      - `.top5-container` Top5盈亏榜单
      - `.fund-list-container` 基金列表容器（卡片/列表双视图）
      - `.chart-container` 图表区域（收益趋势）
    - `#page-detail` 详情页
      - `.detail-actions` 操作按钮区（返回/编辑/删除）
      - `.fund-info` 基金信息卡片
      - `.holding-info` 持仓信息卡片
      - `.cycle-info-section` 持仓周期区域
      - `.fee-tiers-section` **交易费率设置区域**
        - `.fee-tiers-header` 可折叠标题
        - `.fee-tiers-content` 内容区
          - `.fee-tiers-grid` 两列布局
            - `.fee-tier-group` 买入费率组（按金额区间，万元单位显示）
            - `.fee-tier-group` 卖出费率组（按持有天数，左闭右开区间）
          - `.fee-tiers-actions` 保存/取消按钮
      - `.trade-records` 交易记录表格
      - `.chart-section` 图表分析区
  - `.fab-container` 悬浮按钮（刷新数据）
- `#modal-container` 弹窗容器
  - 交易表单弹窗（添加/编辑交易）
    - 手续费输入框下方含 `#fee-suggestion-panel` 费率参考面板
- `#loading` 加载提示
- `#toast` 提示消息

## 技术栈

- **前端框架**：原生HTML/CSS/JavaScript（无框架）
- **图表库**：ECharts（本地）
- **数据存储**：LocalStorage
- **模块系统**：自定义模块注册系统
- **事件系统**：自定义事件总线
- **样式系统**：CSS变量设计令牌

## 计算引擎

项目使用**两种计算方法**，分别用于不同目的：

### 1. 加权平均成本法（移动加权平均）
**用途**：计算基金持仓成本和收益
**文件**：`calculatorV2.js`

**核心规则**：
- **买入**：持仓总成本 += 买入金额（含手续费）
- **卖出**：持仓总成本 -= 卖出份额 × 持仓成本价（成本价不变）
- **持仓成本价** = 持仓总成本 / 持仓总份额
- 每次买入后重新计算持仓成本价

**特点**：
- 与股票不同，场外基金采用加权平均成本法，而非FIFO
- 支持多轮持仓周期识别（持仓份额归零时结束一个周期）
- 适用于计算盈亏、持仓成本等核心指标

### 2. FIFO（先进先出）
**用途**：计算卖出时的手续费（根据持有天数匹配费率）
**文件**：`fifoCalculator.js`、`feeCalculator.js`

**核心规则**：
- 按买入时间顺序构建FIFO队列
- 卖出时从最早买入批次依次扣减
- 一笔卖出可能跨多个买入批次，分别计算持有天数和费率
- **持有天数** = 卖出日期 - 买入日期（向下取整）

**特点**：
- 仅用于手续费计算，不用于收益计算
- 支持分批卖出、跨批次匹配
- 费率区间为左闭右开：`minDays <= 持有天数 < maxDays`

### 两种方法的区别

| 维度 | 加权平均成本法 | FIFO |
|------|--------------|------|
| **用途** | 计算持仓成本、收益 | 计算卖出手续费 |
| **匹配逻辑** | 不区分买入批次，统一计算成本价 | 按买入时间顺序，先进先出 |
| **卖出处理** | 卖出份额 × 当前成本价 | 按买入批次分别计算持有天数 |
| **文件** | `calculatorV2.js` | `fifoCalculator.js`、`feeCalculator.js` |

## 核心特性

- 基金管理（添加/编辑/删除）
- 交易记录（买入/卖出/分红，支持备注）
- 加权平均成本法
- 多轮持仓分组展示
- **费率配置与自动计算**
  - 买入费率：按金额区间设置，支持多档费率，界面显示单位为万元
  - 卖出费率：按持有天数设置，左闭右开区间 `[minDays, maxDays)`，FIFO逻辑匹配
  - 自动计算建议：交易弹窗中实时计算建议手续费，支持一键导入
- 深色/浅色主题切换
- ECharts专业图表
- 卡片/列表双视图
- 大数字格式化（万/亿单位）
- 数据导入导出

## 费率计算逻辑

### 买入费率计算
- **匹配规则**：`minAmount <= 买入金额 < maxAmount`（左闭右开）
- **存储单位**：元（minAmount/maxAmount以元为单位存储）
- **显示单位**：万元（UI输入显示时÷10000，保存时×10000）
- **计算公式**：`手续费 = 买入金额 × 费率%`

### 卖出费率计算（FIFO逻辑）
- **匹配规则**：`minDays <= 持有天数 < maxDays`（左闭右开）
- **FIFO队列**：按买入时间顺序构建队列，卖出时从最早批次扣减
- **分批计算**：一笔卖出可能跨多个买入批次，分别计算持有天数和费率
- **持有天数**：`卖出日期 - 买入日期`（向下取整天数）
- **计算公式**：`手续费 = 卖出份额 × 净值 × 费率%`

## 开发规范

### 代码检查
每次修改后必须运行代码检查，确保通过：
- `npm run lint` - 全部检查（JS + CSS）
- `npm run lint:js` - 仅JS检查
- `npm run lint:css` - 仅CSS检查

### Git提交
- 每次修改后需要提交git记录
- 提交信息应简洁描述修改内容

### 代码风格
- 禁止在对象方法内部使用`this`调用其他方法，应使用明确的对象名
- 回答以中文为主，专属名词除外
- 每次开始分析前，先查询是否有现成Skills可以调用

# 场外基金收益计算器

## 项目概述

**项目名称**：场外基金收益计算器 (fund-return-calculator)
**版本**：v2.2.0
**类型**：纯前端Web应用（无需后端服务）
**核心功能**：场外基金（支付宝买卖的基金）收益计算，支持交易记录、加权平均成本法、多轮持仓分组、收益统计

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
      - `.trade-records` 交易记录表格
      - `.chart-section` 图表分析区
  - `.fab-container` 悬浮按钮（刷新数据）
- `#modal-container` 弹窗容器
- `#loading` 加载提示
- `#toast` 提示消息

## 技术栈

- **前端框架**：原生HTML/CSS/JavaScript（无框架）
- **图表库**：ECharts（本地）
- **数据存储**：LocalStorage
- **模块系统**：自定义模块注册系统
- **事件系统**：自定义事件总线
- **样式系统**：CSS变量设计令牌

## 核心特性

- 基金管理（添加/编辑/删除）
- 交易记录（买入/卖出/分红，支持备注）
- 加权平均成本法
- 多轮持仓分组展示
- 深色/浅色主题切换
- ECharts专业图表
- 卡片/列表双视图
- 大数字格式化（万/亿单位）
- 数据导入导出

## 开发规范

- 禁止在对象方法内部使用`this`调用其他方法，应使用明确的对象名
- 回答以中文为主，专属名词除��
- 如果支持git，每次修改后需要提交git记录
- 每次开始分析前，先查询是否有现成Skills可以调用


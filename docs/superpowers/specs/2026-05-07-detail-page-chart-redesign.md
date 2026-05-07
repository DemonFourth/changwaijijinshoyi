# 详情页图表重构设计

## 背景

现有详情页图表分析区域包含4个图表：收益趋势、买卖对比、收益率变化、持仓成本趋势。用户反馈前三者实用性不足，希望替换为更有价值的图表。

## 目标

保留持仓成本趋势图，新增4个更实用的图表，调整布局为2x3网格（5个图表）。

## 新图表设计

### 1. 持仓成本趋势（保留，置顶）
- **类型**：折线图（双Y轴）
- **位置**：网格第一个位置
- **数据**：
  - 买入时点成本价（折线1）
  - 基金净值（折线2）
- **用途**：对比成本价与净值走势，识别成本优势/劣势区间
- **现有实现**：ChartManager.buildCostTrendOption

### 2. 持仓份额变化图
- **类型**：面积图 + 买卖标记
- **X轴**：交易日期
- **Y轴**：持仓份额
- **标记**：买入↑绿色，卖出↓红色
- **数据源**：遍历交易记录，累积计算每次交易后的持仓份额
- **用途**：直观展示加仓/减仓/清仓操作

### 3. 资金流动图
- **类型**：折线图（多线）
- **线条**：
  - 累计投入 = 历次买入金额之和
  - 累计卖出 = 历次卖出金额之和
  - 当前市值 = 当前持仓份额 × 当前净值
- **用途**：资金进出轨迹，当前资产演变

### 4. 持仓周期对比图
- **类型**：分组柱状图 + 折线
- **X轴**：各周期（周期1、周期2...）
- **Y轴**：
  - 柱状：收益额
  - 折线：持有天数
- **数据源**：stats.cycles
- **用途**：对比各周期的盈利能力与持有时长

### 5. 持仓成本分布图
- **类型**：柱状图（横向）或饼图
- **方案A（横向柱状）**：
  - X轴：成本区间（如 1.0-1.2、1.2-1.4...）
  - Y轴：各区间的份额数量
- **方案B（饼图）**：成本区间占比
- **推荐**：方案A，更直观
- **用途**：成本分布集中度，判断当前盈亏状态

## 布局调整

### CSS Grid 修改
```css
/* 当前 */
.chart-detail-grid {
    grid-template-columns: repeat(2, 1fr);  /* 768px+ */
    grid-template-columns: repeat(3, 1fr); /* 1200px+ */
}

/* 修改为 */
.chart-detail-grid {
    grid-template-columns: 1fr;  /* 移动端 */
    grid-template-columns: repeat(2, 1fr);  /* 768px+ */
    grid-template-columns: repeat(3, 1fr); /* 1200px+ */
}
/* 保持4列展示：2x3网格 */
```

### HTML 结构修改
```html
<div class="chart-container chart-detail-grid">
    <div class="chart-item">
        <h4>持仓成本趋势</h4>
        <div id="chart-cost-trend" class="chart"></div>
    </div>
    <div class="chart-item">
        <h4>持仓份额变化</h4>
        <div id="chart-share-change" class="chart"></div>
    </div>
    <div class="chart-item">
        <h4>资金流动</h4>
        <div id="chart-fund-flow" class="chart"></div>
    </div>
    <div class="chart-item">
        <h4>持仓周期对比</h4>
        <div id="chart-cycle-compare" class="chart"></div>
    </div>
    <div class="chart-item">
        <h4>持仓成本分布</h4>
        <div id="chart-cost-distribution" class="chart"></div>
    </div>
</div>
```

## 实现任务

1. 修改 index.html 图表区域结构
2. 修改 style.css grid 布局
3. ChartManager 新增4个图表构建方法：
   - buildShareChangeOption
   - buildFundFlowOption
   - buildCycleCompareOption
   - buildCostDistributionOption
4. detail.js 更新图表渲染逻辑

## 验收标准

- [ ] 详情页显示5个图表
- [ ] 持仓成本趋势在第一个位置
- [ ] 5个图表都能正确渲染数据
- [ ] 响应式布局在移动端/平板/桌面正常显示
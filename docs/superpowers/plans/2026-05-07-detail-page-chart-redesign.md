# 详情页图表重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 详情页图表分析区域重构：保留持仓成本趋势，新增4个图表，调整为5个图表的2x3网格布局

**Architecture:** 修改HTML结构+CSS布局，新增ChartManager图表方法，更新detail.js渲染逻辑

**Tech Stack:** 原生JavaScript + ECharts

---

## 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `index.html:342-363` | 替换图表区域HTML结构 |
| `css/style.css:476-511` | 调整grid布局（移除1200px的3列） |
| `js/chartManager.js:530-810` | 新增4个图表构建方法 |
| `js/detail.js:386-439` | 更新图表渲染调用 |

---

## 实现任务

### Task 1: 修改HTML图表区域结构

**Files:**
- Modify: `index.html:342-363`

- [ ] **Step 1: 读取当前图表区域代码**

读取 index.html 第342-363行，确认现有结构

- [ ] **Step 2: 替换为新结构**

```html
<!-- 图表区域 -->
<div class="chart-section">
    <h3>图表分析</h3>
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
</div>
```

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "refactor: 重构详情页图表区域结构"
```

---

### Task 2: 调整CSS Grid布局

**Files:**
- Modify: `css/style.css:501-511`

- [ ] **Step 1: 读取当前grid布局代码**

读取 style.css 第476-511行，确认当前 grid-template-columns 断点

- [ ] **Step 2: 修改1200px breakpoint**

将 `grid-template-columns: repeat(3, 1fr)` 改为 `grid-template-columns: repeat(3, 1fr)` 保持3列（2x3布局）

实际上当前已经是3列，不需要修改。但需要确认是否需要显示5个时的布局调整

- [ ] **Step 3: 提交**

```bash
git add css/style.css
git commit -m "style: 调整图表grid布局"
```

---

### Task 3: 实现持仓份额变化图

**Files:**
- Modify: `js/chartManager.js:810`（在文件末尾添加新方法）

- [ ] **Step 1: 添加 buildShareChangeOption 方法**

在 chartManager.js 末尾（约第810行后）添加：

```javascript
/**
 * 生成持仓份额变化图配置
 * @param {Array} trades - 交易记录数组
 * @param {number} currentNetValue - 当前净值
 * @returns {Object}
 */
buildShareChangeOption(trades, currentNetValue) {
    const themeConfig = ChartManager.getThemeConfig();

    if (!trades || trades.length === 0) {
        return ChartManager.buildEmptyOption('暂无交易数据');
    }

    const sortedTrades = [...trades].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );

    const dates = [];
    const shareData = [];
    const buyMarkers = [];
    const sellMarkers = [];
    let cumulativeShares = 0;

    sortedTrades.forEach(trade => {
        const type = trade.type;
        const shares = parseFloat(trade.shares) || 0;
        
        dates.push(trade.date);
        
        if (type === 'buy') {
            cumulativeShares += shares;
            shareData.push(parseFloat(cumulativeShares.toFixed(2)));
            buyMarkers.push({
                name: '买入',
                coord: [trade.date, cumulativeShares],
                value: shares
            });
        } else if (type === 'sell') {
            cumulativeShares -= shares;
            shareData.push(parseFloat(cumulativeShares.toFixed(2)));
            sellMarkers.push({
                name: '卖出',
                coord: [trade.date, cumulativeShares],
                value: shares
            });
        } else if (type === 'dividend' && trade.dividendMode === 'reinvest') {
            const reinvestShares = parseFloat(trade.reinvestShares) || shares;
            cumulativeShares += reinvestShares;
            shareData.push(parseFloat(cumulativeShares.toFixed(2)));
            buyMarkers.push({
                name: '红利再投',
                coord: [trade.date, cumulativeShares],
                value: reinvestShares
            });
        } else {
            shareData.push(parseFloat(cumulativeShares.toFixed(2)));
        }
    });

    // 如果当前有持仓，添加当前时点
    if (cumulativeShares > 0 && currentNetValue) {
        dates.push('当前');
        shareData.push(parseFloat(cumulativeShares.toFixed(2)));
    }

    return {
        textStyle: { color: themeConfig.textColor },
        tooltip: { 
            trigger: 'axis',
            formatter: params => {
                const data = params[0];
                return `${data.name}<br/>持仓份额: ${data.value}`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { color: themeConfig.textColor, rotate: 45 },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
        },
        yAxis: {
            type: 'value',
            name: '份额',
            axisLabel: { color: themeConfig.textColor },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
            splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
        },
        series: [{
            name: '持仓份额',
            type: 'line',
            data: shareData,
            areaStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: themeConfig.profitColor + '80' },
                    { offset: 1, color: themeConfig.profitColor + '20' }
                ])
            },
            lineStyle: { color: themeConfig.profitColor },
            itemStyle: { color: themeConfig.profitColor },
            markPoint: {
                data: [
                    ...buyMarkers.map(m => ({
                        coord: m.coord,
                        itemStyle: { color: '#4caf50' },
                        symbol: 'triangle',
                        symbolRotate: 0
                    })),
                    ...sellMarkers.map(m => ({
                        coord: m.coord,
                        itemStyle: { color: '#f44336' },
                        symbol: 'triangle',
                        symbolRotate: 180
                    }))
                ]
            }
        }]
    };
},
```

- [ ] **Step 2: 提交**

```bash
git add js/chartManager.js
git commit -m "feat: 新增持仓份额变化图表方法"
```

---

### Task 4: 实现资金流动图

**Files:**
- Modify: `js/chartManager.js`（在buildShareChangeOption后添加）

- [ ] **Step 1: 添加 buildFundFlowOption 方法**

在 buildShareChangeOption 方法后添加：

```javascript
/**
 * 生成资金流动图配置
 * @param {Array} trades - 交易记录数组
 * @param {number} currentNetValue - 当前净值
 * @returns {Object}
 */
buildFundFlowOption(trades, currentNetValue) {
    const themeConfig = ChartManager.getThemeConfig();

    if (!trades || trades.length === 0) {
        return ChartManager.buildEmptyOption('暂无交易数据');
    }

    const sortedTrades = [...trades].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );

    const dates = [];
    const cumulativeInvest = [];
    const cumulativeSell = [];
    const currentValue = [];
    
    let totalInvest = 0;
    let totalSell = 0;
    let totalShares = 0;

    sortedTrades.forEach(trade => {
        const type = trade.type;
        const amount = parseFloat(trade.amount) || 0;
        const shares = parseFloat(trade.shares) || 0;
        const netValue = parseFloat(trade.netValue) || 0;
        
        dates.push(trade.date);
        
        if (type === 'buy') {
            totalInvest += amount;
            totalShares += shares;
        } else if (type === 'sell') {
            totalSell += amount;
            totalShares -= shares;
        } else if (type === 'dividend') {
            if (trade.dividendMode === 'cash') {
                totalSell += amount;
            } else if (trade.dividendMode === 'reinvest') {
                const reinvestShares = parseFloat(trade.reinvestShares) || shares;
                totalShares += reinvestShares;
            }
        }
        
        cumulativeInvest.push(parseFloat(totalInvest.toFixed(2)));
        cumulativeSell.push(parseFloat(totalSell.toFixed(2)));
        
        const marketValue = totalShares * (type === 'buy' || type === 'sell' ? netValue : currentNetValue || netValue);
        currentValue.push(parseFloat(marketValue.toFixed(2)));
    });

    // 添加当前时点
    if (totalShares > 0 && currentNetValue) {
        dates.push('当前');
        cumulativeInvest.push(totalInvest);
        cumulativeSell.push(totalSell);
        currentValue.push(parseFloat((totalShares * currentNetValue).toFixed(2)));
    }

    return {
        textStyle: { color: themeConfig.textColor },
        tooltip: { 
            trigger: 'axis',
            formatter: params => {
                let html = `${params[0].name}<br/>`;
                params.forEach(p => {
                    html += `${p.seriesName}: ¥${Utils.formatMoneySmart(p.value)}<br/>`;
                });
                return html;
            }
        },
        legend: {
            data: ['累计投入', '累计卖出', '当前市值'],
            textStyle: { color: themeConfig.textColor }
        },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { color: themeConfig.textColor, rotate: 45 },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: themeConfig.textColor,
                formatter: val => (val >= 10000) ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
            },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
            splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
        },
        series: [
            {
                name: '累计投入',
                type: 'line',
                data: cumulativeInvest,
                lineStyle: { color: themeConfig.itemColor[0] },
                itemStyle: { color: themeConfig.itemColor[0] }
            },
            {
                name: '累计卖出',
                type: 'line',
                data: cumulativeSell,
                lineStyle: { color: themeConfig.itemColor[2] },
                itemStyle: { color: themeConfig.itemColor[2] }
            },
            {
                name: '当前市值',
                type: 'line',
                data: currentValue,
                lineStyle: { color: themeConfig.profitColor },
                itemStyle: { color: themeConfig.profitColor },
                areaStyle: { 
                    color: themeConfig.profitColor + '20'
                }
            }
        ]
    };
},
```

- [ ] **Step 2: 提交**

```bash
git add js/chartManager.js
git commit -m "feat: 新增资金流动图表方法"
```

---

### Task 5: 实现持仓周期对比图

**Files:**
- Modify: `js/chartManager.js`

- [ ] **Step 1: 添加 buildCycleCompareOption 方法**

在 buildFundFlowOption 方法后添加：

```javascript
/**
 * 生成持仓周期对比图配置
 * @param {Array} cycles - 持仓周期数组
 * @returns {Object}
 */
buildCycleCompareOption(cycles) {
    const themeConfig = ChartManager.getThemeConfig();

    if (!cycles || cycles.length === 0) {
        return ChartManager.buildEmptyOption('暂无周期数据');
    }

    const cycleNames = cycles.map((c, i) => `周期${c.id || (i + 1)}`);
    const profitData = cycles.map(c => c.totalProfit || 0);
    
    // 计算每个周期的持有天数
    const daysData = cycles.map(c => {
        if (!c.startDate) return 0;
        const endDate = c.endDate || new Date().toISOString().split('T')[0];
        const start = new Date(c.startDate);
        const end = new Date(endDate);
        return Math.floor((end - start) / (1000 * 60 * 60 * 24));
    });

    return {
        textStyle: { color: themeConfig.textColor },
        tooltip: { 
            trigger: 'axis',
            formatter: params => {
                const profit = params[0];
                const days = params[1];
                return `${profit.name}<br/>收益: ¥${Utils.formatMoneySmart(profit.value)}<br/>持有天数: ${days.value}天`;
            }
        },
        legend: {
            data: ['收益额', '持有天数'],
            textStyle: { color: themeConfig.textColor }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: cycleNames,
            axisLabel: { color: themeConfig.textColor },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
        },
        yAxis: [
            {
                type: 'value',
                name: '收益(¥)',
                axisLabel: { color: themeConfig.textColor },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            {
                type: 'value',
                name: '天数',
                axisLabel: { color: themeConfig.textColor },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: '收益额',
                type: 'bar',
                data: profitData.map(v => ({
                    value: v,
                    itemStyle: { color: v >= 0 ? themeConfig.profitColor : themeConfig.lossColor }
                })),
                barMaxWidth: 40
            },
            {
                name: '持有天数',
                type: 'line',
                yAxisIndex: 1,
                data: daysData,
                lineStyle: { color: themeConfig.itemColor[1] },
                itemStyle: { color: themeConfig.itemColor[1] },
                smooth: true
            }
        ]
    };
},
```

- [ ] **Step 2: 提交**

```bash
git add js/chartManager.js
git commit -m "feat: 新增持仓周期对比图表方法"
```

---

### Task 6: 实现持仓成本分布图

**Files:**
- Modify: `js/chartManager.js`

- [ ] **Step 1: 添加 buildCostDistributionOption 方法**

在 buildCycleCompareOption 方法后添加：

```javascript
/**
 * 生成持仓成本分布图配置
 * @param {Array} trades - 交易记录数组
 * @returns {Object}
 */
buildCostDistributionOption(trades) {
    const themeConfig = ChartManager.getThemeConfig();

    if (!trades || trades.length === 0) {
        return ChartManager.buildEmptyOption('暂无交易数据');
    }

    // 收集所有买入记录的成本价
    const costPrices = [];
    trades.forEach(trade => {
        if (trade.type === 'buy') {
            const amount = parseFloat(trade.amount) || 0;
            const shares = parseFloat(trade.shares) || 0;
            if (shares > 0) {
                const costPrice = amount / shares;
                costPrices.push(costPrice);
            }
        }
    });

    if (costPrices.length === 0) {
        return ChartManager.buildEmptyOption('暂无买入记录');
    }

    // 计算成本价范围
    const minPrice = Math.floor(Math.min(...costPrices) * 10) / 10;
    const maxPrice = Math.ceil(Math.max(...costPrices) * 10) / 10;
    const step = 0.1;
    
    // 创建区间
    const ranges = [];
    let current = minPrice;
    while (current < maxPrice) {
        const next = current + step;
        ranges.push({ min: current, max: next, label: `${current.toFixed(1)}-${next.toFixed(1)}`, count: 0 });
        current = next;
    }
    
    // 统计各区间数量
    costPrices.forEach(price => {
        for (const range of ranges) {
            if (price >= range.min && price < range.max) {
                range.count++;
                break;
            }
        }
    });

    // 过滤空区间
    const nonEmptyRanges = ranges.filter(r => r.count > 0);

    return {
        textStyle: { color: themeConfig.textColor },
        tooltip: { 
            trigger: 'axis',
            formatter: params => {
                const data = params[0];
                return `成本区间: ${data.name}<br/>买入次数: ${data.value}`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            data: nonEmptyRanges.map(r => r.label),
            axisLabel: { color: themeConfig.textColor, rotate: 45 },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
        },
        yAxis: {
            type: 'value',
            name: '买入次数',
            axisLabel: { color: themeConfig.textColor },
            axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
            splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
        },
        series: [{
            type: 'bar',
            data: nonEmptyRanges.map(r => ({
                value: r.count,
                itemStyle: { color: themeConfig.itemColor[0] }
            })),
            barMaxWidth: 50
        }]
    };
},
```

- [ ] **Step 2: 提交**

```bash
git add js/chartManager.js
git commit -m "feat: 新增持仓成本分布图表方法"
```

---

### Task 7: 更新detail.js图表渲染逻辑

**Files:**
- Modify: `js/detail.js:396-418`

- [ ] **Step 1: 读取当前渲染逻辑**

读取 detail.js 第396-418行，确认现有图表渲染调用

- [ ] **Step 2: 修改图表渲染逻辑**

将：
```javascript
// 渲染收益趋势图
const trendContainer = document.getElementById('chart-fund-profit-trend');
if (trendContainer) {
    ChartManager.createChart('chart-fund-profit-trend', ChartManager.buildFundProfitTrendOption(fund, stats));
}

// 渲染买卖对比图
const compareContainer = document.getElementById('chart-buy-sell-compare');
if (compareContainer) {
    ChartManager.createChart('chart-buy-sell-compare', ChartManager.buildBuySellCompareOption(stats));
}

// 渲染收益率变化图
const rateContainer = document.getElementById('chart-profit-rate-change');
if (rateContainer) {
    ChartManager.createChart('chart-profit-rate-change', ChartManager.buildProfitRateChangeOption(stats.cycles));
}
```

替换为：
```javascript
// 持仓份额变化图
const shareContainer = document.getElementById('chart-share-change');
if (shareContainer) {
    const trades = TradeManager.getTradesByFund(fund.id);
    ChartManager.createChart('chart-share-change', ChartManager.buildShareChangeOption(trades, fund.netValue));
}

// 资金流动图
const fundFlowContainer = document.getElementById('chart-fund-flow');
if (fundFlowContainer) {
    const trades = TradeManager.getTradesByFund(fund.id);
    ChartManager.createChart('chart-fund-flow', ChartManager.buildFundFlowOption(trades, fund.netValue));
}

// 持仓周期对比图
const cycleCompareContainer = document.getElementById('chart-cycle-compare');
if (cycleCompareContainer) {
    ChartManager.createChart('chart-cycle-compare', ChartManager.buildCycleCompareOption(stats.cycles));
}

// 持仓成本分布图
const costDistContainer = document.getElementById('chart-cost-distribution');
if (costDistContainer) {
    const trades = TradeManager.getTradesByFund(fund.id);
    ChartManager.createChart('chart-cost-distribution', ChartManager.buildCostDistributionOption(trades));
}
```

- [ ] **Step 3: 提交**

```bash
git add js/detail.js
git commit -m "refactor: 更新详情页图表渲染逻辑"
```

---

### Task 8: 运行lint检查

**Files:**
- Check: `package.json`（检查lint命令）

- [ ] **Step 1: 检查lint命令**

读取 package.json 确认 lint 命令

- [ ] **Step 2: 运行lint**

```bash
npm run lint
```

- [ ] **Step 3: 修复问题（如有）**

根据lint输出修复代码问题

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "fix: 修复lint问题"
```

---

## 验收标准

- [ ] Task 1: HTML图表区域改为5个图表的2x3网格结构
- [ ] Task 2: CSS布局保持2列（768px+）和3列（1200px+）
- [ ] Task 3: 持仓份额变化图正确渲染
- [ ] Task 4: 资金流动图正确渲染
- [ ] Task 5: 持仓周期对比图正确渲染
- [ ] Task 6: 持仓成本分布图正确渲染
- [ ] Task 7: detail.js正确调用新图表方法
- [ ] Task 8: lint检查通过
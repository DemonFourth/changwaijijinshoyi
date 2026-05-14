/**
 * 图表管理模块
 * 封装ECharts实例管理，提供统一的图表创建和主题适配接口
 * eslint-disable no-unused-vars
 */

const ChartManager = {
    // ECharts实例缓存 Map<containerId, echartsInstance>
    _instances: new Map(),

    // ECharts是否可用
    _echartsAvailable: false,

    // 懒加载观察器
    _lazyObserver: null,

    // 待创建的图表队列 Map<containerId, option>
    _pendingCharts: new Map(),

    /**
     * 初始化图表管理器
     */
    init() {
        ChartManager._echartsAvailable = (typeof echarts !== 'undefined');
        if (!ChartManager._echartsAvailable) {
            console.warn('ECharts not available (lib/echarts.min.js not loaded), falling back to simple charts');
        }

        // 监听主题变化
        EventBus.on(EventType.THEME_CHANGED, () => ChartManager.onThemeChanged());

        // 统一主题适配接口 - 监听图表主题更新事件
        EventBus.on(EventType.CHART_THEME_CHANGED, (data) => {
            ChartManager.onThemeChange(data && data.theme);
        });

        // 监听窗口resize
        window.addEventListener('resize', Utils.debounce(() => ChartManager.onResize(), 200));

        // 初始化懒加载观察器
        ChartManager._initLazyObserver();

        console.log('ChartManager initialized, ECharts available:', ChartManager._echartsAvailable);
    },

    /**
     * 初始化懒加载观察器
     */
    _initLazyObserver() {
        if (!('IntersectionObserver' in window)) return;

        ChartManager._lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const containerId = entry.target.id;
                    const pendingOption = ChartManager._pendingCharts.get(containerId);
                    if (pendingOption) {
                        ChartManager._pendingCharts.delete(containerId);
                        ChartManager.createChart(containerId, pendingOption);
                        ChartManager._lazyObserver.unobserve(entry.target);
                    }
                }
            });
        }, { rootMargin: '100px' });
    },

    /**
     * 延迟创建图表（进入视口时再创建）
     * @param {string} containerId - DOM容器ID
     * @param {Object} option - ECharts配置项
     */
    createChartLazy(containerId, option) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn('Chart container not found:', containerId);
            return null;
        }

        // 如果容器已经在视口中，直接创建
        const rect = container.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) {
            return ChartManager.createChart(containerId, option);
        }

        // 否则加入待创建队列，使用懒加载
        ChartManager._pendingCharts.set(containerId, option);

        if (ChartManager._lazyObserver) {
            ChartManager._lazyObserver.observe(container);
        }

        return null;
    },

    /**
     * 统一主题变更接口 - 所有需要响应主题变化的模块调用此方法
     * @param {string} theme - 主题名称 'light' | 'dark'
     */
    onThemeChange(theme) {
        if (!theme) theme = ThemeManager.getTheme();
        if (!ChartManager._echartsAvailable) return;

        ChartManager._instances.forEach((instance, containerId) => {
            try {
                const currentOption = instance.getOption();
                if (currentOption && currentOption[0]) {
                    const textStyle = currentOption[0].textStyle || {};
                    textStyle.color = theme === 'dark' ? '#b0b0b0' : '#666666';
                    instance.setOption({ textStyle }, { notMerge: false });
                }
            } catch (e) {
                console.warn('Failed to update chart theme:', containerId, e);
            }
        });
    },

    /**
     * 检测ECharts是否可用
     * @returns {boolean}
     */
    isEChartsAvailable() {
        return ChartManager._echartsAvailable;
    },

    /**
     * 创建或更新图表
     * @param {string} containerId - DOM容器ID
     * @param {Object} option - ECharts配置项
     * @returns {Object|null} ECharts实例
     */
    createChart(containerId, option) {
        if (!ChartManager._echartsAvailable) return null;

        const container = document.getElementById(containerId);
        if (!container) return null;

        // 销毁已有实例
        ChartManager.disposeChart(containerId);

        // 合并主题配色
        const themeConfig = ChartManager.getThemeConfig();
        const mergedOption = ChartManager.mergeThemeOption(option, themeConfig);

        // 创建实例
        const instance = echarts.init(container);
        instance.setOption(mergedOption);

        // 缓存实例
        ChartManager._instances.set(containerId, instance);

        return instance;
    },

    /**
     * 销毁图表实例
     * @param {string} containerId
     */
    disposeChart(containerId) {
        const instance = ChartManager._instances.get(containerId);
        if (instance) {
            instance.dispose();
            ChartManager._instances.delete(containerId);
        }
    },

    /**
     * 销毁所有图表实例
     */
    disposeAll() {
        ChartManager._instances.forEach((instance, id) => {
            instance.dispose();
        });
        ChartManager._instances.clear();
    },

    /**
     * 获取当前主题的ECharts配色
     * @returns {Object}
     */
    getThemeConfig() {
        const isDark = ThemeManager.getTheme() === 'dark';

        if (isDark) {
            return {
                backgroundColor: 'transparent',
                textColor: '#b0b0b0',
                axisLineColor: '#3a4a6c',
                splitLineColor: '#2a3a5c',
                itemColor: ['#8b9cf7', '#68d391', '#fc8181', '#ffb366', '#63b3ed'],
                profitColor: '#fc8181',
                lossColor: '#68d391'
            };
        } else {
            return {
                backgroundColor: 'transparent',
                textColor: '#666666',
                axisLineColor: '#dddddd',
                splitLineColor: '#f0f0f0',
                itemColor: ['#667eea', '#48bb78', '#f56565', '#ff9800', '#2196f3'],
                profitColor: '#f56565',
                lossColor: '#48bb78'
            };
        }
    },

    /**
     * 合并主题配色到option
     * @param {Object} option
     * @param {Object} themeConfig
     * @returns {Object}
     */
    mergeThemeOption(option, themeConfig) {
        // 设置通用样式
        if (!option.textStyle) option.textStyle = {};
        option.textStyle.color = themeConfig.textColor;

        // 统一设置tooltip主题
        if (!option.tooltip) option.tooltip = {};
        if (themeConfig.isDark) {
            // 深色主题
            option.tooltip.backgroundColor = 'rgba(30, 40, 60, 0.95)';
            option.tooltip.borderColor = '#4a5a7c';
            option.tooltip.textStyle = { color: '#e0e0e0', fontSize: 12 };
            option.tooltip.extraCssText = 'border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
        } else {
            // 浅色主题
            option.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            option.tooltip.borderColor = '#dddddd';
            option.tooltip.textStyle = { color: '#333333', fontSize: 12 };
            option.tooltip.extraCssText = 'border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
        }

        return option;
    },

    /**
     * 响应主题变化
     */
    onThemeChanged() {
        const theme = ThemeManager.getTheme();

        ChartManager.onThemeChange(theme);

        EventBus.emit(EventType.CHART_THEME_CHANGED, { theme });
    },

    /**
     * 响应窗口resize
     */
    onResize() {
        ChartManager._instances.forEach((instance) => {
            try {
                instance.resize();
            } catch (e) {
                // 忽略resize错误
            }
        });
    },

    // ==================== 业务图表工厂方法 ====================

    /**
     * 生成总收益趋势折线图配置（汇总页）
     * @param {Array} funds - 所有基金数据
     * @returns {Object} ECharts option
     */
    buildProfitTrendOption(funds) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!funds || funds.length === 0) {
            return ChartManager.buildEmptyOption('暂无收益数据');
        }

        // 收集所有基金的收益数据点
        const dataPoints = [];
        let cumulativeProfit = 0;

        funds.forEach(fund => {
            const stats = FundManager.getFundStats(fund.id);
            if (stats && stats.summary) {
                cumulativeProfit += stats.summary.totalProfit;
                dataPoints.push({
                    name: fund.name,
                    value: stats.summary.totalProfit
                });
            }
        });

        if (dataPoints.length === 0) {
            return ChartManager.buildEmptyOption('暂无收益数据');
        }

        // 按收益排序
        dataPoints.sort((a, b) => b.value - a.value);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const p = params[0];
                    const val = p.value;
                    const color = val >= 0 ? themeConfig.profitColor : themeConfig.lossColor;
                    return `${p.name}<br/>收益: <span style="color:${color}">¥${val.toFixed(2)}</span>`;
                }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                data: dataPoints.map(p => p.name),
                axisLabel: {
                    color: themeConfig.textColor,
                    rotate: dataPoints.length > 5 ? 30 : 0,
                    fontSize: 11
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => (val >= 10000 || val <= -10000) ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [{
                type: 'bar',
                data: dataPoints.map(p => ({
                    value: p.value,
                    itemStyle: { color: p.value >= 0 ? themeConfig.profitColor : themeConfig.lossColor }
                })),
                barMaxWidth: 40,
                label: {
                    show: dataPoints.length <= 10,
                    position: 'top',
                    formatter: p => '¥' + p.value.toFixed(0),
                    fontSize: 10,
                    color: themeConfig.textColor
                }
            }]
        };
    },

    /**
     * 生成月度收益柱状图配置（汇总页）
     * @param {Array} monthlyData - 月度汇总数据数组
     * @returns {Object} ECharts option
     */
    buildMonthlyProfitChartOption(monthlyData) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!monthlyData || monthlyData.length === 0) {
            return ChartManager.buildEmptyOption('暂无月度收益数据');
        }

        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

        // 数据按时间倒序，需要反转显示（最旧的月在左，最新的月在右）
        const sortedData = [...monthlyData].reverse();
        const xAxisData = sortedData.map(m => `${m.year}年${monthNames[m.month - 1]}`);
        const profitData = sortedData.map(m => m.totalProfit || 0);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const p = params[0];
                    const val = p.value;
                    const color = val >= 0 ? themeConfig.profitColor : themeConfig.lossColor;
                    return `${p.name}<br/>已实现收益: <span style="color:${color}">¥${val.toFixed(2)}</span>`;
                }
            },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
            xAxis: {
                type: 'category',
                data: xAxisData,
                axisLabel: {
                    color: themeConfig.textColor,
                    fontSize: 10,
                    rotate: 30
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => (val >= 10000 || val <= -10000) ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [{
                type: 'bar',
                data: profitData.map(p => ({
                    value: p,
                    itemStyle: {
                        color: p >= 0 ? themeConfig.profitColor : themeConfig.lossColor
                    }
                })),
                barMaxWidth: 30,
                label: {
                    show: true,
                    position: 'top',
                    formatter: p => {
                        if (Math.abs(p.value) >= 10000) {
                            return (p.value / 10000).toFixed(1) + '万';
                        }
                        return p.value.toFixed(0);
                    },
                    fontSize: 9,
                    color: themeConfig.textColor
                }
            }]
        };
    },

    /**
     * 生成持仓汇总饼图配置（成本 vs 市值 vs 浮动盈亏）
     * @param {Object} holdingSummary - 持仓汇总数据
     * @returns {Object} ECharts option
     */
    buildHoldingPieChartOption(holdingSummary) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!holdingSummary || holdingSummary.totalInvest === 0) {
            return ChartManager.buildEmptyOption('暂无持仓数据');
        }

        const data = [
            { name: '累计买入成本', value: holdingSummary.totalInvest },
            { name: '当前市值', value: holdingSummary.totalValue },
            { name: '浮动盈亏', value: holdingSummary.totalProfit }
        ];

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    return `${params.name}<br/>¥${params.value.toFixed(2)}`;
                }
            },
            legend: {
                orient: 'vertical',
                right: '5%',
                top: 'center',
                textStyle: { color: themeConfig.textColor },
                fontSize: 10
            },
            series: [{
                type: 'pie',
                radius: ['35%', '55%'],
                center: ['35%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: themeConfig.backgroundColor,
                    borderWidth: 2
                },
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 12,
                        fontWeight: 'bold'
                    }
                },
                data: data.map((item, index) => ({
                    ...item,
                    itemStyle: { color: themeConfig.itemColor[index] }
                }))
            }]
        };
    },

    /**
     * 生成已清仓汇总饼图配置（成本 vs 卖出金额 vs 已实现收益）
     * @param {Object} closedSummary - 已清仓汇总数据
     * @returns {Object} ECharts option
     */
    buildClosedPieChartOption(closedSummary) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!closedSummary || closedSummary.totalInvest === 0) {
            return ChartManager.buildEmptyOption('暂无已清仓数据');
        }

        const data = [
            { name: '累计买入成本', value: closedSummary.totalInvest },
            { name: '累计卖出金额', value: closedSummary.totalSellAmount },
            { name: '已实现收益', value: closedSummary.totalProfit }
        ];

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    return `${params.name}<br/>¥${params.value.toFixed(2)}`;
                }
            },
            legend: {
                orient: 'vertical',
                right: '5%',
                top: 'center',
                textStyle: { color: themeConfig.textColor },
                fontSize: 10
            },
            series: [{
                type: 'pie',
                radius: ['35%', '55%'],
                center: ['35%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: themeConfig.backgroundColor,
                    borderWidth: 2
                },
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 12,
                        fontWeight: 'bold'
                    }
                },
                data: data.map((item, index) => ({
                    ...item,
                    itemStyle: { color: themeConfig.itemColor[index] }
                }))
            }]
        };
    },

    /**
     * 生成年度汇总柱状图配置
     * @param {Object} yearlySummary - 年度汇总数据
     * @returns {Object} ECharts option
     */
    buildYearlyBarChartOption(yearlySummary) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!yearlySummary) {
            return ChartManager.buildEmptyOption('暂无年度数据');
        }

        const data = [
            { name: '累计买入', value: yearlySummary.totalInvest },
            { name: '卖出金额', value: yearlySummary.sellAmount },
            { name: '手续费', value: yearlySummary.fee },
            { name: '已实现收益', value: yearlySummary.totalProfit }
        ];

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(p => {
                        const color = p.value >= 0 ? themeConfig.profitColor : themeConfig.lossColor;
                        result += `${p.marker} ${p.seriesName}: <span style="color:${color}">¥${p.value.toFixed(2)}</span><br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['累计买入', '卖出金额', '手续费', '已实现收益'],
                textStyle: { color: themeConfig.textColor, fontSize: 10 },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '30%', containLabel: true },
            xAxis: {
                type: 'category',
                data: [yearlySummary.year + '年'],
                axisLabel: { color: themeConfig.textColor },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => (val >= 10000 || val <= -10000) ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [
                {
                    name: '累计买入',
                    type: 'bar',
                    data: [data[0].value],
                    itemStyle: { color: themeConfig.itemColor[0] },
                    barMaxWidth: 40
                },
                {
                    name: '卖出金额',
                    type: 'bar',
                    data: [data[1].value],
                    itemStyle: { color: themeConfig.itemColor[1] },
                    barMaxWidth: 40
                },
                {
                    name: '手续费',
                    type: 'bar',
                    data: [data[2].value],
                    itemStyle: { color: themeConfig.itemColor[2] },
                    barMaxWidth: 40
                },
                {
                    name: '已实现收益',
                    type: 'bar',
                    data: [data[3].value],
                    itemStyle: { color: data[3].value >= 0 ? themeConfig.profitColor : themeConfig.lossColor },
                    barMaxWidth: 40
                }
            ]
        };
    },

    /**
     * 生成单基金收益趋势折线图配置
     * @param {Object} fund - 基金数据
     * @param {Object} stats - 计算结果
     * @returns {Object}
     */
    buildFundProfitTrendOption(fund, stats) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!stats || !stats.cycles || stats.cycles.length === 0) {
            return ChartManager.buildEmptyOption('暂无交易数据');
        }

        // 按周期构建收益趋势
        const cycleNames = [];
        const profitData = [];
        const rateData = [];

        stats.cycles.forEach((cycle, index) => {
            cycleNames.push(`周期${cycle.id || (index + 1)}`);
            profitData.push(cycle.totalProfit || 0);
            rateData.push(cycle.profitRate || 0);
        });

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: { trigger: 'axis' },
            legend: {
                data: ['持仓份额'],
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
                    name: '收益率(%)',
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
                    barMaxWidth: 30
                },
                {
                    name: '收益率',
                    type: 'line',
                    yAxisIndex: 1,
                    data: rateData,
                    lineStyle: { color: themeConfig.itemColor[0] },
                    itemStyle: { color: themeConfig.itemColor[0] },
                    smooth: true
                }
            ]
        };
    },

    /**
     * 生成买卖对比柱状图配置
     * @param {Object} stats - 计算结果
     * @returns {Object}
     */
    buildBuySellCompareOption(stats) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!stats || !stats.summary) {
            return ChartManager.buildEmptyOption('暂无数据');
        }

        const summary = stats.summary;
        const buyAmount = summary.totalInvest || 0;
        const sellAmount = summary.totalSellAmount || 0;

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                data: ['买入', '卖出'],
                axisLabel: { color: themeConfig.textColor },
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
            series: [{
                type: 'bar',
                data: [
                    { value: buyAmount, itemStyle: { color: themeConfig.itemColor[0] } },
                    { value: sellAmount, itemStyle: { color: themeConfig.itemColor[2] } }
                ],
                barMaxWidth: 50,
                label: {
                    show: true,
                    position: 'top',
                    formatter: p => '¥' + p.value.toFixed(0),
                    fontSize: 11,
                    color: themeConfig.textColor
                }
            }]
        };
    },

    /**
     * 生成收益率变化折线图配置
     * @param {Array} cycles - 持仓周期
     * @returns {Object}
     */
    buildProfitRateChangeOption(cycles) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!cycles || cycles.length === 0) {
            return ChartManager.buildEmptyOption('暂无数据');
        }

        const cycleNames = cycles.map((c, i) => `周期${c.id || (i + 1)}`);
        const rateData = cycles.map(c => c.profitRate || 0);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: p => `${p[0].name}<br/>收益率: ${p[0].value.toFixed(2)}%`
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                data: cycleNames,
                axisLabel: { color: themeConfig.textColor },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                name: '收益率(%)',
                axisLabel: { color: themeConfig.textColor },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [{
                type: 'line',
                data: rateData,
                lineStyle: { color: themeConfig.itemColor[0] },
                itemStyle: {
                    color: function(params) {
                        return params.value >= 0 ? themeConfig.profitColor : themeConfig.lossColor;
                    }
                },
                smooth: true,
                label: {
                    show: true,
                    formatter: p => p.value.toFixed(1) + '%',
                    fontSize: 10,
                    color: themeConfig.textColor
                }
            }]
        };
    },

    buildCostTrendOption(fund, trades, stats) {
        const themeConfig = ChartManager.getThemeConfig();

        const allTrades = (trades || []).slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });

        if (allTrades.length === 0) {
            return ChartManager.buildEmptyOption('暂无交易数据');
        }

        let cycles = CalculatorV2.identifyHoldingCycles(allTrades);
        if (!cycles || cycles.length === 0) {
            cycles = [{
                id: 1,
                status: 'active',
                startDate: allTrades[0].date,
                endDate: null,
                trades: allTrades
            }];
        }

        const allDates = [];
        const allNetValues = [];
        const allCostPrices = [];
        const detailData = [];
        let minNetValue = Infinity;
        let maxNetValue = -Infinity;

        const cycleDataList = [];

        for (let c = 0; c < cycles.length; c++) {
            const cycle = cycles[c];
            const cycleTrades = (cycle.trades || []).slice().sort(function(a, b) {
                return new Date(a.date) - new Date(b.date);
            });

            if (cycleTrades.length === 0) continue;

            let cumulativeShares = 0;
            let cumulativeCost = 0;
            const cycleDates = [];
            const cycleNetValues = [];
            const cycleCostPrices = [];

            for (let i = 0; i < cycleTrades.length; i++) {
                const trade = cycleTrades[i];
                const shares = parseFloat(trade.shares) || 0;
                const amount = parseFloat(trade.amount) || 0;
                const netValue = parseFloat(trade.netValue) || 0;
                const tradeType = trade.type;
                const isDividendReinvest = tradeType === 'dividend' && trade.dividendMode === 'reinvest';

                if (tradeType === 'buy') {
                    cumulativeShares += shares;
                    cumulativeCost += amount;

                    cycleDates.push(trade.date);
                    allDates.push(trade.date);
                    cycleNetValues.push(netValue);
                    allNetValues.push(netValue);
                    if (netValue < minNetValue) minNetValue = netValue;
                    if (netValue > maxNetValue) maxNetValue = netValue;

                    const costPrice = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0;
                    cycleCostPrices.push(parseFloat(costPrice.toFixed(4)));
                    allCostPrices.push(parseFloat(costPrice.toFixed(4)));
                    if (costPrice < minNetValue) minNetValue = costPrice;
                    if (costPrice > maxNetValue) maxNetValue = costPrice;

                    detailData.push({
                        shares: shares,
                        amount: amount,
                        netValue: netValue,
                        cumulativeShares: cumulativeShares,
                        cumulativeCost: cumulativeCost,
                        costPrice: costPrice,
                        cycleId: cycle.id,
                        isDividendReinvest: false,
                        isSell: false
                    });
                } else if (tradeType === 'sell') {
                    const costPrice = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0;
                    const sellCost = shares * costPrice;
                    cumulativeShares -= shares;
                    cumulativeCost -= sellCost;
                } else if (isDividendReinvest) {
                    const reinvestShares = parseFloat(trade.reinvestShares) || shares;
                    const dividendNetValue = parseFloat(trade.netValue) || 0;
                    cumulativeShares += reinvestShares;

                    cycleDates.push(trade.date);
                    allDates.push(trade.date);
                    cycleNetValues.push(dividendNetValue > 0 ? dividendNetValue : null);
                    allNetValues.push(dividendNetValue > 0 ? dividendNetValue : null);

                    var costPrice = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0;
                    cycleCostPrices.push(parseFloat(costPrice.toFixed(4)));
                    allCostPrices.push(parseFloat(costPrice.toFixed(4)));
                    if (costPrice < minNetValue) minNetValue = costPrice;
                    if (costPrice > maxNetValue) maxNetValue = costPrice;

                    detailData.push({
                        shares: reinvestShares,
                        amount: 0,
                        netValue: dividendNetValue,
                        cumulativeShares: cumulativeShares,
                        cumulativeCost: cumulativeCost,
                        costPrice: costPrice,
                        cycleId: cycle.id,
                        isDividendReinvest: true,
                        isSell: false
                    });
                }
            }

            cycleDataList.push({
                cycleId: cycle.id,
                dates: cycleDates,
                netValues: cycleNetValues,
                costPrices: cycleCostPrices
            });
        }

        const latestNetValue = parseFloat(fund.netValue) || parseFloat(fund.estimatedValue) || 0;
        if (latestNetValue > 0) {
            if (latestNetValue < minNetValue) minNetValue = latestNetValue;
            if (latestNetValue > maxNetValue) maxNetValue = latestNetValue;
        }

        const valueRange = maxNetValue - minNetValue;
        const yAxisMin = Math.max(0, minNetValue - valueRange * 0.1);
        const yAxisMax = maxNetValue + valueRange * 0.1;

        const series = [];

        const colors = [themeConfig.itemColor[0], '#ed8936', '#9f7aea', '#38b2ac', '#f56565', '#66d9ef'];

        for (let ci = 0; ci < cycleDataList.length; ci++) {
            const cycleData = cycleDataList[ci];
            const cycleColor = colors[ci % colors.length];

            const cycleNetValueData = [];
            const cycleCostData = [];
            let dateIdx = 0;
            for (let di = 0; di < allDates.length; di++) {
                if (dateIdx < cycleData.dates.length && allDates[di] === cycleData.dates[dateIdx]) {
                    cycleNetValueData.push(cycleData.netValues[dateIdx]);
                    cycleCostData.push(cycleData.costPrices[dateIdx]);
                    dateIdx++;
                } else {
                    cycleNetValueData.push(null);
                    cycleCostData.push(null);
                }
            }

            series.push({
                name: ci === 0 ? '买入净值' : '买入净值_' + cycleData.cycleId,
                type: 'line',
                data: cycleNetValueData,
                lineStyle: { color: themeConfig.itemColor[1], width: 2 },
                itemStyle: { color: themeConfig.itemColor[1] },
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                connectNulls: false
            });

            series.push({
                name: ci === 0 ? '持仓成本' : '持仓成本_' + cycleData.cycleId,
                type: 'line',
                data: cycleCostData,
                lineStyle: { color: cycleColor, width: 2 },
                itemStyle: { color: cycleColor },
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                connectNulls: false
            });
        }

        if (latestNetValue > 0) {
            const latestNetValueLine = [];
            for (let j = 0; j < allDates.length; j++) {
                latestNetValueLine.push(latestNetValue);
            }
            series.push({
                name: '最新净值',
                type: 'line',
                data: latestNetValueLine,
                lineStyle: { color: themeConfig.profitColor, width: 2, type: 'dashed' },
                itemStyle: { color: themeConfig.profitColor },
                symbol: 'none'
            });
        }

        const legendData = ['买入净值', '持仓成本'];
        if (latestNetValue > 0) {
            legendData.push('最新净值');
        }

        return {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const validParams = params.filter(function(p) { return p.value !== null; });
                    if (validParams.length === 0) return '';
                    const idx = validParams[0].dataIndex;
                    const detail = detailData[idx];
                    let result = validParams[0].axisValue + '<br/>';
                    result += '持仓周期: 第' + detail.cycleId + '轮<br/>';
                    if (detail.isDividendReinvest) {
                        result += '分红再投资净值: ' + detail.netValue.toFixed(4) + '<br/>';
                        result += '分红再投资: ' + detail.shares.toFixed(2) + '份<br/>';
                    } else {
                        result += '买入净值: ' + detail.netValue.toFixed(4) + '<br/>';
                        result += '本次买入: ' + detail.shares.toFixed(2) + '份<br/>';
                    }
                    result += '持仓成本价: ' + detail.costPrice.toFixed(4) + '<br/>';
                    result += '累计份额: ' + detail.cumulativeShares.toFixed(2) + '份';
                    return result;
                }
            },
            legend: {
                data: legendData,
                textStyle: { color: themeConfig.textColor },
                top: 10
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: 60,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: allDates,
                axisLabel: {
                    color: themeConfig.textColor,
                    rotate: 30
                },
                axisLine: {
                    lineStyle: { color: themeConfig.borderColor }
                }
            },
            yAxis: {
                type: 'value',
                name: '净值/成本价',
                nameTextStyle: { color: themeConfig.textColor },
                min: yAxisMin,
                max: yAxisMax,
                axisLabel: { color: themeConfig.textColor },
                axisLine: {
                    lineStyle: { color: themeConfig.borderColor }
                },
                splitLine: {
                    lineStyle: { color: themeConfig.borderColor, type: 'dashed' }
                }
            },
            series: series
        };
    },

    buildEmptyOption(message) {
        return {
            title: {
                text: message,
                left: 'center',
                top: 'center',
                textStyle: {
                    color: '#999999',
                    fontSize: 14,
                    fontWeight: 'normal'
                }
            }
        };
    },

    buildShareChangeOption(trades, currentNetValue) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!trades || trades.length === 0) {
            return ChartManager.buildEmptyOption('暂无交易数据');
        }

        const sortedTrades = [...trades].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );
        const cycles = CalculatorV2.identifyHoldingCycles(sortedTrades);
        const allDates = [];
        const seenDates = new Set();
        const series = [];

        cycles.forEach((cycle, index) => {
            let cumulativeShares = 0;
            const cycleMap = new Map();
            const buyMarkers = [];
            const sellMarkers = [];
            const seriesName = `持仓份额-周期${cycle.id || (index + 1)}`;

            (cycle.trades || []).forEach(trade => {
                const type = trade.type;
                const shares = parseFloat(trade.shares) || 0;
                const date = trade.date;

                if (!seenDates.has(date)) {
                    seenDates.add(date);
                    allDates.push(date);
                }

                if (type === 'buy') {
                    cumulativeShares += shares;
                    cycleMap.set(date, parseFloat(cumulativeShares.toFixed(2)));
                    buyMarkers.push({ coord: [date, cumulativeShares] });
                } else if (type === 'sell') {
                    cumulativeShares -= shares;
                    cycleMap.set(date, parseFloat(cumulativeShares.toFixed(2)));
                    sellMarkers.push({ coord: [date, cumulativeShares] });
                } else if (type === 'dividend' && trade.dividendMode === 'reinvest') {
                    const reinvestShares = parseFloat(trade.reinvestShares) || shares;
                    cumulativeShares += reinvestShares;
                    cycleMap.set(date, parseFloat(cumulativeShares.toFixed(2)));
                    buyMarkers.push({ coord: [date, cumulativeShares] });
                } else {
                    cycleMap.set(date, parseFloat(cumulativeShares.toFixed(2)));
                }
            });

            if (cycle.status === 'active' && cumulativeShares > 0 && currentNetValue) {
                const today = new Date().toISOString().slice(0, 10);
                if (!seenDates.has(today)) {
                    seenDates.add(today);
                    allDates.push(today);
                }
                cycleMap.set(today, parseFloat(cumulativeShares.toFixed(2)));
            }

            series.push({
                name: '持仓份额',
                type: 'line',
                data: allDates.map(date => cycleMap.has(date) ? cycleMap.get(date) : null),
                connectNulls: false,
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: themeConfig.profitColor + '80' },
                        { offset: 1, color: themeConfig.profitColor + '20' }
                    ])
                },
                lineStyle: { color: themeConfig.profitColor },
                itemStyle: { color: themeConfig.profitColor },
                markPoint: {
                    symbolSize: 12,
                    data: [
                        ...buyMarkers.map(m => ({ ...m, itemStyle: { color: '#4caf50' }, symbol: 'triangle', symbolRotate: 0 })),
                        ...sellMarkers.map(m => ({ ...m, itemStyle: { color: '#f44336' }, symbol: 'triangle', symbolRotate: 180 }))
                    ]
                }
            });
        });

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: { trigger: 'axis' },
            legend: {
                data: ['持仓份额'],
                textStyle: { color: themeConfig.textColor }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                data: allDates,
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
            series: series
        };
    },

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
        const cycles = CalculatorV2.identifyHoldingCycles(sortedTrades);
        const allDates = [];
        const seenDates = new Set();
        const series = [];

        cycles.forEach((cycle, index) => {
            const investMap = new Map();
            const sellMap = new Map();
            const valueMap = new Map();
            let totalInvest = 0;
            let totalSell = 0;
            let totalShares = 0;

            (cycle.trades || []).forEach(trade => {
                const type = trade.type;
                const amount = parseFloat(trade.amount) || 0;
                const shares = parseFloat(trade.shares) || 0;
                const netValue = parseFloat(trade.netValue) || 0;
                const date = trade.date;

                if (!seenDates.has(date)) {
                    seenDates.add(date);
                    allDates.push(date);
                }

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

                investMap.set(date, parseFloat(totalInvest.toFixed(2)));
                sellMap.set(date, parseFloat(totalSell.toFixed(2)));
                valueMap.set(date, parseFloat((totalShares * (netValue || currentNetValue || 0)).toFixed(2)));
            });

            if (cycle.status === 'active' && totalShares > 0 && currentNetValue) {
                const today = new Date().toISOString().slice(0, 10);
                if (!seenDates.has(today)) {
                    seenDates.add(today);
                    allDates.push(today);
                }
                investMap.set(today, parseFloat(totalInvest.toFixed(2)));
                sellMap.set(today, parseFloat(totalSell.toFixed(2)));
                valueMap.set(today, parseFloat((totalShares * currentNetValue).toFixed(2)));
            }

            series.push(
                {
                    name: '累计投入',
                    type: 'line',
                    data: allDates.map(date => investMap.has(date) ? investMap.get(date) : null),
                    connectNulls: false,
                    lineStyle: { color: themeConfig.itemColor[0] },
                    itemStyle: { color: themeConfig.itemColor[0] }
                },
                {
                    name: '累计卖出',
                    type: 'line',
                    data: allDates.map(date => sellMap.has(date) ? sellMap.get(date) : null),
                    connectNulls: false,
                    lineStyle: { color: themeConfig.itemColor[3] },
                    itemStyle: { color: themeConfig.itemColor[3] }
                },
                {
                    name: '当前市值',
                    type: 'line',
                    data: allDates.map(date => valueMap.has(date) ? valueMap.get(date) : null),
                    connectNulls: false,
                    lineStyle: { color: themeConfig.profitColor },
                    itemStyle: { color: themeConfig.profitColor },
                    areaStyle: {
                        color: themeConfig.profitColor + '20'
                    }
                }
            );
        });

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: params => {
                    let html = `${params[0].name}<br/>`;
                    params.filter(p => p.value !== null && p.value !== undefined).forEach(p => {
                        html += `${p.seriesName}: ¥${Utils.formatMoneySmart(p.value)}<br/>`;
                    });
                    return html;
                }
            },
            legend: {
                data: ['累计投入', '累计卖出', '当前市值'],
                top: 0,
                textStyle: { color: themeConfig.textColor }
            },
            grid: { left: '3%', right: '4%', top: 36, bottom: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: allDates,
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
            series: series
        };
    },

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
            const endDate = c.endDate || new Date().toISOString().slice(0, 10);
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
                data: ['累计投入', '累计卖出', '当前市值'],
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

        // 收集所有买入记录的成本价和份额
        const costData = [];
        trades.forEach(trade => {
            const amount = parseFloat(trade.amount) || 0;
            const shares = parseFloat(trade.shares) || 0;
            if (Utils.isPositive(shares)) {
                const costPrice = amount / shares;
                if (trade.type === 'buy' || (trade.type === 'dividend' && trade.dividendMode === 'reinvest')) {
                    costData.push({ costPrice: costPrice, shares: shares });
                }
            }
        });

        if (costData.length === 0) {
            return ChartManager.buildEmptyOption('暂无买入记录');
        }

        // 计算成本价范围
        const prices = costData.map(d => d.costPrice);
        const minPrice = Math.floor(Math.min(...prices) * 10) / 10;
        const maxPrice = Math.ceil(Math.max(...prices) * 10) / 10;
        const step = 0.1;

        // 创建区间
        const ranges = [];
        let current = minPrice;
        while (current <= maxPrice) {
            const next = current + step;
            const rangeMax = next > maxPrice ? maxPrice : next;
            ranges.push({ min: current, max: rangeMax, label: current.toFixed(2) + '元', shares: 0 });
            current = next;
        }

        // 统计各区间的份额
        costData.forEach(data => {
            for (const range of ranges) {
                if (data.costPrice >= range.min && (data.costPrice < range.max || (range.max === maxPrice && data.costPrice === range.max))) {
                    range.shares += data.shares;
                    break;
                }
            }
        });

        // 过滤空区间
        const nonEmptyRanges = ranges.filter(r => r.shares > 0);

        // 计算总份额
        const total = nonEmptyRanges.reduce((sum, r) => sum + r.shares, 0);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    const percent = (params.value / total * 100).toFixed(1);
                    return params.name + '<br/>份额: ' + params.value.toFixed(2) + ' (' + percent + '%)';
                }
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                textStyle: { color: themeConfig.textColor }
            },
            series: [{
                type: 'pie',
                radius: ['30%', '70%'],
                center: ['50%', '50%'],
                data: nonEmptyRanges.map(r => ({
                    name: r.label,
                    value: parseFloat(r.shares.toFixed(2))
                })),
                label: {
                    show: true,
                    formatter: '{b}'
                }
            }]
        };
    },

    /**
     * 生成多年持仓对比柱状图配置
     * @param {Array} multiYearData - 近5年汇总数据 [{year, totalInvest, totalValue, totalProfit}]
     * @returns {Object} ECharts option
     */
    buildMultiYearBarChartOption(multiYearData) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!multiYearData || multiYearData.length === 0) {
            return ChartManager.buildEmptyOption('暂无年度数据');
        }

        const years = multiYearData.map(d => d.year + '年');
        const investData = multiYearData.map(d => d.totalInvest);
        const valueData = multiYearData.map(d => d.totalValue);
        const profitData = multiYearData.map(d => d.totalProfit);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(p => {
                        const color = p.value >= 0 ? themeConfig.profitColor : themeConfig.lossColor;
                        const valueStr = Math.abs(p.value) >= 10000
                            ? (p.value / 10000).toFixed(2) + '万'
                            : p.value.toFixed(2);
                        result += `${p.marker} ${p.seriesName}: <span style="color:${color}">¥${valueStr}</span><br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['累计投入', '当前市值', '总收益'],
                textStyle: { color: themeConfig.textColor },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '30%', containLabel: true },
            xAxis: {
                type: 'category',
                data: years,
                axisLabel: { color: themeConfig.textColor, fontSize: 11 },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => Math.abs(val) >= 10000 ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [
                {
                    name: '累计投入',
                    type: 'bar',
                    data: investData,
                    itemStyle: { color: themeConfig.itemColor[0] },
                    barMaxWidth: 40
                },
                {
                    name: '当前市值',
                    type: 'bar',
                    data: valueData,
                    itemStyle: { color: themeConfig.itemColor[1] },
                    barMaxWidth: 40
                },
                {
                    name: '总收益',
                    type: 'bar',
                    data: profitData.map(v => ({
                        value: v,
                        itemStyle: { color: v >= 0 ? themeConfig.profitColor : themeConfig.lossColor }
                    })),
                    barMaxWidth: 40
                }
            ]
        };
    },

    /**
     * 生成当年详细汇总柱状图配置
     * @param {Object} yearlySummary - 年度汇总数据
     * @returns {Object} ECharts option
     */
    buildYearlyDetailBarChartOption(yearlySummary) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!yearlySummary) {
            return ChartManager.buildEmptyOption('暂无年度数据');
        }

        const data = [
            { name: '累计买入', value: yearlySummary.totalInvest || 0 },
            { name: '累计卖出', value: yearlySummary.sellAmount || 0 },
            { name: '手续费', value: yearlySummary.fee || 0 },
            { name: '已实现收益', value: yearlySummary.totalProfit || 0 }
        ];

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(p => {
                        const valueStr = Math.abs(p.value) >= 10000
                            ? (p.value / 10000).toFixed(2) + '万'
                            : p.value.toFixed(2);
                        result += `${p.marker} ${p.seriesName}: ¥${valueStr}<br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['累计买入', '累计卖出', '手续费', '已实现收益'],
                textStyle: { color: themeConfig.textColor, fontSize: 10 },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '30%', containLabel: true },
            xAxis: {
                type: 'category',
                data: [yearlySummary.year + '年'],
                axisLabel: { color: themeConfig.textColor },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => Math.abs(val) >= 10000 ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [
                {
                    name: '累计买入',
                    type: 'bar',
                    data: [data[0].value],
                    itemStyle: { color: themeConfig.itemColor[0] },
                    barMaxWidth: 50
                },
                {
                    name: '累计卖出',
                    type: 'bar',
                    data: [data[1].value],
                    itemStyle: { color: themeConfig.itemColor[1] },
                    barMaxWidth: 50
                },
                {
                    name: '手续费',
                    type: 'bar',
                    data: [data[2].value],
                    itemStyle: { color: themeConfig.itemColor[2] },
                    barMaxWidth: 50
                },
                {
                    name: '已实现收益',
                    type: 'bar',
                    data: [{
                        value: data[3].value,
                        itemStyle: { color: data[3].value >= 0 ? themeConfig.profitColor : themeConfig.lossColor }
                    }],
                    barMaxWidth: 50
                }
            ]
        };
    },

    /**
     * 生成持仓分布折线图（按买入年份）
     * @param {Array} yearlyTrendData - 年度持仓分布数据 [{year, holdingCost, marketValue}]
     * @returns {Object} ECharts option
     */
    buildYearlyTrendLineChartOption(yearlyTrendData) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!yearlyTrendData || yearlyTrendData.length === 0) {
            return ChartManager.buildEmptyOption('暂无持仓数据');
        }

        const years = yearlyTrendData.map(d => d.year + '年');
        const costData = yearlyTrendData.map(d => d.holdingCost);
        const valueData = yearlyTrendData.map(d => d.marketValue);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(p => {
                        const valueStr = Math.abs(p.value) >= 10000
                            ? (p.value / 10000).toFixed(2) + '万'
                            : p.value.toFixed(2);
                        result += `${p.marker} ${p.seriesName}: <span style="color:${p.color}">¥${valueStr}</span><br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['持仓成本', '当前市值'],
                textStyle: { color: themeConfig.textColor },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '30%', containLabel: true },
            xAxis: {
                type: 'category',
                data: years,
                axisLabel: { color: themeConfig.textColor, fontSize: 11 },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => Math.abs(val) >= 10000 ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [
                {
                    name: '持仓成本',
                    type: 'line',
                    data: costData,
                    lineStyle: { color: themeConfig.itemColor[0], width: 2 },
                    itemStyle: { color: themeConfig.itemColor[0] },
                    smooth: true,
                    label: {
                        show: true,
                        position: 'top',
                        formatter: p => Math.abs(p.value) >= 10000 ? (p.value / 10000).toFixed(1) + '万' : p.value.toFixed(0),
                        fontSize: 9,
                        color: themeConfig.textColor
                    }
                },
                {
                    name: '当前市值',
                    type: 'line',
                    data: valueData,
                    lineStyle: { color: themeConfig.itemColor[3], width: 2 },
                    itemStyle: { color: themeConfig.itemColor[3] },
                    smooth: true,
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: themeConfig.itemColor[3] + '40' },
                            { offset: 1, color: themeConfig.itemColor[3] + '10' }
                        ])
                    },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: p => Math.abs(p.value) >= 10000 ? (p.value / 10000).toFixed(1) + '万' : p.value.toFixed(0),
                        fontSize: 9,
                        color: themeConfig.textColor
                    }
                }
            ]
        };
    },

    /**
     * 生成年度投入与收益对比折线图
     * @param {Array} multiYearData - 多年数据 [{year, totalInvest, totalProfit}]
     * @returns {Object} ECharts option
     */
    buildYearlyInvestProfitChartOption(multiYearData) {
        const themeConfig = ChartManager.getThemeConfig();

        if (!multiYearData || multiYearData.length === 0) {
            return ChartManager.buildEmptyOption('暂无年度数据');
        }

        const years = multiYearData.map(d => d.year + '年');
        const investData = multiYearData.map(d => d.totalInvest);
        const profitData = multiYearData.map(d => d.totalProfit);

        return {
            textStyle: { color: themeConfig.textColor },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(p => {
                        const valueStr = Math.abs(p.value) >= 10000
                            ? (p.value / 10000).toFixed(2) + '万'
                            : p.value.toFixed(2);
                        const color = p.seriesName === '收益' ? (p.value >= 0 ? themeConfig.profitColor : themeConfig.lossColor) : p.color;
                        result += `${p.marker} ${p.seriesName}: <span style="color:${color}">¥${valueStr}</span><br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['投入金额', '收益'],
                textStyle: { color: themeConfig.textColor },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '30%', containLabel: true },
            xAxis: {
                type: 'category',
                data: years,
                axisLabel: { color: themeConfig.textColor, fontSize: 11 },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: themeConfig.textColor,
                    formatter: val => Math.abs(val) >= 10000 ? (val / 10000).toFixed(1) + '万' : val.toFixed(0)
                },
                axisLine: { lineStyle: { color: themeConfig.axisLineColor } },
                splitLine: { lineStyle: { color: themeConfig.splitLineColor } }
            },
            series: [
                {
                    name: '投入金额',
                    type: 'line',
                    data: investData,
                    lineStyle: { color: themeConfig.itemColor[0], width: 2 },
                    itemStyle: { color: themeConfig.itemColor[0] },
                    smooth: true,
                    label: {
                        show: true,
                        position: 'top',
                        formatter: p => Math.abs(p.value) >= 10000 ? (p.value / 10000).toFixed(1) + '万' : p.value.toFixed(0),
                        fontSize: 9,
                        color: themeConfig.textColor
                    }
                },
                {
                    name: '收益',
                    type: 'line',
                    data: profitData.map(v => ({
                        value: v,
                        itemStyle: { color: v >= 0 ? themeConfig.profitColor : themeConfig.lossColor }
                    })),
                    lineStyle: { color: themeConfig.profitColor, width: 2 },
                    smooth: true,
                    label: {
                        show: true,
                        position: 'top',
                        formatter: p => Math.abs(p.value) >= 10000 ? (p.value / 10000).toFixed(1) + '万' : p.value.toFixed(0),
                        fontSize: 9,
                        color: themeConfig.textColor
                    }
                }
            ]
        };
    }
};

// 注册到模块系统
ModuleRegistry.register('ChartManager', ChartManager);

/**
 * 图表管理模块
 * 封装ECharts实例管理，提供统一的图表创建和主题适配接口
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
                data: ['收益额', '收益率'],
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

                    var costPrice = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0;
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
                    var costPrice = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0;
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
    }
};

// 注册到模块系统
ModuleRegistry.register('ChartManager', ChartManager);

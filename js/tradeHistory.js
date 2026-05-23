/**
 * 交易记录查看页面
 * 支持日期范围筛选、基金筛选、交易类型筛选和多种统计图表
 */

const TradeHistory = {
    _startDate: '',
    _endDate: '',
    _filterType: 'all',
    _filterFund: 'all',
    _currentPage: 1,
    _pageSize: 20,
    _chartType: 'structure',
    _chartPeriod: 'year',
    _chartStyle: 'line',
    _chartInstance: null,

    /**
     * 初始化页面
     */
    init() {
        this.bindEvents();
        this.loadFundOptions();
        this._updateChartStyleOptions();
        this.refresh();

        // 监听主题切换事件
        if (window.EventBus) {
            window.EventBus.on('CHART_THEME_CHANGED', () => {
                this.renderChart();
            });
        }

        console.log('TradeHistory initialized');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const startDateInput = document.getElementById('trade-history-start-date');
        if (startDateInput) {
            startDateInput.addEventListener('change', () => {
                this._startDate = startDateInput.value;
                this._currentPage = 1;
                this.renderTable();
                this.renderChart();
            });
        }

        const endDateInput = document.getElementById('trade-history-end-date');
        if (endDateInput) {
            endDateInput.addEventListener('change', () => {
                this._endDate = endDateInput.value;
                this._currentPage = 1;
                this.renderTable();
                this.renderChart();
            });
        }

        const fundSelect = document.getElementById('trade-history-fund');
        if (fundSelect) {
            fundSelect.addEventListener('change', () => {
                this._filterFund = fundSelect.value;
                this._currentPage = 1;
                this.renderTable();
                this.renderChart();
            });
        }

        const typeSelect = document.getElementById('trade-history-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                this._filterType = typeSelect.value;
                this._currentPage = 1;
                this.renderTable();
                this.renderChart();
            });
        }

        const searchBtn = document.getElementById('trade-history-search');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this._currentPage = 1;
                this.renderTable();
                this.renderChart();
            });
        }

        const resetBtn = document.getElementById('trade-history-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        const chartTypes = ['trend', 'profit', 'flow', 'structure', 'ratio', 'yield'];
        chartTypes.forEach(type => {
            const tab = document.getElementById(`chart-type-${type}`);
            if (tab) {
                tab.addEventListener('click', () => {
                    this._chartType = type;
                    this._updateChartTypeTabs();
                    this._updateChartStyleOptions();
                    this.renderChart();
                });
            }
        });

        const yearTab = document.getElementById('chart-period-year');
        const monthTab = document.getElementById('chart-period-month');

        if (yearTab) {
            yearTab.addEventListener('click', () => {
                this._chartPeriod = 'year';
                this._updateChartPeriodTabs();
                this.renderChart();
            });
        }
        if (monthTab) {
            monthTab.addEventListener('click', () => {
                this._chartPeriod = 'month';
                this._updateChartPeriodTabs();
                this.renderChart();
            });
        }

        const styleSelect = document.getElementById('chart-style-select');
        if (styleSelect) {
            styleSelect.addEventListener('change', () => {
                this._chartStyle = styleSelect.value;
                this.renderChart();
            });
        }
    },

    /**
     * 加载基金选项
     */
    loadFundOptions() {
        const fundSelect = document.getElementById('trade-history-fund');
        if (!fundSelect) return;

        const funds = window.FundManager.getAllFunds();
        let options = '<option value="all">全部基金</option>';

        for (const fund of funds) {
            options += `<option value="${fund.id}">${fund.name}（${fund.code}）</option>`;
        }

        fundSelect.innerHTML = options;
    },

    /**
     * 更新图表类型标签状态
     */
    _updateChartTypeTabs() {
        const types = ['trend', 'profit', 'flow', 'structure', 'ratio', 'yield'];
        types.forEach(type => {
            const tab = document.getElementById(`chart-type-${type}`);
            if (tab) {
                if (this._chartType === type) {
                    tab.classList.add('active', 'btn-primary');
                } else {
                    tab.classList.remove('active', 'btn-primary');
                }
            }
        });
    },

    /**
     * 更新时间周期标签状态
     */
    _updateChartPeriodTabs() {
        const yearTab = document.getElementById('chart-period-year');
        const monthTab = document.getElementById('chart-period-month');

        if (yearTab && monthTab) {
            yearTab.classList.toggle('active', this._chartPeriod === 'year');
            monthTab.classList.toggle('active', this._chartPeriod === 'month');
        }
    },

    /**
     * 根据图表类型更新可选样式
     */
    _updateChartStyleOptions() {
        const styleSelect = document.getElementById('chart-style-select');
        if (!styleSelect) return;

        let options = '';

        if (this._chartType === 'trend') {
            options = `
                <optgroup label="趋势类">
                    <option value="line">📈 折线图</option>
                    <option value="area">📊 面积图</option>
                    <option value="bar">📊 柱状图</option>
                </optgroup>
            `;
            this._chartStyle = 'line';
        } else if (this._chartType === 'profit') {
            options = `
                <optgroup label="分布类">
                    <option value="pie">🥧 饼图</option>
                    <option value="doughnut">🍩 环形图</option>
                    <option value="rose">🌹 玫瑰图</option>
                </optgroup>
                <optgroup label="对比类">
                    <option value="bar">📊 柱状图</option>
                    <option value="bar-stack">📚 堆叠柱状图</option>
                    <option value="bar-horizontal">↔️ 条形图</option>
                </optgroup>
                <optgroup label="趋势类">
                    <option value="line">📈 折线图</option>
                    <option value="area">📊 面积图</option>
                </optgroup>
            `;
            this._chartStyle = 'pie';
        } else if (this._chartType === 'flow') {
            options = `
                <optgroup label="对比类">
                    <option value="bar">📊 柱状图</option>
                    <option value="bar-stack">📚 堆叠柱状图</option>
                    <option value="bar-horizontal">↔️ 条形图</option>
                </optgroup>
                <optgroup label="趋势类">
                    <option value="line">📈 折线图</option>
                    <option value="area">📊 面积图</option>
                </optgroup>
            `;
            this._chartStyle = 'bar';
        } else if (this._chartType === 'structure' || this._chartType === 'ratio') {
            options = `
                <optgroup label="分布类">
                    <option value="pie">🥧 饼图</option>
                    <option value="doughnut">🍩 环形图</option>
                    <option value="rose">🌹 玫瑰图</option>
                </optgroup>
                <optgroup label="关系类">
                    <option value="treemap">🌳 矩形树图</option>
                </optgroup>
            `;
            this._chartStyle = 'pie';
        } else if (this._chartType === 'yield') {
            options = `
                <optgroup label="趋势类">
                    <option value="line">📈 折线图</option>
                    <option value="area">📊 面积图</option>
                </optgroup>
                <optgroup label="对比类">
                    <option value="bar">📊 柱状图</option>
                    <option value="bar-horizontal">↔️ 条形图</option>
                </optgroup>
                <optgroup label="分布类">
                    <option value="pie">🥧 饼图</option>
                    <option value="doughnut">🍩 环形图</option>
                </optgroup>
            `;
            this._chartStyle = 'line';
        }

        styleSelect.innerHTML = options;
    },

    /**
     * 重置筛选条件
     */
    resetFilters() {
        this._startDate = '';
        this._endDate = '';
        this._filterType = 'all';
        this._filterFund = 'all';
        this._currentPage = 1;

        const startDateInput = document.getElementById('trade-history-start-date');
        const endDateInput = document.getElementById('trade-history-end-date');
        const typeSelect = document.getElementById('trade-history-type');
        const fundSelect = document.getElementById('trade-history-fund');

        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (typeSelect) typeSelect.value = 'all';
        if (fundSelect) fundSelect.value = 'all';

        this.renderTable();
        this.renderChart();
    },

    /**
     * 刷新页面
     */
    refresh() {
        this.renderTable();
        this.renderChart();
    },

    /**
     * 获取筛选后的交易记录
     */
    getFilteredTrades() {
        const fundIds = this._filterFund === 'all'
            ? window.FundManager.getAllFunds().map(f => f.id)
            : [this._filterFund];

        let allTrades = [];
        for (const fundId of fundIds) {
            const trades = TradeManager.getTradesByFund(fundId);
            allTrades = allTrades.concat(trades);
        }

        let filteredTrades = [...allTrades];

        if (this._startDate) {
            filteredTrades = filteredTrades.filter(trade => trade.date >= this._startDate);
        }
        if (this._endDate) {
            filteredTrades = filteredTrades.filter(trade => trade.date <= this._endDate);
        }

        if (this._filterType !== 'all') {
            filteredTrades = filteredTrades.filter(trade => trade.type === this._filterType);
        }

        filteredTrades.sort((a, b) => new Date(b.date) - new Date(a.date));

        return filteredTrades;
    },

    /**
     * 格式化金额（保留3位小数）
     */
    _formatMoney(value) {
        if (value === null || value === undefined || isNaN(value)) return '0.000';
        return Number(value).toFixed(3);
    },

    /**
     * 格式化金额（带千分位）
     */
    _formatMoneyWithUnit(value) {
        if (value === null || value === undefined || isNaN(value)) return '0.00';
        const num = Number(value);
        const absValue = Math.abs(num);
        let result;
        if (absValue >= 10000) {
            result = (absValue / 10000).toFixed(2) + '万';
        } else {
            result = absValue.toFixed(2);
        }
        return (num < 0 ? '-' : '') + '¥' + result;
    },

    /**
     * 获取收益趋势数据
     */
    _getTrendData(trades) {
        const period = this._chartPeriod;
        const periodTrades = {};

        for (const trade of trades) {
            const date = new Date(trade.date);
            let key;

            if (period === 'year') {
                key = date.getFullYear().toString();
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!periodTrades[key]) {
                periodTrades[key] = [];
            }

            periodTrades[key].push(trade);
        }

        const keys = Object.keys(periodTrades).sort();
        const labels = [];
        const cumulativeInvest = [];
        const totalValues = [];
        const fundData = {};
        let totalInvest = 0;
        let totalSell = 0;
        let totalDividend = 0;
        const lastKey = keys[keys.length - 1];

        for (const key of keys) {
            const tradesInPeriod = periodTrades[key];
            let periodBuy = 0;
            let periodSell = 0;

            for (const trade of tradesInPeriod) {
                if (!fundData[trade.fundId]) {
                    fundData[trade.fundId] = { shares: 0, lastNetValue: trade.netValue || 0 };
                }
                const fd = fundData[trade.fundId];

                if (trade.type === 'buy') {
                    periodBuy += trade.amount;
                    fd.shares += trade.shares;
                    fd.lastNetValue = trade.netValue;
                } else if (trade.type === 'sell') {
                    periodSell += trade.amount;
                    fd.shares -= trade.shares;
                    fd.lastNetValue = trade.netValue;
                } else if (trade.type === 'dividend') {
                    fd.lastNetValue = trade.netValue;
                    if (trade.dividendMode === 'reinvest') {
                        fd.shares += trade.shares || 0;
                    } else {
                        totalDividend += trade.amount;
                    }
                }
            }

            totalInvest += periodBuy;
            totalSell += periodSell;

            let portfolioValue = 0;
            for (const fundId in fundData) {
                const fd = fundData[fundId];
                if (Utils.isPositive(fd.shares)) {
                    let netValue;
                    if (key === lastKey) {
                        const fund = window.FundManager.getFund(fundId);
                        netValue = fund
                            ? (fund.estimatedValue || fund.netValue || fd.lastNetValue)
                            : fd.lastNetValue;
                    } else {
                        netValue = fd.lastNetValue;
                    }
                    portfolioValue += fd.shares * netValue;
                }
            }

            const totalValue = portfolioValue + totalSell + totalDividend;

            labels.push(this._formatPeriodLabel(key));
            cumulativeInvest.push(totalInvest);
            totalValues.push(totalValue);
        }

        return { labels, cumulativeInvest, totalValues };
    },

    /**
     * 获取盈亏分析数据
     */
    _getProfitData(trades) {
        const period = this._chartPeriod;
        const dataMap = {};

        for (const trade of trades) {
            const date = new Date(trade.date);
            let key;

            if (period === 'year') {
                key = date.getFullYear().toString();
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!dataMap[key]) {
                dataMap[key] = { buy: 0, sell: 0, dividend: 0 };
            }

            if (trade.type === 'buy') {
                dataMap[key].buy += trade.amount;
            } else if (trade.type === 'sell') {
                dataMap[key].sell += trade.amount;
            } else if (trade.type === 'dividend') {
                dataMap[key].dividend += trade.amount;
            }
        }

        const keys = Object.keys(dataMap).sort();
        const labels = [];
        const buyData = [];
        const sellData = [];
        const dividendData = [];

        for (const key of keys) {
            labels.push(this._formatPeriodLabel(key));
            buyData.push(dataMap[key].buy);
            sellData.push(dataMap[key].sell);
            dividendData.push(dataMap[key].dividend);
        }

        return { labels, buyData, sellData, dividendData };
    },

    /**
     * 获取资金流向数据
     */
    _getFlowData(trades) {
        return this._getProfitData(trades);
    },

    /**
     * 获取资产结构数据
     */
    _getStructureData(trades) {
        const fundMap = {};

        for (const trade of trades) {
            const fund = FundManager.getFund(trade.fundId);
            const fundName = fund ? fund.name : '未知基金';

            if (!fundMap[fundName]) {
                fundMap[fundName] = { buy: 0, sell: 0, dividend: 0 };
            }

            if (trade.type === 'buy') {
                fundMap[fundName].buy += trade.amount;
            } else if (trade.type === 'sell') {
                fundMap[fundName].sell += trade.amount;
            } else if (trade.type === 'dividend') {
                fundMap[fundName].dividend += trade.amount;
            }
        }

        const data = [];
        for (const [name, values] of Object.entries(fundMap)) {
            data.push({
                name,
                value: values.buy - values.sell + values.dividend,
                buy: values.buy,
                sell: values.sell,
                dividend: values.dividend
            });
        }

        return data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    },

    /**
     * 获取基金盈亏数据（用于盈亏分析饼图）
     */
    _getFundProfitData(trades) {
        const fundProfitMap = {};
        const seenFundIds = new Set();

        for (const trade of trades) {
            if (seenFundIds.has(trade.fundId)) continue;
            seenFundIds.add(trade.fundId);

            const fund = window.FundManager.getFund(trade.fundId);
            const stats = window.FundManager.getFundStats(trade.fundId);
            const fundName = fund ? fund.name : '未知基金';
            const profit = stats && stats.summary ? (stats.summary.totalProfit || 0) : 0;
            fundProfitMap[trade.fundId] = { name: fundName, profit: profit };
        }

        return Object.values(fundProfitMap)
            .filter(function(d) { return Math.abs(d.profit) > 0.001; })
            .map(function(d) { return { name: d.name, profit: d.profit, isProfit: d.profit > 0 }; })
            .sort(function(a, b) { return Math.abs(b.profit) - Math.abs(a.profit); });
    },

    /**
     * 获取盈亏比数据
     */
    _getRatioData(trades) {
        const period = this._chartPeriod;
        const dataMap = {};

        for (const trade of trades) {
            const date = new Date(trade.date);
            let key;

            if (period === 'year') {
                key = date.getFullYear().toString();
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!dataMap[key]) {
                dataMap[key] = { buy: 0, sell: 0, dividend: 0 };
            }

            if (trade.type === 'buy') {
                dataMap[key].buy += trade.amount;
            } else if (trade.type === 'sell') {
                dataMap[key].sell += trade.amount;
            } else if (trade.type === 'dividend') {
                dataMap[key].dividend += trade.amount;
            }
        }

        const keys = Object.keys(dataMap).sort();
        const labels = [];
        const netInflow = [];
        const outflow = [];

        for (const key of keys) {
            const data = dataMap[key];
            const net = data.buy - data.sell + data.dividend;

            labels.push(this._formatPeriodLabel(key));
            netInflow.push(Math.max(0, net));
            outflow.push(Math.max(0, -net));
        }

        return { labels, netInflow, outflow };
    },

    /**
     * 获取收益率数据
     */
    _getYieldData(trades) {
        const period = this._chartPeriod;
        const dataMap = {};

        for (const trade of trades) {
            const date = new Date(trade.date);
            let key;

            if (period === 'year') {
                key = date.getFullYear().toString();
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!dataMap[key]) {
                dataMap[key] = { buy: 0, sell: 0, dividend: 0, profit: 0 };
            }

            if (trade.type === 'buy') {
                dataMap[key].buy += trade.amount;
            } else if (trade.type === 'sell') {
                dataMap[key].sell += trade.amount;
                // 估算盈利
                dataMap[key].profit += trade.amount * 0.2;
            } else if (trade.type === 'dividend') {
                dataMap[key].dividend += trade.amount;
                dataMap[key].profit += trade.amount;
            }
        }

        const keys = Object.keys(dataMap).sort();
        const labels = [];
        const totalInvest = [];
        const totalProfit = [];
        const profitRate = [];
        let investSum = 0;
        let profitSum = 0;

        for (const key of keys) {
            const data = dataMap[key];
            investSum += data.buy;
            profitSum += data.profit;

            labels.push(this._formatPeriodLabel(key));
            totalInvest.push(investSum);
            totalProfit.push(profitSum);
            profitRate.push(investSum > 0 ? (profitSum / investSum * 100) : 0);
        }

        return { labels, totalInvest, totalProfit, profitRate };
    },

    /**
     * 格式化周期标签
     */
    _formatPeriodLabel(key) {
        if (this._chartPeriod === 'year') {
            return `${key}年`;
        } else {
            const [year, month] = key.split('-');
            return `${year}年${parseInt(month)}月`;
        }
    },

    /**
     * 渲染表格
     */
    renderTable() {
        const trades = this.getFilteredTrades();
        const totalPages = Math.ceil(trades.length / this._pageSize);
        const startIndex = (this._currentPage - 1) * this._pageSize;
        const pageTrades = trades.slice(startIndex, startIndex + this._pageSize);

        this.renderTableBody(pageTrades);
        this.renderPagination(trades.length, totalPages);
        this.renderSummary(trades);
    },

    /**
     * 渲染表格主体
     */
    renderTableBody(trades) {
        const tbody = document.getElementById('trade-history-table-body');
        if (!tbody) return;

        if (trades.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-8">
                        <div class="text-4xl mb-2">📋</div>
                        <div>暂无符合条件的交易记录</div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        for (const trade of trades) {
            const fund = FundManager.getFund(trade.fundId);
            const fundName = fund ? fund.name : '未知基金';
            const fundCode = fund ? fund.code : '';

            const tradeTypeText = this._getTradeTypeText(trade.type);
            const tradeTypeClass = this._getTradeTypeClass(trade.type);

            html += `
                <tr data-trade-id="${trade.id}">
                    <td class="text-nowrap">${trade.date}</td>
                    <td class="text-nowrap">
                        <div class="font-medium">${fundName}</div>
                        <div class="text-xs text-muted">${fundCode}</div>
                    </td>
                    <td>
                        <span class="badge ${tradeTypeClass}">${tradeTypeText}</span>
                    </td>
                    <td class="text-right">${Utils.formatNumber(trade.shares, 4)}</td>
                    <td class="text-right">${Utils.formatMoney(trade.amount)}</td>
                    <td class="text-right">${Utils.formatMoney(trade.fee || 0)}</td>
                    <td class="text-nowrap">${trade.remark || '-'}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    },

    /**
     * 获取交易类型文本
     */
    _getTradeTypeText(type) {
        const map = { buy: '买入', sell: '卖出', dividend: '分红' };
        return map[type] || type;
    },

    /**
     * 获取交易类型样式类
     */
    _getTradeTypeClass(type) {
        const map = { buy: 'badge-success', sell: 'badge-danger', dividend: 'badge-info' };
        return map[type] || 'badge-default';
    },

    /**
     * 渲染分页
     */
    renderPagination(totalCount, totalPages) {
        const pagination = document.getElementById('trade-history-pagination');
        if (!pagination) return;

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '<nav class="pagination-container"><ul class="pagination">';
        html += `<li class="page-item ${this._currentPage <= 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="TradeHistory.goToPage(${this._currentPage - 1})">上一页</button>
        </li>`;

        const maxVisible = 5;
        let startPage = Math.max(1, this._currentPage - Math.floor(maxVisible / 2));
        const endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${this._currentPage === i ? 'active' : ''}">
                <button class="page-link" onclick="TradeHistory.goToPage(${i})">${i}</button>
            </li>`;
        }

        html += `<li class="page-item ${this._currentPage >= totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="TradeHistory.goToPage(${this._currentPage + 1})">下一页</button>
        </li>`;
        html += '</ul></nav>';

        pagination.innerHTML = html;
    },

    /**
     * 跳转到指定页码
     */
    goToPage(page) {
        if (page < 1) return;
        const totalTrades = this.getFilteredTrades().length;
        const totalPages = Math.ceil(totalTrades / this._pageSize);
        if (page > totalPages) return;
        this._currentPage = page;
        this.renderTable();
    },

    /**
     * 渲染汇总信息
     */
    renderSummary(trades) {
        const summaryDiv = document.getElementById('trade-history-summary');
        if (!summaryDiv) return;

        let totalBuy = 0, totalSell = 0, totalDividend = 0, totalFee = 0;

        for (const trade of trades) {
            if (trade.type === 'buy') totalBuy += trade.amount;
            else if (trade.type === 'sell') totalSell += trade.amount;
            else if (trade.type === 'dividend') totalDividend += trade.amount;
            totalFee += trade.fee || 0;
        }

        const profit = (totalSell - totalBuy * 0.8) + totalDividend - totalFee;

        summaryDiv.innerHTML = `
            <div class="summary-card">
                <div class="summary-item">
                    <div class="summary-label">总交易笔数</div>
                    <div class="summary-value">${trades.length} 笔</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">累计投入</div>
                    <div class="summary-value text-info">${Utils.formatMoney(totalBuy)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">累计卖出</div>
                    <div class="summary-value text-danger">${Utils.formatMoney(totalSell)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">累计分红</div>
                    <div class="summary-value text-success">${Utils.formatMoney(totalDividend)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">盈亏估算</div>
                    <div class="summary-value ${profit >= 0 ? 'text-success' : 'text-danger'}">
                        ${profit >= 0 ? '+' : ''}${Utils.formatMoney(profit)}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染图表
     */
    renderChart() {
        const chartContainer = document.getElementById('trade-history-chart');
        if (!chartContainer) return;

        const trades = this.getFilteredTrades();
        if (trades.length === 0) {
            chartContainer.innerHTML = '<div class="text-center text-muted py-8">暂无数据可展示</div>';
            return;
        }

        if (typeof window.echarts === 'undefined') {
            chartContainer.innerHTML = '<div class="text-center text-muted py-8">图表加载中...</div>';
            return;
        }

        const renderMap = {
            trend: '_renderTrendChart',
            profit: '_renderProfitChart',
            flow: '_renderFlowChart',
            structure: '_renderStructureChart',
            ratio: '_renderRatioChart',
            yield: '_renderYieldChart'
        };

        const renderMethod = renderMap[this._chartType];
        if (renderMethod && this[renderMethod]) {
            this[renderMethod]();
        }
    },

    /**
     * 基础tooltip格式化
     */
    _baseTooltipFormatter(params) {
        let result = `<div style="font-weight:bold;margin-bottom:8px;">${params[0].axisValue}</div>`;
        params.forEach(item => {
            const color = item.color;
            const name = item.seriesName;
            let value = item.value;
            if (typeof value === 'number') {
                value = this._formatMoney(value);
            }
            result += `<div style="display:flex;align-items:center;margin:4px 0;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${typeof color === 'string' ? color : '#3b82f6'};margin-right:8px;"></span>
                <span>${name}: ${value}</span>
            </div>`;
        });
        return result;
    },

    /**
     * 渲染收益趋势图表
     */
    _renderTrendChart() {
        const trades = this.getFilteredTrades();
        const data = this._getTrendData(trades);
        const style = this._chartStyle;

        if (style === 'line' || style === 'area') {
            this._renderEChart({
                tooltip: { trigger: 'axis', formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: ['累计投入', '持仓市值'], top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: [
                    {
                        name: '累计投入', type: 'line', smooth: true, data: data.cumulativeInvest,
                        lineStyle: { color: '#3b82f6', width: 3 },
                        areaStyle: style === 'area' ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.3)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }] } } : null,
                        itemStyle: { color: '#3b82f6' }
                    },
                    {
                        name: '持仓市值', type: 'line', smooth: true, data: data.totalValues,
                        lineStyle: { color: '#10b981', width: 3 },
                        areaStyle: style === 'area' ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16, 185, 129, 0.3)' }, { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }] } } : null,
                        itemStyle: { color: '#10b981' }
                    }
                ]
            });
        } else if (style === 'bar') {
            this._renderEChart({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: ['累计投入', '持仓市值'], top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: [
                    { name: '累计投入', type: 'bar', data: data.cumulativeInvest, itemStyle: { color: '#3b82f6' } },
                    { name: '持仓市值', type: 'bar', data: data.totalValues, itemStyle: { color: '#10b981' } }
                ]
            });
        }
    },

    /**
     * 渲染盈亏分析图表
     */
    _renderProfitChart() {
        const trades = this.getFilteredTrades();
        const style = this._chartStyle;

        if (style === 'pie' || style === 'doughnut' || style === 'rose') {
            const profitData = this._getFundProfitData(trades);
            if (!profitData.length) {
                const chartContainer = document.getElementById('trade-history-chart');
                if (chartContainer) chartContainer.innerHTML = '<div class="text-center text-muted py-8">暂无盈亏数据</div>';
                return;
            }

            const pieData = profitData.map(d => ({
                name: d.name,
                value: Number(Math.abs(d.profit).toFixed(3)),
                rawValue: d.profit,
                isProfit: d.isProfit,
                itemStyle: { color: d.isProfit ? '#10b981' : '#ef4444' }
            }));

            this._renderEChart({
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        const sign = params.data.isProfit ? '+' : '';
                        return params.name + '<br/>盈亏: ' + sign + params.data.rawValue.toFixed(2) + ' 元<br/>占比: ' + params.percent.toFixed(1) + '%';
                    }
                },
                legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20 },
                series: [{
                    type: 'pie',
                    radius: style === 'doughnut' ? ['40%', '70%'] : (style === 'rose' ? [20, 100] : '60%'),
                    center: ['40%', '50%'],
                    roseType: style === 'rose' ? 'radius' : false,
                    data: pieData,
                    itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                    label: {
                        show: true,
                        formatter: function(params) {
                            const sign = params.data.isProfit ? '+' : '';
                            return params.name + '\n' + sign + params.data.rawValue.toFixed(2);
                        }
                    },
                    emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' }, shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }]
            });
            return;
        }

        const data = this._getProfitData(trades);
        this._renderComparisonChart(data, ['买入', '卖出', '分红'], ['#10b981', '#ef4444', '#3b82f6']);
    },

    /**
     * 渲染资金流向图表
     */
    _renderFlowChart() {
        const trades = this.getFilteredTrades();
        const data = this._getFlowData(trades);
        this._renderComparisonChart(data, ['买入', '卖出', '分红'], ['#10b981', '#ef4444', '#3b82f6']);
    },

    /**
     * 渲染对比类图表（通用）
     */
    _renderComparisonChart(data, seriesNames, colors) {
        const style = this._chartStyle;
        const seriesData = [data.buyData, data.sellData, data.dividendData];

        if (style === 'pie' || style === 'doughnut' || style === 'rose') {
            const pieData = [];
            for (let i = 0; i < seriesNames.length; i++) {
                const total = seriesData[i].reduce((a, b) => a + b, 0);
                pieData.push({ name: seriesNames[i], value: Number(total.toFixed(3)) });
            }

            this._renderEChart({
                tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                legend: { orient: 'vertical', left: 'left', top: 'center' },
                series: [{
                    type: 'pie',
                    radius: style === 'doughnut' ? ['40%', '70%'] : (style === 'rose' ? [20, 100] : '60%'),
                    center: ['60%', '50%'],
                    roseType: style === 'rose' ? 'radius' : false,
                    data: pieData,
                    itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                    label: { show: true, formatter: '{b}\n{d}%' },
                    emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } }
                }]
            });
        } else if (style === 'line' || style === 'area') {
            this._renderEChart({
                tooltip: { trigger: 'axis', formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: seriesNames, top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: seriesNames.map((name, i) => ({
                    name, type: 'line', smooth: true, data: seriesData[i].map(v => Number(v.toFixed(3))),
                    lineStyle: { color: colors[i], width: 2 },
                    areaStyle: style === 'area' ? { color: colors[i] + '33' } : null,
                    itemStyle: { color: colors[i] }
                }))
            });
        } else if (style === 'bar-stack') {
            this._renderEChart({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: seriesNames, top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: seriesNames.map((name, i) => ({
                    name, type: 'bar', stack: 'total', data: seriesData[i].map(v => Number(v.toFixed(3))), itemStyle: { color: colors[i] }
                }))
            });
        } else if (style === 'bar-horizontal') {
            this._renderEChart({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: seriesNames, top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                yAxis: { type: 'category', data: data.labels },
                series: seriesNames.map((name, i) => ({
                    name, type: 'bar', data: seriesData[i].map(v => Number(v.toFixed(3))), itemStyle: { color: colors[i] }
                }))
            });
        } else {
            this._renderEChart({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: seriesNames, top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: seriesNames.map((name, i) => ({
                    name, type: 'bar', data: seriesData[i].map(v => Number(v.toFixed(3))), itemStyle: { color: colors[i] }
                }))
            });
        }
    },

    /**
     * 渲染资产结构图表
     */
    _renderStructureChart() {
        const trades = this.getFilteredTrades();
        const data = this._getStructureData(trades);
        const style = this._chartStyle;

        if (style === 'treemap') {
            this._renderEChart({
                tooltip: { formatter: info => `${info.name}<br/>持仓: ${this._formatMoneyWithUnit(info.value)}` },
                series: [{
                    type: 'treemap',
                    data: data.map(d => ({ name: d.name, value: Number(d.value.toFixed(3)), itemStyle: { borderRadius: 8 } })),
                    breadcrumb: { show: false },
                    label: { show: true, formatter: '{b}\n{c}' },
                    emphasis: { label: { show: true, fontSize: 14 } }
                }]
            });
        } else {
            const radius = style === 'doughnut' ? ['40%', '70%'] : (style === 'rose' ? [20, 100] : '60%');
            this._renderEChart({
                tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20 },
                series: [{
                    type: 'pie',
                    radius: radius,
                    center: ['40%', '50%'],
                    roseType: style === 'rose' ? 'radius' : false,
                    data: data.map(d => ({ name: d.name, value: Number(d.value.toFixed(3)) })),
                    itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                    label: { show: true, formatter: '{b}\n{d}%' },
                    emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' }, shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }]
            });
        }
    },

    /**
     * 渲染净流入分析图表
     */
    _renderRatioChart() {
        const trades = this.getFilteredTrades();
        const data = this._getRatioData(trades);
        const style = this._chartStyle;

        if (style === 'pie' || style === 'doughnut') {
            const inflow = data.netInflow.reduce((a, b) => a + b, 0);
            const outflow = data.outflow.reduce((a, b) => a + b, 0);

            this._renderEChart({
                tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                legend: { orient: 'vertical', left: 'left', top: 'center' },
                series: [{
                    type: 'pie',
                    radius: style === 'doughnut' ? ['40%', '70%'] : '60%',
                    center: ['60%', '50%'],
                    data: [
                        { name: '净流入', value: Number(inflow.toFixed(3)), itemStyle: { color: '#10b981' } },
                        { name: '净流出', value: Number(outflow.toFixed(3)), itemStyle: { color: '#ef4444' } }
                    ],
                    itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                    label: { show: true, formatter: '{b}\n{d}%' },
                    emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } }
                }]
            });
        } else if (style === 'line' || style === 'area') {
            this._renderEChart({
                tooltip: { trigger: 'axis', formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: ['净流入', '净流出'], top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: [
                    {
                        name: '净流入', type: 'line', smooth: true, data: data.netInflow.map(v => Number(v.toFixed(3))),
                        lineStyle: { color: '#10b981', width: 2 },
                        areaStyle: style === 'area' ? { color: 'rgba(16, 185, 129, 0.3)' } : null,
                        itemStyle: { color: '#10b981' }
                    },
                    {
                        name: '净流出', type: 'line', smooth: true, data: data.outflow.map(v => Number(v.toFixed(3))),
                        lineStyle: { color: '#ef4444', width: 2 },
                        areaStyle: style === 'area' ? { color: 'rgba(239, 68, 68, 0.3)' } : null,
                        itemStyle: { color: '#ef4444' }
                    }
                ]
            });
        } else if (style === 'bar-horizontal') {
            this._renderEChart({
                tooltip: { trigger: 'axis', formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: ['净流入', '净流出'], top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                yAxis: { type: 'category', data: data.labels },
                series: [
                    { name: '净流入', type: 'bar', data: data.netInflow.map(v => Number(v.toFixed(3))), itemStyle: { color: '#10b981' } },
                    { name: '净流出', type: 'bar', data: data.outflow.map(v => Number(v.toFixed(3))), itemStyle: { color: '#ef4444' } }
                ]
            });
        } else {
            this._renderEChart({
                tooltip: { trigger: 'axis', formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: ['净流入', '净流出'], top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: { type: 'value', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                series: [
                    { name: '净流入', type: 'bar', data: data.netInflow.map(v => Number(v.toFixed(3))), itemStyle: { color: '#10b981' } },
                    { name: '净流出', type: 'bar', data: data.outflow.map(v => Number(v.toFixed(3))), itemStyle: { color: '#ef4444' } }
                ]
            });
        }
    },

    /**
     * 渲染收益率分析图表
     */
    _renderYieldChart() {
        const trades = this.getFilteredTrades();
        const data = this._getYieldData(trades);
        const style = this._chartStyle;

        if (style === 'pie' || style === 'doughnut') {
            const totalInvest = data.totalInvest[data.totalInvest.length - 1] || 0;
            const totalProfit = data.totalProfit[data.totalProfit.length - 1] || 0;

            this._renderEChart({
                tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                legend: { orient: 'vertical', left: 'left', top: 'center' },
                series: [{
                    type: 'pie',
                    radius: style === 'doughnut' ? ['40%', '70%'] : '60%',
                    center: ['60%', '50%'],
                    data: [
                        { name: '累计投入', value: Number(totalInvest.toFixed(3)), itemStyle: { color: '#3b82f6' } },
                        { name: '累计收益', value: Number(totalProfit.toFixed(3)), itemStyle: { color: '#10b981' } }
                    ],
                    itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                    label: { show: true, formatter: '{b}\n{d}%' },
                    emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } }
                }]
            });
        } else {
            this._renderEChart({
                tooltip: { trigger: 'axis', formatter: this._baseTooltipFormatter.bind(this) },
                legend: { data: ['累计投入', '累计收益', '收益率%'], top: 10 },
                grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
                xAxis: { type: 'category', data: data.labels, axisLabel: { rotate: data.labels.length > 6 ? 45 : 0 } },
                yAxis: [
                    { type: 'value', name: '金额', axisLabel: { formatter: v => this._formatMoneyWithUnit(v) } },
                    { type: 'value', name: '收益率%', axisLabel: { formatter: v => v.toFixed(3) + '%' } }
                ],
                series: [
                    { name: '累计投入', type: 'bar', data: data.totalInvest.map(v => Number(v.toFixed(3))), yAxisIndex: 0, itemStyle: { color: '#3b82f6' } },
                    { name: '累计收益', type: 'bar', data: data.totalProfit.map(v => Number(v.toFixed(3))), yAxisIndex: 0, itemStyle: { color: '#10b981' } },
                    { name: '收益率%', type: 'line', smooth: true, data: data.profitRate.map(v => Number(v.toFixed(3))), yAxisIndex: 1, itemStyle: { color: '#f59e0b' }, lineStyle: { width: 3 } }
                ]
            });
        }
    },

    /**
     * 渲染 ECharts 图表
     */
    _renderEChart(option) {
        const chartContainer = document.getElementById('trade-history-chart');
        if (!chartContainer) return;

        if (this._chartInstance) {
            this._chartInstance.dispose();
        }

        this._chartInstance = window.echarts.init(chartContainer);

        // 应用主题适配 - 使用品牌色
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const themeColors = isDark ? {
            text: '#a0aec0',
            background: '#14111a',
            border: '#3d2a4d',
            primary: '#5b21b6',
            green: '#68d391',
            red: '#fc8181',
            blue: '#63b3ed',
            orange: '#f6ad55'
        } : {
            text: '#718096',
            background: '#ffffff',
            border: '#e2e8f0',
            primary: '#88d8b0',
            green: '#48bb78',
            red: '#f56565',
            blue: '#3182ce',
            orange: '#ed8936'
        };

        // 合并主题颜色到配置
        const finalOption = {
            ...option,
            backgroundColor: 'transparent',
            textStyle: {
                color: themeColors.text
            },
            title: option.title ? {
                ...option.title,
                textStyle: { color: themeColors.text }
            } : undefined,
            legend: option.legend ? {
                ...option.legend,
                textStyle: { color: themeColors.text }
            } : undefined,
            xAxis: option.xAxis ? {
                ...option.xAxis,
                axisLine: { lineStyle: { color: themeColors.border } },
                axisTick: { lineStyle: { color: themeColors.border } },
                axisLabel: { ...option.xAxis.axisLabel, color: themeColors.text },
                nameTextStyle: { color: themeColors.text }
            } : undefined,
            yAxis: option.yAxis && Array.isArray(option.yAxis) ?
                option.yAxis.map(axis => ({
                    ...axis,
                    axisLine: { lineStyle: { color: themeColors.border } },
                    axisTick: { lineStyle: { color: themeColors.border } },
                    axisLabel: { ...axis.axisLabel, color: themeColors.text },
                    nameTextStyle: { color: themeColors.text },
                    splitLine: { lineStyle: { color: themeColors.border + '40' } }
                })) :
                option.yAxis ? {
                    ...option.yAxis,
                    axisLine: { lineStyle: { color: themeColors.border } },
                    axisTick: { lineStyle: { color: themeColors.border } },
                    axisLabel: { ...option.yAxis.axisLabel, color: themeColors.text },
                    nameTextStyle: { color: themeColors.text },
                    splitLine: { lineStyle: { color: themeColors.border + '40' } }
                } : undefined
        };

        this._chartInstance.setOption(finalOption);

        window.addEventListener('resize', () => {
            this._chartInstance?.resize();
        });
    }
};

ModuleRegistry.register('TradeHistory', TradeHistory);

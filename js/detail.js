/**
 * 详情页
 * 显示单只基金的详细信息
 */

/* global SyncStatusPresenter AccrualHelper */

const Detail = {
    // 当前基金ID
    currentFundId: null,
    _syncRefreshBound: false,

    buildSyncStatusBannerHtml(syncStatus) {
        return SyncStatusPresenter.buildBannerHtml(syncStatus);
    },

    // 交易记录分页实例
    _tradePaginator: null,

    // 当前筛选条件
    _currentFilters: null,

    /**
     * 初始化详情页
     */
    init() {
        this.bindEvents();
        this.bindFeeSettingsButton();
        console.log('Detail initialized');
    },

    /**
     * 绑定费率设置按钮事件
     */
    bindFeeSettingsButton() {
        const btnFeeSettings = document.getElementById('btn-fee-settings');
        if (btnFeeSettings) {
            btnFeeSettings.addEventListener('click', () => {
                Modal.show('feeSettings', { fundId: Detail.currentFundId });
            });
        }
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const btnEditFund = document.getElementById('btn-edit-fund');
        if (btnEditFund) {
            btnEditFund.addEventListener('click', () => {
                Modal.show('editFund', { fundId: Detail.currentFundId });
            });
        }

        const btnFifoVerify = document.getElementById('btn-fifo-verify');
        if (btnFifoVerify) {
            btnFifoVerify.addEventListener('click', () => {
                Detail.verifyCalculation();
            });
        }

        const btnDeleteFund = document.getElementById('btn-delete-fund');
        if (btnDeleteFund) {
            btnDeleteFund.addEventListener('click', () => {
                Modal.show('deleteConfirm', {
                    message: '确定要删除该基金吗？相关的交易记录也会被删除。',
                    onConfirm: () => {
                        const success = FundManager.deleteFund(this.currentFundId);
                        if (success) {
                            Router.navigate('overview');
                        }
                    }
                });
            });
        }

        // 添加交易按钮
        const btnAddTrade = document.getElementById('btn-add-trade');
        if (btnAddTrade) {
            btnAddTrade.addEventListener('click', () => {
                Modal.show('addTrade', { fundId: this.currentFundId });
            });
        }

        // 监听数据变化事件
        EventBus.on(EventType.FUND_UPDATED, () => this.refresh());
        EventBus.on(EventType.TRADE_ADDED, () => this.refresh());
        EventBus.on(EventType.TRADE_UPDATED, () => this.refresh());
        EventBus.on(EventType.TRADE_DELETED, () => this.refresh());
        EventBus.on(EventType.CALCULATION_UPDATED, () => this.refresh());

        // 监听设置变化事件
        EventBus.on(EventType.SETTINGS_CHANGED, () => {
            Detail.refresh();
        });

        if (!Detail._syncRefreshBound) {
            Detail._syncRefreshBound = true;
            EventBus.on(EventType.SYNC_DATA_APPLIED, () => {
                if (Detail.currentFundId) {
                    Detail.refresh();
                }
            });
        }

        // 交易记录筛选
        const filterTradeType = document.getElementById('filter-trade-type');
        if (filterTradeType) {
            filterTradeType.addEventListener('change', () => {
                Detail.applyTradeFilters();
            });
        }

        const filterStartDate = document.getElementById('filter-start-date');
        if (filterStartDate) {
            filterStartDate.addEventListener('change', () => {
                Detail.applyTradeFilters();
            });
        }

        const filterEndDate = document.getElementById('filter-end-date');
        if (filterEndDate) {
            filterEndDate.addEventListener('change', () => {
                Detail.applyTradeFilters();
            });
        }

        const btnClearFilter = document.getElementById('btn-clear-filter');
        if (btnClearFilter) {
            btnClearFilter.addEventListener('click', () => {
                Detail.clearTradeFilters();
            });
        }

        // 展示模式切换按钮（事件委托）
        const filterBar = document.querySelector('.trade-filter-bar');
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                const modeBtn = e.target.closest('.display-mode-btn');
                if (modeBtn) {
                    const mode = modeBtn.dataset.mode;
                    if (mode && mode !== CycleTradeDisplay.getDisplayMode()) {
                        CycleTradeDisplay.toggleDisplayMode();
                    }
                }
            });

            filterBar.addEventListener('change', (e) => {
                if (e.target.id === 'filter-cycle') {
                    const cycleId = e.target.value ? parseInt(e.target.value) : null;
                    CycleTradeDisplay.applyFilters({ cycleId: cycleId });
                }
            });
        }
    },

    /**
     * 加载基金详情
     * @param {string} fundId - 基金ID
     */
    async load(fundId) {
        this.currentFundId = fundId;

        // 自动刷新基金数据（从API获取最新净值）
        try {
            await FundManager.refreshFund(fundId);
        } catch (e) {
            console.warn('自动刷新失败，使用缓存数据', e);
        }

        this.refresh();
    },

    renderSyncStatusBanner() {
    },

    /**
     * 刷新详情页
     */
    refresh() {
        if (!this.currentFundId) return;

        const fund = FundManager.getFund(this.currentFundId);
        if (!fund) {
            Utils.showToast('基金不存在', 'error');
            Router.navigate('overview');
            return;
        }

        this.updateFundInfo(fund);
        this.updateHoldingInfo(fund);
        this.updateTradeList(fund);
        // renderFeeTiers已移至弹窗，不需要在这里调用
    },

    /**
     * 更新基金信息
     * @param {object} fund - 基金对象
     */
    updateFundInfo(fund) {
        // 基金标题区：基金名称和代码
        const fundName = document.getElementById('detail-fund-name');
        const fundCode = document.getElementById('detail-fund-code');
        if (fundName) fundName.textContent = fund.name;
        if (fundCode) fundCode.textContent = fund.code;

        // 基金信息区域 - 新结构
        const netValue = document.getElementById('info-net-value');
        const netDate = document.getElementById('info-net-date');
        const estimatedValue = document.getElementById('info-estimated-value');
        const estimatedGrowth = document.getElementById('info-estimated-growth');
        const updateTime = document.getElementById('info-update-time');
        const code = document.getElementById('info-code');
        const name = document.getElementById('info-name');
        const remark = document.getElementById('info-remark');

        // 核心数据：最新净值 + 净值日期（统一4位小数）
        if (netValue) netValue.textContent = fund.netValue ? Utils.formatNumber(fund.netValue, 4) : '-';
        if (netDate) netDate.textContent = fund.netValueDate ? `(${fund.netValueDate})` : '';

        // 核心数据：估算净值 + 更新时间 + 涨跌幅（统一4位小数）
        if (estimatedValue) estimatedValue.textContent = fund.estimatedValue ? Utils.formatNumber(fund.estimatedValue, 4) : '-';
        if (updateTime) {
            if (fund.updateTime) {
                const updateDate = new Date(fund.updateTime);
                updateTime.textContent = `(${updateDate.toLocaleString('zh-CN')})`;
            } else {
                updateTime.textContent = '';
            }
        }
        if (estimatedGrowth) {
            if (fund.estimatedGrowth !== undefined && fund.estimatedGrowth !== null) {
                const rate = parseFloat(fund.estimatedGrowth);
                const className = rate >= 0 ? 'core-change positive' : 'core-change negative';
                // 涨跌幅统一显示2位小数
                estimatedGrowth.textContent = `${rate >= 0 ? '↑ +' : '↓ '}${rate.toFixed(2)}%`;
                estimatedGrowth.className = className;
            } else {
                estimatedGrowth.textContent = '-';
                estimatedGrowth.className = 'core-change';
            }
        }

        // 详细信息网格
        if (code) code.textContent = fund.code;
        if (name) name.textContent = fund.name;
        if (remark) remark.textContent = fund.remark || '-';
    },

    /**
     * 更新持仓信息
     * @param {object} fund - 基金对象
     */
    updateHoldingInfo(fund) {
        const stats = FundManager.getFundStats(fund.id);
        if (!stats) {
            console.warn('No stats for fund:', fund.id);
            return;
        }

        console.log('Stats data:', stats);
        console.log('Summary:', stats.summary);
        console.log('Total Profit:', stats.summary.totalProfit);
        console.log('Profit Rate:', stats.summary.profitRate);
        console.log('Total Realized:', stats.summary.totalRealizedProfit);
        console.log('Total Floating:', stats.summary.totalFloatingProfit);
        console.log('Current Holding:', stats.summary.currentHolding);

        const summary = stats.summary;
        const currentHolding = summary.currentHolding;

        const holdingView = window.DetailHoldingHelper.buildHoldingViewModel(summary);
        const isCleared = holdingView.isCleared;

        // 基础持仓信息
        const shares = document.getElementById('holding-shares');
        const cost = document.getElementById('holding-cost');
        const costPerShare = document.getElementById('cost-per-share');
        const value = document.getElementById('holding-value');
        const profit = document.getElementById('holding-profit');
        const rate = document.getElementById('holding-rate');
        const profitEstimated = document.getElementById('holding-profit-estimated');
        const rateEstimated = document.getElementById('holding-rate-estimated');

        // 已实现收益和总收益
        const realizedProfit = document.getElementById('realized-profit');
        const totalProfit = document.getElementById('detail-total-profit');
        const totalRate = document.getElementById('detail-total-rate');

        // 持仓周期信息
        const cycleCount = document.getElementById('cycle-count');
        const closedCycles = document.getElementById('closed-cycles');
        const activeCycles = document.getElementById('active-cycles');
        const cycleList = document.getElementById('cycle-list');

        // 显示基础持仓
        if (shares) {
            shares.textContent = Utils.formatNumber(currentHolding.shares || 0);
        }
        if (cost) {
            cost.innerHTML = Utils.formatMoneySmart(currentHolding.cost || 0);
        }
        if (costPerShare) {
            const costPrice = isCleared ? 0 : (Utils.isPositive(currentHolding.shares) ? currentHolding.cost / currentHolding.shares : 0);
            costPerShare.textContent = Utils.isPositive(costPrice) ? `¥${Utils.formatNumber(costPrice, 4)}` : '¥0.0000';
        }
        if (value) {
            value.innerHTML = Utils.formatMoneySmart(currentHolding.value || 0);
        }

        // 获取交易记录，用于计算浮动盈亏
        const trades = TradeManager.getTradesByFund(fund.id);

        // 使用专用方法计算浮动盈亏（基于最新净值）和预估浮动盈亏（基于估算净值）
        const floatingData = CalculatorV2.calculateFloatingProfit(trades, fund);
        const estimatedData = CalculatorV2.calculateEstimatedFloatingProfit(trades, fund);

        // 显示浮动盈亏（使用最新净值）
        if (profit) {
            const displayProfit = isCleared ? 0 : (floatingData.floatingProfit || 0);
            profit.innerHTML = Utils.formatMoneySmart(displayProfit);
            profit.className = `value ${Utils.getValueColor(displayProfit)}`;
        }

        if (rate) {
            if (isCleared) {
                rate.textContent = '-';
                rate.className = 'value';
            } else {
                rate.textContent = Utils.formatPercent(floatingData.profitRate);
                rate.className = `value ${Utils.getValueColor(floatingData.profitRate)}`;
            }
        }

        // 显示预估收益（使用估算净值）
        if (profitEstimated || rateEstimated) {
            if (Utils.isPositive(estimatedData.shares) && Utils.isPositive(estimatedData.cost)) {
                if (profitEstimated) {
                    profitEstimated.innerHTML = Utils.formatMoneySmart(estimatedData.floatingProfit);
                    profitEstimated.className = `value ${Utils.getValueColor(estimatedData.floatingProfit)}`;
                }
                if (rateEstimated) {
                    rateEstimated.textContent = Utils.formatPercent(estimatedData.profitRate);
                    rateEstimated.className = `value ${Utils.getValueColor(estimatedData.profitRate)}`;
                }
            } else {
                if (profitEstimated) {
                    profitEstimated.innerHTML = '-';
                    profitEstimated.className = 'value';
                }
                if (rateEstimated) {
                    rateEstimated.textContent = '-';
                    rateEstimated.className = 'value';
                }
            }
        }

        // 显示已实现收益
        if (realizedProfit) {
            realizedProfit.innerHTML = Utils.formatMoneySmart(summary.totalRealizedProfit || 0);
            realizedProfit.className = `value ${Utils.getValueColor(summary.totalRealizedProfit || 0)}`;
        }

        // 显示总投入（新增）
        const totalInvest = document.getElementById('detail-total-invest');
        if (totalInvest) {
            totalInvest.innerHTML = Utils.formatMoneySmart(summary.totalInvest || 0);
        }

        // 显示总收益
        if (totalProfit) {
            totalProfit.innerHTML = Utils.formatMoneySmart(summary.totalProfit || 0);
            totalProfit.className = `value ${Utils.getValueColor(summary.totalProfit || 0)}`;
        }

        // 显示总收益率
        if (totalRate) {
            totalRate.textContent = Utils.formatPercent(summary.profitRate || 0);
            totalRate.className = `value ${Utils.getValueColor(summary.profitRate || 0)}`;
        }

        // 显示持仓周期统计
        if (cycleCount) cycleCount.textContent = summary.totalCycles;
        if (closedCycles) closedCycles.textContent = summary.closedCycles;
        if (activeCycles) activeCycles.textContent = summary.activeCycles;

        // 显示周期列表
        if (cycleList) {
            this.renderCycleList(stats.cycles, summary);
        }

        // 更新计提计算器
        if (typeof AccrualHelper !== 'undefined') {
            AccrualHelper.refresh(fund, trades);
        }

        // 更新图表区域
        this.updateChart(fund, stats);
    },

    /**
     * 更新图表
     * @param {object} fund - 基金对象
     * @param {object} stats - 统计数据
     */
    updateChart(fund, stats) {
        if (ChartManager.isEChartsAvailable()) {
            // 持仓成本趋势图
            const costTrendContainer = document.getElementById('chart-cost-trend');
            if (costTrendContainer) {
                const trades = TradeManager.getTradesByFund(fund.id);
                ChartManager.createChart('chart-cost-trend', ChartManager.buildCostTrendOption(fund, trades, stats));
            }

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


        } else {
            // Fallback: ECharts不可用时显示空状态提示
            const chartIds = ['chart-cost-trend', 'chart-share-change', 'chart-fund-flow', 'chart-cycle-compare'];
            chartIds.forEach(function(id) {
                const container = document.getElementById(id);
                if (container) container.innerHTML = '<p style="text-align: center; color: var(--color-text-tertiary); padding: 40px;">ECharts未加载</p>';
            });
        }
    },

    /**
     * 渲染持仓周期列表
     * @param {array} cycles - 持仓周期数组
     * @param {object} summary - 汇总数据
     */
    renderCycleList(cycles, _summary) {
        const cycleList = document.getElementById('cycle-list');
        if (!cycleList) return;

        if (!cycles || cycles.length === 0) {
            cycleList.innerHTML = '<p style="color: #999; text-align: center;">暂无持仓周期</p>';
            return;
        }

        let html = '';
        cycles.forEach(cycle => {
            const statusText = cycle.status === 'closed' ? '已结束' : '进行中';
            const statusColor = cycle.status === 'closed' ? '#4caf50' : '#ff9800';

            html += `
                <div class="cycle-item" style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-weight: bold; color: ${statusColor};">周期${cycle.id} (${statusText})</span>
                        <span style="color: #666; font-size: 14px;">${cycle.startDate} ~ ${cycle.endDate || '至今'}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 14px;">
                        <div>
                            <span style="color: #666;">投入：</span>
                            <span style="font-weight: bold;">¥${cycle.totalInvest.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style="color: var(--color-text-tertiary);">收益：</span>
                            <span class="${cycle.totalProfit >= 0 ? 'text-rise' : 'text-fall'}" style="font-weight: bold;">¥${isNaN(cycle.totalProfit) ? '0.00' : cycle.totalProfit.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style="color: var(--color-text-tertiary);">收益率：</span>
                            <span class="${cycle.profitRate >= 0 ? 'text-rise' : 'text-fall'}" style="font-weight: bold;">${isNaN(cycle.profitRate) ? '0.00' : cycle.profitRate.toFixed(2)}%</span>
                        </div>
                        <div>
                            <span style="color: var(--color-text-tertiary);">持仓天数：</span>
                            <span style="font-weight: bold;">${cycle.holdingDays || 0}天</span>
                        </div>
                    </div>
                </div>
            `;
        });

        cycleList.innerHTML = html;
    },

    /**
     * 更新交易记录
     * @param {object} fund - 基金对象
     */
    updateTradeList(fund) {
        const trades = TradeManager.getTradesByFund(fund.id);
        const tradeList = document.getElementById('trade-list');
        const paginationContainer = document.getElementById('trade-pagination-container');

        if (!tradeList) return;

        // 获取收益数据
        const stats = FundManager.getFundStats(fund.id);
        const realizedDetails = stats?.realized?.details || [];
        const profitMap = new Map();
        for (const detail of realizedDetails) {
            profitMap.set(detail.tradeId, detail);
        }

        const sortedAsc = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        const cycles = CalculatorV2.identifyHoldingCycles(sortedAsc);

        CycleTradeDisplay.init(fund.id, tradeList, profitMap, cycles);

        // 根据显示模式渲染
        if (CycleTradeDisplay.getDisplayMode() === 'grouped') {
            CycleTradeDisplay.renderTradeSection();
            return;
        }

        // 列表视图：扁平模式
        CycleTradeDisplay.renderFlatMode();

        // 为扁平视图的交易设置 cycleId
        const tradeCycleMap = {};
        for (const cycle of cycles) {
            for (const trade of cycle.trades) {
                tradeCycleMap[trade.id] = cycle.id;
            }
        }

        // 按日期倒序排列
        const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

        // 为每笔交易设置 cycleId
        for (const trade of sortedTrades) {
            trade.cycleId = tradeCycleMap[trade.id] || 0;
        }

        // 创建或更新分页实例
        Detail._tradePaginator = Paginator.create({
            data: sortedTrades,
            pageSize: Detail._getPageSize(),
            onPageChange: (pageData) => {
                Detail.renderTradePage(pageData, profitMap);
            },
            onFilterChange: (inst) => {
                const pageData = Paginator.getCurrentPageData(inst);
                Detail.renderTradePage(pageData, profitMap);
                if (paginationContainer) {
                    paginationContainer.innerHTML = Paginator.renderControls(inst);
                    Detail.bindPaginationEvents();
                }
                const filterCount = document.getElementById('filter-result-count');
                if (filterCount) {
                    filterCount.textContent = `共 ${inst.filteredData.length} 条记录`;
                }
            }
        });

        // 应用当前筛选条件
        if (Detail._currentFilters) {
            Paginator.applyFilters(Detail._tradePaginator, Detail._currentFilters);
        }

        // 渲染第一页
        const pageData = Paginator.getCurrentPageData(Detail._tradePaginator);
        Detail.renderTradePage(pageData, profitMap);

        // 渲染分页控件
        if (paginationContainer) {
            paginationContainer.innerHTML = Paginator.renderControls(Detail._tradePaginator);
            Detail.bindPaginationEvents();
        }

        // 更新筛选结果数量
        const filterCount = document.getElementById('filter-result-count');
        if (filterCount) {
            filterCount.textContent = `共 ${Detail._tradePaginator.filteredData.length} 条记录`;
        }
    },

    /**
     * 渲染交易记录行
     * @param {object} trade - 交易对象
     * @param {Map} profitMap - 收益数据映射
     * @returns {string}
     */
    renderTradeRow(trade, profitMap = new Map()) {
        const typeText = {
            buy: '买入',
            sell: '卖出',
            dividend: '分红'
        };

        const typeBadgeClass = {
            buy: 'trade-type-badge trade-type-buy',
            sell: 'trade-type-badge trade-type-sell',
            dividend: 'trade-type-badge trade-type-dividend'
        };

        const priceDisplay = trade.netValue ? Utils.formatNumber(trade.netValue, 4) : '-';
        let profitDisplay = '-';
        let profitClass = '';

        // 从 profitMap 中查找对应交易的收益数据
        if (trade.type === 'sell') {
            const profitData = profitMap.get(trade.id);
            if (profitData) {
                const profitSign = profitData.profit >= 0 ? '+' : '';
                const rateSign = profitData.profitRate >= 0 ? '+' : '';
                profitDisplay = profitSign + Utils.formatMoneySmart(profitData.profit) + ' / ' + rateSign + Utils.formatNumber(profitData.profitRate, 2) + '%';
                profitClass = profitData.profit >= 0 ? 'trade-profit--positive' : 'trade-profit--negative';
            }
        }
        const cycleLabel = trade.cycleId > 0 ? '第' + trade.cycleId + '轮' : '-';

        // 主行
        let html = `
            <tr data-trade-id="${trade.id}">
                <td>${trade.date}</td>
                <td><span class="${typeBadgeClass[trade.type]}">${typeText[trade.type]}</span></td>
                <td>${priceDisplay}</td>
                <td>${Utils.formatNumber(trade.shares)}</td>
                <td>${Utils.formatMoney(trade.fee)}</td>
                <td>${Utils.formatMoney(trade.amount)}</td>
                <td class="${profitClass}">${profitDisplay}</td>
                <td>${cycleLabel}</td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit-trade">编辑</button>
                    <button class="btn btn-danger btn-sm btn-delete-trade">删除</button>
                </td>
            </tr>
        `;

        // 如果有备注，添加引用行
        if (trade.remark) {
            html += `
                <tr class="trade-remark-row">
                    <td colspan="9">
                        <div class="remark-content">
                            <span class="remark-icon">💬</span>
                            <span class="remark-text">${trade.remark}</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        return html;
    },

    /**
     * 渲染当前页交易记录
     * @param {Array} pageData - 当前页数据
     * @param {Map} profitMap - 收益数据映射
     */
    renderTradePage(pageData, profitMap = new Map()) {
        const tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        if (pageData.length === 0) {
            tradeList.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--color-text-tertiary);">没有匹配的交易记录</td></tr>';
            return;
        }

        const rows = pageData.map(trade => Detail.renderTradeRow(trade, profitMap));
        tradeList.innerHTML = rows.join('');
        Detail.bindTradeActions();
    },

    /**
     * 绑定分页控件事件
     */
    bindPaginationEvents() {
        const paginationContainer = document.getElementById('trade-pagination-container');
        const paginator = CycleTradeDisplay._groupedPaginator;
        if (!paginationContainer || !paginator) return;

        // 页码按钮
        paginationContainer.querySelectorAll('.page-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                Paginator.goToPage(paginator, page);
                paginationContainer.innerHTML = Paginator.renderControls(paginator);
                Detail.bindPaginationEvents();
            });
        });

        // 上一页/下一页
        paginationContainer.querySelectorAll('.page-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'prev') {
                    Paginator.goToPage(paginator, paginator.currentPage - 1);
                } else if (action === 'next') {
                    Paginator.goToPage(paginator, paginator.currentPage + 1);
                }
                paginationContainer.innerHTML = Paginator.renderControls(paginator);
                Detail.bindPaginationEvents();
            });
        });

        // 每页条数
        paginationContainer.querySelectorAll('.page-size-select').forEach(select => {
            select.addEventListener('change', () => {
                Paginator.setPageSize(paginator, parseInt(select.value));
                paginationContainer.innerHTML = Paginator.renderControls(paginator);
                Detail.bindPaginationEvents();
            });
        });
    },

    /**
     * 应用交易记录筛选
     */
    applyTradeFilters() {
        const type = document.getElementById('filter-trade-type')?.value || null;
        const startDate = document.getElementById('filter-start-date')?.value || null;
        const endDate = document.getElementById('filter-end-date')?.value || null;

        Detail._currentFilters = { type: type || null, startDate: startDate || null, endDate: endDate || null };

        if (CycleTradeDisplay.getDisplayMode() === 'grouped' && CycleTradeDisplay._initialized) {
            CycleTradeDisplay.applyFilters({
                type: type || null,
                startDate: startDate || null,
                endDate: endDate || null
            });
            return;
        }

        if (Detail._tradePaginator) {
            Paginator.applyFilters(Detail._tradePaginator, Detail._currentFilters);
            const paginationContainer = document.getElementById('trade-pagination-container');
            if (paginationContainer) {
                paginationContainer.innerHTML = Paginator.renderControls(Detail._tradePaginator);
                Detail.bindPaginationEvents();
            }
        }
    },

    /**
     * 清除交易记录筛选
     */
    clearTradeFilters() {
        Detail._currentFilters = null;

        const filterTradeType = document.getElementById('filter-trade-type');
        const filterStartDate = document.getElementById('filter-start-date');
        const filterEndDate = document.getElementById('filter-end-date');

        if (filterTradeType) filterTradeType.value = '';
        if (filterStartDate) filterStartDate.value = '';
        if (filterEndDate) filterEndDate.value = '';

        if (CycleTradeDisplay.getDisplayMode() === 'grouped' && CycleTradeDisplay._initialized) {
            CycleTradeDisplay.clearFilters();
            return;
        }

        if (Detail._tradePaginator) {
            Paginator.clearFilters(Detail._tradePaginator);
            const paginationContainer = document.getElementById('trade-pagination-container');
            if (paginationContainer) {
                paginationContainer.innerHTML = Paginator.renderControls(Detail._tradePaginator);
                Detail.bindPaginationEvents();
            }
        }
    },

    /**
     * 绑定交易记录操作事件
     */
    bindTradeActions() {
        const tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        tradeList.querySelectorAll('.btn-edit-trade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = e.target.closest('tr');
                const tradeId = row.dataset.tradeId;
                const trade = TradeManager.getTrade(tradeId);

                if (trade) {
                    const payload = window.DetailTradeActionHelper.buildEditTradePayload(trade);
                    Modal.show(payload.type, payload.data);
                }
            });
        });

        tradeList.querySelectorAll('.btn-delete-trade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = e.target.closest('tr');
                const tradeId = row.dataset.tradeId;

                const payload = window.DetailTradeActionHelper.buildDeleteTradePayload(tradeId);
                Modal.show(payload.type, payload.data);
            });
        });
    },

    showNameEditUI() {
        const fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        const nameEl = document.getElementById('detail-fund-name');
        if (!nameEl) return;

        const currentName = fund.name || '';

        nameEl.innerHTML = window.DetailEditHelper.renderNameEditHtml(currentName);

        const input = document.getElementById('input-edit-fund-name');
        const btnSave = document.getElementById('btn-save-fund-name');
        const btnCancel = document.getElementById('btn-cancel-fund-name');

        if (input) input.focus();

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                Detail.saveFundName();
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                Detail.cancelNameEdit();
            });
        }
    },

    showEditMenu() {
        const menuHtml = window.DetailMenuHelper.renderEditMenuHtml();

        const actionsEl = document.querySelector('.fund-title-area');
        if (!actionsEl) return;

        actionsEl.insertAdjacentHTML('beforeend', menuHtml);

        const overlay = document.getElementById('edit-menu-overlay');
        const menuEditName = document.getElementById('menu-edit-name');
        const menuRefreshName = document.getElementById('menu-refresh-name');

        const closeMenu = function() {
            if (overlay) overlay.remove();
        };

        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) closeMenu();
            });
        }

        if (menuEditName) {
            menuEditName.addEventListener('click', function() {
                closeMenu();
                Detail.showNameEditUI();
            });
        }

        const menuEditRemark = document.getElementById('menu-edit-remark');
        if (menuEditRemark) {
            menuEditRemark.addEventListener('click', function() {
                closeMenu();
                Detail.showRemarkEditUI();
            });
        }

        if (menuRefreshName) {
            menuRefreshName.addEventListener('click', async function() {
                closeMenu();
                await Detail.refreshFundName();
            });
        }
    },

    saveFundName() {
        const input = document.getElementById('input-edit-fund-name');
        if (!input) return;

        const newName = input.value.trim();
        if (!newName) {
            Utils.showToast('基金名称不能为空', 'error');
            return;
        }

        const success = FundManager.updateFund(
            Detail.currentFundId,
            window.DetailFundUpdateHelper.buildNameUpdatePayload(newName)
        );

        if (success) {
            NameCache.set(FundManager.getFund(Detail.currentFundId).code, newName, 'manual');
            Detail.refresh();
            Utils.showToast('基金名称已更新', 'success');
        }
    },

    cancelNameEdit() {
        const fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        const nameEl = document.getElementById('detail-fund-name');
        if (nameEl) {
            nameEl.textContent = fund.name;
        }
    },

    showRemarkEditUI() {
        const fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        const remarkEl = document.getElementById('info-remark');
        if (!remarkEl) return;

        const currentRemark = fund.remark || '';

        remarkEl.innerHTML = window.DetailEditHelper.renderRemarkEditHtml(currentRemark);

        const input = document.getElementById('input-edit-fund-remark');
        const btnSave = document.getElementById('btn-save-fund-remark');
        const btnCancel = document.getElementById('btn-cancel-fund-remark');

        if (input) input.focus();

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                Detail.saveRemark();
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                Detail.cancelRemarkEdit();
            });
        }
    },

    saveRemark() {
        const input = document.getElementById('input-edit-fund-remark');
        if (!input) return;

        const newRemark = input.value.trim();

        const success = FundManager.updateFund(
            Detail.currentFundId,
            window.DetailFundUpdateHelper.buildRemarkUpdatePayload(newRemark)
        );

        if (success) {
            Detail.refresh();
            Utils.showToast('备注已更新', 'success');
        }
    },

    cancelRemarkEdit() {
        const fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        const remarkEl = document.getElementById('info-remark');
        if (remarkEl) {
            remarkEl.textContent = fund.remark || '-';
        }
    },

    async refreshFundName() {
        const fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        const btn = document.getElementById('btn-refresh-fund-name');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '...';
        }

        try {
            FundAPI.clearCacheForFund(fund.code);
            NameCache.remove(fund.code);

            const name = await FundAPI.fetchNameOnly(fund.code);
            const validation = NameValidator.detectGarbled(name);

            if (validation.isGarbled) {
                Utils.showToast('获取的名称可能存在乱码，请手动编辑', 'warning');
                Detail.cancelNameEdit();
                const nameEl = document.getElementById('detail-fund-name');
                if (nameEl) nameEl.textContent = name;
            } else {
                const success = FundManager.updateFund(Detail.currentFundId, {
                    name: name,
                    nameSource: 'api',
                    nameUpdateTime: new Date().toISOString()
                });

                if (success) {
                    NameCache.set(fund.code, name, 'api');
                    Detail.refresh();
                    Utils.showToast('基金名称已刷新', 'success');
                }
            }
        } catch (error) {
            Utils.showToast('刷新失败: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔄';
            }
        }
    },

    verifyCalculation() {
        if (!Detail.currentFundId) {
            Utils.showToast('请先选择基金', 'warning');
            return;
        }

        const result = FIFOValidator.getDetailedResult(Detail.currentFundId);

        if (!result || !result.success) {
            Utils.showToast('验证失败：' + (result?.message || '未知错误'), 'error');
            return;
        }

        if (result.empty) {
            Utils.showToast('无交易记录', 'info');
            return;
        }

        Modal.show('verifyResult', { fundId: Detail.currentFundId });
    },

    /**
     * 从设置中读取每页条数
     * @returns {number}
     */
    _getPageSize() {
        const settings = window.AppSettingsService.loadSettings() || {};
        return settings.defaultPageSize || Config.get('ui.defaultPageSize', 10);
    }
};

// 注册到模块系统
ModuleRegistry.register('Detail', Detail);

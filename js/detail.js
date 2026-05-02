/**
 * 详情页
 * 显示单只基金的详细信息
 */

const Detail = {
    // 当前基金ID
    currentFundId: null,

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
        const btnBack = document.getElementById('btn-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                Router.navigate('overview');
            });
        }

        const btnEditFund = document.getElementById('btn-edit-fund');
        if (btnEditFund) {
            btnEditFund.addEventListener('click', () => {
                Detail.showEditMenu();
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
    load(fundId) {
        this.currentFundId = fundId;
        this.refresh();
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

        // 判断是否已清仓
        const EPSILON = 0.0001;
        const isCleared = currentHolding.shares <= EPSILON;

        // 基础持仓信息
        const shares = document.getElementById('holding-shares');
        const cost = document.getElementById('holding-cost');
        const costPerShare = document.getElementById('cost-per-share');
        const value = document.getElementById('holding-value');
        const profit = document.getElementById('holding-profit');
        const rate = document.getElementById('holding-rate');

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
            shares.setAttribute('data-tooltip', '持有份额\n计算公式：未卖出买入交易的份额总和\n说明：当前实际持有的基金份额数量');
        }
        if (cost) {
            cost.innerHTML = Utils.formatMoneySmart(currentHolding.cost || 0);
            cost.setAttribute('data-tooltip', '持有成本\n计算公式：Σ(买入金额)，含手续费\n说明：当前持仓的总成本');
        }
        if (costPerShare) {
            const costPrice = isCleared ? 0 : (currentHolding.shares > 0 ? currentHolding.cost / currentHolding.shares : 0);
            costPerShare.textContent = costPrice > 0 ? `¥${Utils.formatNumber(costPrice, 4)}` : '¥0.0000';
            costPerShare.setAttribute('data-tooltip', '持有成本价\n计算公式：持有成本 ÷ 持有份额\n说明：每股的平均持仓成本');
        }
        if (value) {
            value.innerHTML = Utils.formatMoneySmart(currentHolding.value || 0);
            value.setAttribute('data-tooltip', '当前市值\n计算公式：持有份额 × 最新净值\n说明：按最新净值计算（非估算净值）');
        }

        if (profit) {
            const displayProfit = isCleared ? 0 : (currentHolding.floatingProfit || 0);
            profit.innerHTML = Utils.formatMoneySmart(displayProfit);
            profit.className = `value ${Utils.getValueColor(displayProfit)}`;
            profit.setAttribute('data-tooltip', '浮动盈亏\n计算公式：当前市值 - 持有成本\n说明：未实现收益，随最新净值波动');
        }

        if (rate) {
            if (isCleared) {
                rate.textContent = '-';
                rate.className = 'value';
            } else {
                const holdingRate = currentHolding.cost > 0
                    ? (currentHolding.floatingProfit / currentHolding.cost * 100)
                    : 0;
                rate.textContent = Utils.formatPercent(holdingRate);
                rate.className = `value ${Utils.getValueColor(holdingRate)}`;
                rate.setAttribute('data-tooltip', '持仓收益率\n计算公式：浮动盈亏 ÷ 持有成本 × 100%');
            }
        }

        // 显示已实现收益
        if (realizedProfit) {
            realizedProfit.innerHTML = Utils.formatMoneySmart(summary.totalRealizedProfit || 0);
            realizedProfit.className = `value ${Utils.getValueColor(summary.totalRealizedProfit || 0)}`;
            realizedProfit.setAttribute('data-tooltip', '已实现收益\n计算公式：Σ(卖出到手金额 - 卖出份额×持仓成本价)');
        }

        // 显示总投入（新增）
        const totalInvest = document.getElementById('detail-total-invest');
        if (totalInvest) {
            totalInvest.innerHTML = Utils.formatMoneySmart(summary.totalInvest || 0);
            totalInvest.setAttribute('data-tooltip', '总投入\n计算公式：Σ(所有买入金额)，含手续费\n说明：所有持仓周期的投入总和');
        }

        // 显示总收益
        if (totalProfit) {
            totalProfit.innerHTML = Utils.formatMoneySmart(summary.totalProfit || 0);
            totalProfit.className = `value ${Utils.getValueColor(summary.totalProfit || 0)}`;
            totalProfit.setAttribute('data-tooltip', '总收益\n计算公式：已实现收益 + 浮动盈亏\n说明：本列有总投入、总收益、总收益率');
        }

        // 显示总收益率
        if (totalRate) {
            totalRate.textContent = Utils.formatPercent(summary.profitRate || 0);
            totalRate.className = `value ${Utils.getValueColor(summary.profitRate || 0)}`;
            totalRate.setAttribute('data-tooltip', '总收益率\n计算公式：总收益 ÷ 总投入 × 100%\n说明：总投入见本列上方');
        }

        // 显示持仓周期统计
        if (cycleCount) cycleCount.textContent = summary.totalCycles;
        if (closedCycles) closedCycles.textContent = summary.closedCycles;
        if (activeCycles) activeCycles.textContent = summary.activeCycles;

        // 显示周期列表
        if (cycleList) {
            this.renderCycleList(stats.cycles, summary);
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
            const summary = stats.summary;

            if (summary.totalCycles === 0) {
                const container = document.getElementById('chart-detail-trend');
                if (container) container.innerHTML = '<p style="text-align: center; color: var(--color-text-tertiary); padding: 40px;">暂无交易记录</p>';
                return;
            }

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

            const costTrendContainer = document.getElementById('chart-cost-trend');
            if (costTrendContainer) {
                const trades = TradeManager.getTradesByFund(fund.id);
                ChartManager.createChart('chart-cost-trend', ChartManager.buildCostTrendOption(fund, trades, stats));
            }
        } else {
            // Fallback: 简单统计
            const container = document.getElementById('chart-detail-trend');
            if (container) {
                const summary = stats.summary;
                let html = '<div style="padding: 20px;">';
                html += '<h4 style="margin-bottom: 15px;">收益情况</h4>';
                html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
                html += '<div style="padding: 10px; background: var(--color-bg-tertiary); border-radius: 4px;">';
                html += '<div style="color: var(--color-text-secondary); font-size: 12px;">已实现收益</div>';
                html += `<div style="font-weight: bold;">${Utils.formatMoneySmart(summary.totalRealizedProfit || 0)}</div>`;
                html += '</div>';
                html += '<div style="padding: 10px; background: var(--color-bg-tertiary); border-radius: 4px;">';
                html += '<div style="color: var(--color-text-secondary); font-size: 12px;">浮动收益</div>';
                html += `<div style="font-weight: bold;">${Utils.formatMoneySmart(summary.totalFloatingProfit || 0)}</div>`;
                html += '</div>';
                html += '</div></div>';
                container.innerHTML = html;
            }
        }
    },

    /**
     * 渲染持仓周期列表
     * @param {array} cycles - 持仓周期数组
     * @param {object} summary - 汇总数据
     */
    renderCycleList(cycles, summary) {
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
            const totalFee = ((cycle.totalBuyFee || 0) + (cycle.totalSellFee || 0));

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
     * 更新交易记录列表
     * @param {object} fund - 基金对象
     */
    updateTradeList(fund) {
        const trades = TradeManager.getTradesByFund(fund.id);
        const tradeList = document.getElementById('trade-list');
        const paginationContainer = document.getElementById('trade-pagination-container');

        if (!tradeList) return;

        const sortedAsc = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        const cycles = CalculatorV2.identifyHoldingCycles(sortedAsc);

        CycleTradeDisplay.init(fund.id, tradeList);

        if (cycles.length >= 2 || CycleTradeDisplay.getDisplayMode() === 'grouped') {
            CycleTradeDisplay.renderTradeSection();
            return;
        }

        CycleTradeDisplay.renderFlatMode();

        // 按日期倒序排列
        const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

        // 创建或更新分页实例
        Detail._tradePaginator = Paginator.create({
            data: sortedTrades,
            pageSize: Config.get('ui.defaultPageSize', 10),
            onPageChange: (pageData) => {
                Detail.renderTradePage(pageData);
            },
            onFilterChange: (inst) => {
                const pageData = Paginator.getCurrentPageData(inst);
                Detail.renderTradePage(pageData);
                // 更新分页控件
                if (paginationContainer) {
                    paginationContainer.innerHTML = Paginator.renderControls(inst);
                    Detail.bindPaginationEvents();
                }
                // 更新筛选结果数量
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
        Detail.renderTradePage(pageData);

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
     * @returns {string}
     */
    renderTradeRow(trade) {
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
        if (trade.type === 'sell' && trade.profitAmount !== undefined) {
            const profitSign = trade.profitAmount >= 0 ? '+' : '';
            const rateSign = trade.profitRate >= 0 ? '+' : '';
            profitDisplay = profitSign + Utils.formatMoneySmart(trade.profitAmount) + ' / ' + rateSign + Utils.formatNumber(trade.profitRate, 2) + '%';
            profitClass = trade.profitAmount >= 0 ? 'trade-profit-positive' : 'trade-profit-negative';
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
     */
    renderTradePage(pageData) {
        const tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        if (pageData.length === 0) {
            tradeList.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--color-text-tertiary);">没有匹配的交易记录</td></tr>';
            return;
        }

        const rows = pageData.map(trade => Detail.renderTradeRow(trade));
        tradeList.innerHTML = rows.join('');
        Detail.bindTradeActions();
    },

    /**
     * 绑定分页控件事件
     */
    bindPaginationEvents() {
        const paginationContainer = document.getElementById('trade-pagination-container');
        if (!paginationContainer || !Detail._tradePaginator) return;

        // 页码按钮
        paginationContainer.querySelectorAll('.page-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                Paginator.goToPage(Detail._tradePaginator, page);
                paginationContainer.innerHTML = Paginator.renderControls(Detail._tradePaginator);
                Detail.bindPaginationEvents();
            });
        });

        // 上一页/下一页
        paginationContainer.querySelectorAll('.page-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'prev') {
                    Paginator.goToPage(Detail._tradePaginator, Detail._tradePaginator.currentPage - 1);
                } else if (action === 'next') {
                    Paginator.goToPage(Detail._tradePaginator, Detail._tradePaginator.currentPage + 1);
                }
                paginationContainer.innerHTML = Paginator.renderControls(Detail._tradePaginator);
                Detail.bindPaginationEvents();
            });
        });

        // 每页条数
        paginationContainer.querySelectorAll('.page-size-select').forEach(select => {
            select.addEventListener('change', () => {
                Paginator.setPageSize(Detail._tradePaginator, parseInt(select.value));
                paginationContainer.innerHTML = Paginator.renderControls(Detail._tradePaginator);
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
                    Modal.show('editTrade', { trade });
                }
            });
        });

        tradeList.querySelectorAll('.btn-delete-trade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = e.target.closest('tr');
                const tradeId = row.dataset.tradeId;

                Modal.show('deleteConfirm', {
                    message: '确定要删除该交易记录吗？',
                    onConfirm: () => {
                        TradeManager.deleteTrade(tradeId);
                    }
                });
            });
        });
    },

    showNameEditUI() {
        const fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        const nameEl = document.getElementById('detail-fund-name');
        if (!nameEl) return;

        const currentName = fund.name || '';

        nameEl.innerHTML = '<input type="text" id="input-edit-fund-name" class="form-input" value="' + currentName + '" style="font-size:inherit;font-weight:inherit;width:300px;">' +
            '<button class="btn btn-primary btn-sm" id="btn-save-fund-name">保存</button>' +
            '<button class="btn btn-secondary btn-sm" id="btn-cancel-fund-name">取消</button>';

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
        const menuHtml = '<div class="edit-menu-overlay" id="edit-menu-overlay">' +
            '<div class="edit-menu">' +
            '<div class="edit-menu-item" id="menu-edit-name">✏️ 编辑名称</div>' +
            '<div class="edit-menu-item" id="menu-edit-remark">📝 编辑备注</div>' +
            '<div class="edit-menu-item" id="menu-refresh-name">🔄 刷新名称</div>' +
            '</div></div>';

        const actionsEl = document.querySelector('.detail-actions');
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

        const success = FundManager.updateFund(Detail.currentFundId, {
            name: newName,
            nameSource: 'manual',
            nameUpdateTime: new Date().toISOString()
        });

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

        remarkEl.innerHTML = '<input type="text" id="input-edit-fund-remark" class="form-input" value="' + currentRemark + '" style="font-size:inherit;font-weight:inherit;width:300px;" maxlength="50">' +
            '<button class="btn btn-primary btn-sm" id="btn-save-fund-remark">保存</button>' +
            '<button class="btn btn-secondary btn-sm" id="btn-cancel-fund-remark">取消</button>';

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

        const success = FundManager.updateFund(Detail.currentFundId, {
            remark: newRemark
        });

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

        const result = FIFOValidator.verifyFund(Detail.currentFundId);
        const resultEl = document.getElementById('fifo-verify-result');
        if (!resultEl) return;

        resultEl.style.display = 'inline-block';
        resultEl.className = 'fifo-verify-result';

        if (result.success && result.consistent) {
            resultEl.classList.add('fifo-verify-success');
            resultEl.textContent = '✅ 验证通过';
            setTimeout(function() {
                resultEl.style.display = 'none';
            }, 3000);
        } else if (result.success && !result.consistent) {
            resultEl.classList.add('fifo-verify-fail');
            resultEl.textContent = '❌ 结果不一致';
            const message = FIFOValidator.formatResult(result);
            alert(message);
        } else {
            resultEl.classList.add('fifo-verify-fail');
            resultEl.textContent = '❌ ' + result.error;
        }
    }
};

// 注册到模块系统
ModuleRegistry.register('Detail', Detail);

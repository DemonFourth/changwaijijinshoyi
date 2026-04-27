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
        console.log('Detail initialized');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 返回按钮
        const btnBack = document.getElementById('btn-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                // 直接导航到汇总页，而不是使用back()
                Router.navigate('overview');
            });
        }

        // 编辑基金按钮
        const btnEditFund = document.getElementById('btn-edit-fund');
        if (btnEditFund) {
            btnEditFund.addEventListener('click', () => {
                Detail.showEditMenu();
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
    },

    /**
     * 更新基金信息
     * @param {object} fund - 基金对象
     */
    updateFundInfo(fund) {
        // 标题栏：基金名称和代码
        const fundName = document.getElementById('detail-fund-name');
        const fundCode = document.getElementById('detail-fund-code');
        if (fundName) fundName.textContent = fund.name;
        if (fundCode) fundCode.textContent = fund.code;
        
        // 标题栏：行情数据
        const quoteNetValue = document.getElementById('quote-net-value');
        const quoteEstimatedValue = document.getElementById('quote-estimated-value');
        const quoteEstimatedGrowth = document.getElementById('quote-estimated-growth');
        
        if (quoteNetValue) {
            quoteNetValue.textContent = fund.netValue || '-';
        }
        
        if (quoteEstimatedValue) {
            quoteEstimatedValue.textContent = fund.estimatedValue || '-';
        }
        
        if (quoteEstimatedGrowth) {
            if (fund.estimatedGrowth !== undefined && fund.estimatedGrowth !== null) {
                const rate = parseFloat(fund.estimatedGrowth);
                const color = rate >= 0 ? 'var(--color-rise)' : 'var(--color-fall)';
                quoteEstimatedGrowth.textContent = `${rate >= 0 ? '+' : ''}${rate}%`;
                quoteEstimatedGrowth.style.color = color;
                quoteEstimatedGrowth.style.fontWeight = 'bold';
            } else {
                quoteEstimatedGrowth.textContent = '-';
                quoteEstimatedGrowth.style.color = '';
                quoteEstimatedGrowth.style.fontWeight = '';
            }
        }
        
        // 基金信息区域（保留原有字段）
        const title = document.getElementById('detail-title');
        const code = document.getElementById('info-code');
        const name = document.getElementById('info-name');
        const netValue = document.getElementById('info-net-value');
        const netDate = document.getElementById('info-net-date');
        const estimatedValue = document.getElementById('info-estimated-value');
        const estimatedGrowth = document.getElementById('info-estimated-growth');
        const updateTime = document.getElementById('info-update-time');
        
        if (title) title.textContent = fund.name;
        if (code) code.textContent = fund.code;
        if (name) name.textContent = fund.name;
        
        if (netValue) {
            netValue.textContent = fund.netValue || '-';
        }
        
        if (netDate) netDate.textContent = fund.netValueDate || '-';
        
        if (estimatedValue) {
            estimatedValue.textContent = fund.estimatedValue || '-';
        }
        
        if (estimatedGrowth) {
            if (fund.estimatedGrowth !== undefined && fund.estimatedGrowth !== null) {
                const rate = parseFloat(fund.estimatedGrowth);
                const color = rate >= 0 ? 'var(--color-rise)' : 'var(--color-fall)';
                estimatedGrowth.textContent = `${rate >= 0 ? '+' : ''}${rate}%`;
                estimatedGrowth.style.color = color;
                estimatedGrowth.style.fontWeight = 'bold';
            } else {
                estimatedGrowth.textContent = '-';
                estimatedGrowth.style.color = '';
                estimatedGrowth.style.fontWeight = '';
            }
        }
        
        if (updateTime) {
            if (fund.updateTime) {
                const updateDate = new Date(fund.updateTime);
                updateTime.textContent = updateDate.toLocaleString('zh-CN');
            } else {
                updateTime.textContent = '-';
            }
        }
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
        if (shares) shares.textContent = Utils.formatNumber(currentHolding.shares || 0);
        if (cost) cost.innerHTML = Utils.formatMoneySmart(currentHolding.cost || 0);
        if (costPerShare) {
            const costPrice = isCleared ? 0 : (currentHolding.shares > 0 ? currentHolding.cost / currentHolding.shares : 0);
            costPerShare.textContent = costPrice > 0 ? `¥${Utils.formatNumber(costPrice, 4)}` : '¥0.0000';
        }
        if (value) value.innerHTML = Utils.formatMoneySmart(currentHolding.value || 0);

        if (profit) {
            const displayProfit = isCleared ? 0 : (currentHolding.floatingProfit || 0);
            profit.innerHTML = Utils.formatMoneySmart(displayProfit);
            profit.className = `value ${Utils.getValueColor(displayProfit)}`;
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
            }
        }

        // 显示已实现收益
        if (realizedProfit) {
            realizedProfit.innerHTML = Utils.formatMoneySmart(summary.totalRealizedProfit || 0);
            realizedProfit.className = `value ${Utils.getValueColor(summary.totalRealizedProfit || 0)}`;
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

        const typeClass = {
            buy: 'trade-type-buy',
            sell: 'trade-type-sell',
            dividend: 'trade-type-dividend'
        };

        const netValueDisplay = trade.netValue ? Utils.formatNumber(trade.netValue, 4) : '-';

        const remarkDisplay = trade.remark ? (trade.remark.length > 20 ? trade.remark.substring(0, 20) + '...' : trade.remark) : '-';
        const remarkTitle = trade.remark || '';

        return `
            <tr data-trade-id="${trade.id}">
                <td>${trade.date}</td>
                <td class="${typeClass[trade.type]}">${typeText[trade.type]}</td>
                <td>${netValueDisplay}</td>
                <td>${Utils.formatNumber(trade.shares)}</td>
                <td>${Utils.formatMoney(trade.amount)}</td>
                <td>${Utils.formatMoney(trade.fee)}</td>
                <td class="trade-remark" title="${remarkTitle}">${remarkDisplay}</td>
                <td>
                    <button class="btn btn-secondary btn-edit-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">编辑</button>
                    <button class="btn btn-danger btn-delete-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
                </td>
            </tr>
        `;
    },

    /**
     * 渲染当前页交易记录
     * @param {Array} pageData - 当前页数据
     */
    renderTradePage(pageData) {
        const tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        if (pageData.length === 0) {
            tradeList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-text-tertiary);">没有匹配的交易记录</td></tr>';
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
        var fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        var nameEl = document.getElementById('detail-fund-name');
        if (!nameEl) return;

        var currentName = fund.name || '';

        nameEl.innerHTML = '<input type="text" id="input-edit-fund-name" class="form-input" value="' + currentName + '" style="font-size:inherit;font-weight:inherit;width:300px;">' +
            '<button class="btn btn-primary btn-sm" id="btn-save-fund-name">保存</button>' +
            '<button class="btn btn-secondary btn-sm" id="btn-cancel-fund-name">取消</button>';

        var input = document.getElementById('input-edit-fund-name');
        var btnSave = document.getElementById('btn-save-fund-name');
        var btnCancel = document.getElementById('btn-cancel-fund-name');

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
        var menuHtml = '<div class="edit-menu-overlay" id="edit-menu-overlay">' +
            '<div class="edit-menu">' +
            '<div class="edit-menu-item" id="menu-edit-name">✏️ 编辑名称</div>' +
            '<div class="edit-menu-item" id="menu-refresh-name">🔄 刷新名称</div>' +
            '</div></div>';

        var actionsEl = document.querySelector('.detail-actions');
        if (!actionsEl) return;

        actionsEl.insertAdjacentHTML('beforeend', menuHtml);

        var overlay = document.getElementById('edit-menu-overlay');
        var menuEditName = document.getElementById('menu-edit-name');
        var menuRefreshName = document.getElementById('menu-refresh-name');

        var closeMenu = function() {
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

        if (menuRefreshName) {
            menuRefreshName.addEventListener('click', async function() {
                closeMenu();
                await Detail.refreshFundName();
            });
        }
    },

    saveFundName() {
        var input = document.getElementById('input-edit-fund-name');
        if (!input) return;

        var newName = input.value.trim();
        if (!newName) {
            Utils.showToast('基金名称不能为空', 'error');
            return;
        }

        var success = FundManager.updateFund(Detail.currentFundId, {
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
        var fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        var nameEl = document.getElementById('detail-fund-name');
        if (nameEl) {
            nameEl.textContent = fund.name;
        }
    },

    async refreshFundName() {
        var fund = FundManager.getFund(Detail.currentFundId);
        if (!fund) return;

        var btn = document.getElementById('btn-refresh-fund-name');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '...';
        }

        try {
            FundAPI.clearCacheForFund(fund.code);
            NameCache.remove(fund.code);

            var name = await FundAPI.fetchNameOnly(fund.code);
            var validation = NameValidator.detectGarbled(name);

            if (validation.isGarbled) {
                Utils.showToast('获取的名称可能存在乱码，请手动编辑', 'warning');
                Detail.cancelNameEdit();
                var nameEl = document.getElementById('detail-fund-name');
                if (nameEl) nameEl.textContent = name;
            } else {
                var success = FundManager.updateFund(Detail.currentFundId, {
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
    }
};

// 注册到模块系统
ModuleRegistry.register('Detail', Detail);

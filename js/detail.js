/**
 * 详情页
 * 显示单只基金的详细信息
 */

const Detail = {
    // 当前基金ID
    currentFundId: null,

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
                // TODO: 实现编辑基金功能
                Utils.showToast('编辑功能开发中', 'info');
            });
        }

        // 删除基金按钮
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
        const title = document.getElementById('detail-title');
        const code = document.getElementById('info-code');
        const name = document.getElementById('info-name');
        const netValue = document.getElementById('info-net-value');
        const netDate = document.getElementById('info-net-date');

        if (title) title.textContent = fund.name;
        if (code) code.textContent = fund.code;
        if (name) name.textContent = fund.name;
        if (netValue) netValue.textContent = Utils.formatNumber(fund.netValue);
        if (netDate) netDate.textContent = fund.netValueDate;
    },

    /**
     * 更新持仓信息
     * @param {object} fund - 基金对象
     */
    updateHoldingInfo(fund) {
        const stats = FundManager.getFundStats(fund.id);
        const holding = stats ? stats.holding : {};

        const shares = document.getElementById('holding-shares');
        const cost = document.getElementById('holding-cost');
        const costPerShare = document.getElementById('cost-per-share');
        const value = document.getElementById('holding-value');
        const profit = document.getElementById('holding-profit');
        const rate = document.getElementById('holding-rate');

        if (shares) shares.textContent = Utils.formatNumber(holding.shares || 0);
        if (cost) cost.textContent = Utils.formatMoney(holding.cost || 0);
        if (costPerShare) costPerShare.textContent = Utils.formatMoney(holding.costPerShare || 0);
        if (value) value.textContent = Utils.formatMoney(holding.value || 0);

        if (profit) {
            profit.textContent = Utils.formatMoney(holding.profit || 0);
            profit.className = `value ${Utils.getValueColor(holding.profit || 0)}`;
        }

        if (rate) {
            rate.textContent = Utils.formatPercent(holding.profitRate || 0);
            rate.className = `value ${Utils.getValueColor(holding.profitRate || 0)}`;
        }
    },

    /**
     * 更新交易记录列表
     * @param {object} fund - 基金对象
     */
    updateTradeList(fund) {
        const trades = TradeManager.getTradesByFund(fund.id);
        const tradeList = document.getElementById('trade-list');

        if (!tradeList) return;

        if (trades.length === 0) {
            tradeList.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #999;">
                        还没有交易记录
                    </td>
                </tr>
            `;
            return;
        }

        // 按日期倒序排列
        const sortedTrades = [...trades].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // 生成交易记录行
        const rows = sortedTrades.map(trade => this.renderTradeRow(trade));
        tradeList.innerHTML = rows.join('');

        // 绑定操作按钮事件
        this.bindTradeActions();
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
            dividend: 'trade-type-buy'
        };

        const netValueDisplay = trade.netValue ? Utils.formatNumber(trade.netValue, 4) : '-';

        return `
            <tr data-trade-id="${trade.id}">
                <td>${trade.date}</td>
                <td class="${typeClass[trade.type]}">${typeText[trade.type]}</td>
                <td>${netValueDisplay}</td>
                <td>${Utils.formatNumber(trade.shares)}</td>
                <td>${Utils.formatMoney(trade.amount)}</td>
                <td>${Utils.formatMoney(trade.fee)}</td>
                <td>
                    <button class="btn btn-secondary btn-edit-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">编辑</button>
                    <button class="btn btn-danger btn-delete-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
                </td>
            </tr>
        `;
    },

    /**
     * 绑定交易记录操作事件
     */
    bindTradeActions() {
        const tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        // 编辑按钮
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

        // 删除按钮
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
    }
};

// 注册到模块系统
ModuleRegistry.register('Detail', Detail);

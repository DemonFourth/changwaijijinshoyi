/**
 * 汇总页
 * 显示所有基金的汇总信息和列表
 */

const Overview = {
    /**
     * 初始化汇总页
     */
    init() {
        this.bindEvents();
        this.refresh();
        console.log('Overview initialized');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 添加基金按钮
        const btnAddFund = document.getElementById('btn-add-fund');
        if (btnAddFund) {
            btnAddFund.addEventListener('click', () => {
                Modal.show('addFund');
            });
        }

        // 导出按钮
        const btnExport = document.getElementById('btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                Modal.show('export');
            });
        }

        // 导入按钮
        const btnImport = document.getElementById('btn-import');
        if (btnImport) {
            btnImport.addEventListener('click', () => {
                Modal.show('import');
            });
        }

        // 刷新按钮
        const fabRefresh = document.getElementById('fab-refresh');
        if (fabRefresh) {
            fabRefresh.addEventListener('click', async () => {
                try {
                    await FundManager.refreshAllFunds();
                    this.refresh();
                } catch (error) {
                    console.error('Refresh failed:', error);
                }
            });
        }

        // 监听数据变化事件
        EventBus.on(EventType.FUND_ADDED, () => this.refresh());
        EventBus.on(EventType.FUND_UPDATED, () => this.refresh());
        EventBus.on(EventType.FUND_DELETED, () => this.refresh());
        EventBus.on(EventType.TRADE_ADDED, () => this.refresh());
        EventBus.on(EventType.TRADE_UPDATED, () => this.refresh());
        EventBus.on(EventType.TRADE_DELETED, () => this.refresh());
    },

    /**
     * 刷新汇总页
     */
    refresh() {
        this.updateStats();
        this.updateFundList();
    },

    /**
     * 更新统计信息
     */
    updateStats() {
        const stats = Calculator.calculateAllStats();

        // 更新统计卡片
        const totalInvest = document.getElementById('total-invest');
        const totalValue = document.getElementById('total-value');
        const totalProfit = document.getElementById('total-profit');
        const totalRate = document.getElementById('total-rate');

        if (totalInvest) {
            totalInvest.textContent = Utils.formatMoney(stats.totalInvest);
        }

        if (totalValue) {
            totalValue.textContent = Utils.formatMoney(stats.totalValue);
        }

        if (totalProfit) {
            totalProfit.textContent = Utils.formatMoney(stats.totalProfit);
            totalProfit.className = `stat-value ${Utils.getValueColor(stats.totalProfit)}`;
        }

        if (totalRate) {
            totalRate.textContent = Utils.formatPercent(stats.totalProfitRate);
            totalRate.className = `stat-value ${Utils.getValueColor(stats.totalProfitRate)}`;
        }
    },

    /**
     * 更新基金列表
     */
    updateFundList() {
        const funds = FundManager.getAllFunds();
        const fundList = document.getElementById('fund-list');

        if (!fundList) return;

        if (funds.length === 0) {
            fundList.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem; color: #999;">
                    <p>还没有添加基金</p>
                    <p>点击右上角"添加基金"按钮开始</p>
                </div>
            `;
            return;
        }

        // 生成基金卡片
        const cards = funds.map(fund => this.renderFundCard(fund));
        fundList.innerHTML = cards.join('');

        // 绑定卡片点击事件
        fundList.querySelectorAll('.fund-card').forEach(card => {
            card.addEventListener('click', () => {
                const fundId = card.dataset.fundId;
                Router.navigate('detail', { fundId });
            });
        });
    },

    /**
     * 渲染基金卡片
     * @param {object} fund - 基金对象
     * @returns {string}
     */
    renderFundCard(fund) {
        const stats = FundManager.getFundStats(fund.id);

        const holding = stats ? stats.holding : {};
        const total = stats ? stats.total : {};

        return `
            <div class="fund-card" data-fund-id="${fund.id}">
                <div class="fund-card-header">
                    <div>
                        <div class="fund-name">${fund.name}</div>
                        <div class="fund-code">${fund.code}</div>
                    </div>
                </div>
                <div class="fund-card-body">
                    <div class="fund-stat">
                        <span class="fund-stat-label">持有份额</span>
                        <span class="fund-stat-value">${Utils.formatNumber(holding.shares || 0)}</span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">持仓成本</span>
                        <span class="fund-stat-value">${Utils.formatMoney(holding.cost || 0)}</span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">当前市值</span>
                        <span class="fund-stat-value">${Utils.formatMoney(holding.value || 0)}</span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">总收益</span>
                        <span class="fund-stat-value ${Utils.getValueColor(total.amount || 0)}">
                            ${Utils.formatMoney(total.amount || 0)}
                        </span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">收益率</span>
                        <span class="fund-stat-value ${Utils.getValueColor(total.rate || 0)}">
                            ${Utils.formatPercent(total.rate || 0)}
                        </span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">最新净值</span>
                        <span class="fund-stat-value">${Utils.formatNumber(fund.netValue || 0)}</span>
                    </div>
                </div>
            </div>
        `;
    }
};

// 注册到模块系统
ModuleRegistry.register('Overview', Overview);

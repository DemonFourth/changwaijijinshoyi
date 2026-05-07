/**
 * 汇总页
 * 显示所有基金的汇总信息和列表
 */

const Overview = {
    _viewPrefs: null,

    _groupCollapsed: { holding: false, cleared: false },

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
                    Utils.showToast('数据刷新成功', 'success');
                } catch (error) {
                    console.error('Refresh failed:', error);
                    Utils.showToast('数据刷新失败：' + error.message, 'error');
                }
            });
        }

        // 视图切换按钮
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => {
                Overview.switchView(btn.dataset.view);
            });
        });

        // 排序字段选择
        const sortField = document.getElementById('sort-field');
        if (sortField) {
            sortField.addEventListener('change', () => {
                const prefs = Overview._viewPrefs || Overview.loadViewPreferences();
                Overview.changeSort(sortField.value, prefs.sortOrder);
            });
        }

        // 排序方向切换
        const sortOrder = document.getElementById('sort-order');
        if (sortOrder) {
            sortOrder.addEventListener('click', () => {
                const prefs = Overview._viewPrefs || Overview.loadViewPreferences();
                const newOrder = prefs.sortOrder === 'desc' ? 'asc' : 'desc';
                Overview.changeSort(prefs.sortField, newOrder);
            });
        }

        // 监听数据变化事件
        EventBus.on(EventType.FUND_ADDED, () => this.refresh());
        EventBus.on(EventType.FUND_UPDATED, () => this.refresh());
        EventBus.on(EventType.FUND_DELETED, () => this.refresh());
        EventBus.on(EventType.TRADE_ADDED, () => this.refresh());
        EventBus.on(EventType.TRADE_UPDATED, () => this.refresh());
        EventBus.on(EventType.TRADE_DELETED, () => this.refresh());

        // 监听设置变化事件
        EventBus.on(EventType.SETTINGS_CHANGED, () => {
            Overview._viewPrefs = null;
            Overview.refresh();
        });
    },

    /**
     * 刷新汇总页
     */
    refresh() {
        this.updateStats();
        this.updateFundList();
        this.updateTop5();
        // 更新图表
        Overview.updateChart();
    },

    /**
     * 更新统计信息
     */
    updateStats() {
        const funds = FundManager.getAllFunds();

        // 当前持仓数据
        let currentCost = 0;
        let currentValue = 0;
        let currentProfit = 0;

        // 累计（全部）数据
        let totalInvest = 0;
        let totalValue = 0;
        let totalProfit = 0;
        let totalProfitRate = 0;

        funds.forEach(fund => {
            const stats = FundManager.getFundStats(fund.id);
            if (stats) {
                // 当前持仓
                currentCost += stats.summary.currentHolding.cost;
                currentValue += stats.summary.currentHolding.value;
                currentProfit += stats.summary.currentHolding.floatingProfit;

                // 累计
                totalInvest += stats.summary.totalInvest;
                totalValue += stats.summary.currentHolding.value;
                totalProfit += stats.summary.totalProfit;
            }
        });

        const currentProfitRate = currentCost > 0 ? (currentProfit / currentCost * 100) : 0;
        totalProfitRate = totalInvest > 0 ? (totalProfit / totalInvest * 100) : 0;

        // 更新当前持仓统计卡片
        const currentData = {
            totalInvest: currentCost,
            totalValue: currentValue,
            totalProfit: currentProfit,
            totalProfitRate: currentProfitRate
        };

        const totalInvestEl = document.getElementById('total-invest');
        const totalValueEl = document.getElementById('total-value');
        const totalProfitEl = document.getElementById('total-profit');
        const totalRateEl = document.getElementById('total-rate');

        if (totalInvestEl) {
            totalInvestEl.innerHTML = Utils.formatMoneySmart(currentData.totalInvest);
        }

        if (totalValueEl) {
            totalValueEl.innerHTML = Utils.formatMoneySmart(currentData.totalValue);
        }

        if (totalProfitEl) {
            totalProfitEl.innerHTML = Utils.formatMoneySmart(currentData.totalProfit);
            totalProfitEl.className = `stat-value ${Utils.getValueColor(currentData.totalProfit)}`;
        }

        if (totalRateEl) {
            totalRateEl.textContent = Utils.formatPercent(currentData.totalProfitRate);
            totalRateEl.className = `stat-value ${Utils.getValueColor(currentData.totalProfitRate)}`;
        }

        // 更新累计统计卡片
        const totalInvestAllEl = document.getElementById('total-invest-all');
        const totalValueAllEl = document.getElementById('total-value-all');
        const totalProfitAllEl = document.getElementById('total-profit-all');
        const totalRateAllEl = document.getElementById('total-rate-all');

        if (totalInvestAllEl) {
            totalInvestAllEl.innerHTML = Utils.formatMoneySmart(totalInvest);
        }

        if (totalValueAllEl) {
            totalValueAllEl.innerHTML = Utils.formatMoneySmart(totalValue);
        }

        if (totalProfitAllEl) {
            totalProfitAllEl.innerHTML = Utils.formatMoneySmart(totalProfit);
            totalProfitAllEl.className = `stat-value ${Utils.getValueColor(totalProfit)}`;
        }

        if (totalRateAllEl) {
            totalRateAllEl.textContent = Utils.formatPercent(totalProfitRate);
            totalRateAllEl.className = `stat-value ${Utils.getValueColor(totalProfitRate)}`;
        }
    },

    /**
     * 更新基金列表
     */
    updateFundList() {
        let funds = FundManager.getAllFunds();
        const fundList = document.getElementById('fund-list');

        if (!fundList) return;

        // 加载视图偏好
        const prefs = Overview._viewPrefs || Overview.loadViewPreferences();

        // 排序
        funds = Overview.sortFunds(funds, prefs.sortField, prefs.sortOrder);

        if (funds.length === 0) {
            fundList.innerHTML = '<div class="empty-state" style="text-align: center; padding: 2rem; color: var(--color-text-tertiary);"><p>还没有添加基金</p><p>点击右上角"添加基金"按钮开始</p></div>';
            return;
        }

        // 根据视图模式渲染
        fundList.className = `fund-list ${prefs.viewMode}-view`;

        // 分组
        const groups = Overview.groupFundsByStatus(funds);

        // 渲染分组
        let html = '';
        if (groups.holdingCount > 0) {
            html += Overview.renderFundGroup('holding', '持仓中', groups.holding, Overview._groupCollapsed.holding);
        }
        if (groups.clearedCount > 0) {
            html += Overview.renderFundGroup('cleared', '已清仓', groups.cleared, Overview._groupCollapsed.cleared);
        }

        fundList.innerHTML = html;

        // 绑定点击事件
        fundList.querySelectorAll('.fund-card, .fund-row').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.fund-group-header')) return;
                const fundId = el.dataset.fundId;
                Router.navigate('detail', { fundId });
            });
        });

        // 绑定分组折叠事件
        fundList.querySelectorAll('.fund-group-header').forEach(header => {
            header.addEventListener('click', () => {
                const groupId = header.dataset.groupId;
                Overview.toggleGroup(groupId);
            });
        });

        // 更新视图切换按钮状态
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === prefs.viewMode);
        });

        // 更新排序控件状态
        const sortField = document.getElementById('sort-field');
        const sortOrder = document.getElementById('sort-order');
        if (sortField) sortField.value = prefs.sortField;
        if (sortOrder) sortOrder.textContent = prefs.sortOrder === 'desc' ? '↓' : '↑';
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
                        <span class="fund-stat-value">${Utils.formatMoneySmart(holding.cost || 0)}</span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">当前市值</span>
                        <span class="fund-stat-value">${Utils.formatMoneySmart(holding.value || 0)}</span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">总收益</span>
                        <span class="fund-stat-value ${Utils.getValueColor(total.amount || 0)}">
                            ${Utils.formatMoneySmart(total.amount || 0)}
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
                        <span class="fund-stat-value">${Utils.formatNumber(fund.netValue || 0, 4)}</span>
                    </div>
                    <div class="fund-stat">
                        <span class="fund-stat-label">估算净值</span>
                        <span class="fund-stat-value ${fund.estimatedGrowth > 0 ? 'positive' : fund.estimatedGrowth < 0 ? 'negative' : ''}">
                            ${fund.estimatedValue ? Utils.formatNumber(fund.estimatedValue, 4) : '-'}
                            ${fund.estimatedGrowth ? `<span class="fund-stat-change ${fund.estimatedGrowth > 0 ? 'positive' : fund.estimatedGrowth < 0 ? 'negative' : ''}">${fund.estimatedGrowth >= 0 ? '↑+' : '↓'}${parseFloat(fund.estimatedGrowth).toFixed(2)}%</span>` : ''}
                        </span>
                    </div>
                </div>
            </div>
        `;
    },

    loadViewPreferences() {
        Overview._viewPrefs = Storage.loadViewPrefs();
        return Overview._viewPrefs;
    },

    saveViewPreferences(prefs) {
        Overview._viewPrefs = { ...Overview._viewPrefs, ...prefs };
        Storage.saveViewPrefs(Overview._viewPrefs);
        EventBus.emit(EventType.VIEW_CHANGED, Overview._viewPrefs);
    },

    sortFunds(funds, sortField, sortOrder) {
        const sorted = [...funds];
        sorted.sort((a, b) => {
            let valA, valB;
            const statsA = FundManager.getFundStats(a.id);
            const statsB = FundManager.getFundStats(b.id);

            switch (sortField) {
            case 'profitRate':
                valA = statsA ? (statsA.summary.profitRate || 0) : 0;
                valB = statsB ? (statsB.summary.profitRate || 0) : 0;
                break;
            case 'profitAmount':
                valA = statsA ? (statsA.summary.totalProfit || 0) : 0;
                valB = statsB ? (statsB.summary.totalProfit || 0) : 0;
                break;
            case 'marketValue':
                valA = statsA ? (statsA.summary.currentHolding.value || 0) : 0;
                valB = statsB ? (statsB.summary.currentHolding.value || 0) : 0;
                break;
            case 'name':
                valA = a.name || '';
                valB = b.name || '';
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            default:
                valA = statsA ? (statsA.summary.profitRate || 0) : 0;
                valB = statsB ? (statsB.summary.profitRate || 0) : 0;
            }
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        });
        return sorted;
    },

    renderCardView(funds) {
        return funds.map(fund => Overview.renderFundCard(fund)).join('');
    },

    renderListView(funds) {
        if (funds.length === 0) {
            return '<div class="empty-state" style="text-align: center; padding: 2rem; color: var(--color-text-tertiary);"><p>还没有添加基金</p></div>';
        }

        let html = '<table class="fund-list-table"><thead><tr>';
        html += '<th>基金名称</th><th>代码</th><th>收益率</th><th>收益额</th><th>持仓市值</th><th>最新净值</th><th>估算净值</th>';
        html += '</tr></thead><tbody>';

        funds.forEach(fund => {
            const stats = FundManager.getFundStats(fund.id);
            const summary = stats ? stats.summary : {};
            const holding = summary.currentHolding || {};
            const profitRate = summary.profitRate || 0;
            const profitAmount = summary.totalProfit || 0;
            const marketValue = holding.value || 0;
            const growthClass = fund.estimatedGrowth > 0 ? 'positive' : fund.estimatedGrowth < 0 ? 'negative' : '';

            html += `<tr class="fund-row" data-fund-id="${fund.id}" style="cursor:pointer;">`;
            html += `<td class="fund-name-cell">${fund.name}</td>`;
            html += `<td class="fund-code-cell">${fund.code}</td>`;
            html += `<td class="${Utils.getValueColor(profitRate)}">${Utils.formatPercent(profitRate)}</td>`;
            html += `<td class="${Utils.getValueColor(profitAmount)}">${Utils.formatMoneySmart(profitAmount)}</td>`;
            html += `<td>${Utils.formatMoneySmart(marketValue)}</td>`;
            html += `<td>${Utils.formatNumber(fund.netValue || 0, 4)}</td>`;
            html += `<td class="${growthClass}">${fund.estimatedValue ? Utils.formatNumber(fund.estimatedValue, 4) : '-'}${fund.estimatedGrowth ? `<span class="fund-stat-change ${growthClass}">${fund.estimatedGrowth >= 0 ? '↑+' : '↓'}${parseFloat(fund.estimatedGrowth).toFixed(2)}%</span>` : ''}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    switchView(mode) {
        Overview.saveViewPreferences({ viewMode: mode });
        Overview.refresh();
        // 更新按钮状态
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });
    },

    changeSort(field, order) {
        Overview.saveViewPreferences({ sortField: field, sortOrder: order });
        Overview.refresh();
    },

    groupFundsByStatus(funds) {
        const EPSILON = 0.0001;
        const holding = [];
        const cleared = [];

        funds.forEach(fund => {
            const stats = FundManager.getFundStats(fund.id);
            const shares = stats ? (stats.summary.currentHolding.shares || 0) : 0;
            if (shares > EPSILON) {
                holding.push(fund);
            } else {
                cleared.push(fund);
            }
        });

        return { holding, cleared, holdingCount: holding.length, clearedCount: cleared.length };
    },

    renderFundGroup(groupId, title, funds, isCollapsed) {
        const prefs = Overview._viewPrefs || Overview.loadViewPreferences();
        const collapsedClass = isCollapsed ? 'collapsed' : '';

        let html = `<div class="fund-group" data-group="${groupId}">`;
        html += `<div class="fund-group-header" data-group-id="${groupId}">`;
        html += `<span class="group-title">${title}</span>`;
        html += `<span class="group-count">${funds.length}</span>`;
        html += `<span class="group-toggle">${isCollapsed ? '▶' : '▼'}</span>`;
        html += '</div>';
        html += `<div class="fund-group-body ${collapsedClass}">`;

        if (funds.length === 0) {
            html += '<p class="group-empty">暂无基金</p>';
        } else if (prefs.viewMode === 'list') {
            html += Overview.renderListView(funds);
        } else {
            html += Overview.renderCardView(funds);
        }

        html += '</div></div>';
        return html;
    },

    toggleGroup(groupId) {
        Overview._groupCollapsed[groupId] = !Overview._groupCollapsed[groupId];

        const group = document.querySelector(`.fund-group[data-group="${groupId}"]`);
        if (!group) return;

        const body = group.querySelector('.fund-group-body');
        const toggle = group.querySelector('.group-toggle');

        if (Overview._groupCollapsed[groupId]) {
            body.classList.add('collapsed');
            toggle.textContent = '▶';
        } else {
            body.classList.remove('collapsed');
            toggle.textContent = '▼';
        }

        EventBus.emit(EventType.GROUP_TOGGLED, { groupId, collapsed: Overview._groupCollapsed[groupId] });
    },

    /**
     * 计算Top5盈亏榜单
     * @param {Array} funds - 基金数组
     * @returns {Object} {profitTop5, lossTop5}
     */
    calculateTop5(funds) {
        const fundStats = funds.map(fund => {
            const stats = FundManager.getFundStats(fund.id);
            return {
                fund,
                profitRate: stats ? (stats.summary.profitRate || 0) : 0,
                profitAmount: stats ? (stats.summary.totalProfit || 0) : 0
            };
        });

        // 盈利Top5：收益为正，按收益率降序
        const profitTop5 = fundStats
            .filter(f => f.profitRate > 0)
            .sort((a, b) => b.profitRate - a.profitRate)
            .slice(0, 5);

        // 亏损Top5：收益为负，按收益率升序
        const lossTop5 = fundStats
            .filter(f => f.profitRate < 0)
            .sort((a, b) => a.profitRate - b.profitRate)
            .slice(0, 5);

        return { profitTop5, lossTop5 };
    },

    /**
     * 渲染Top5榜单
     * @param {string} title - 榜单标题
     * @param {Array} items - 榜单数据
     * @param {string} type - 榜单类型 'profit' | 'loss'
     * @returns {string} HTML
     */
    renderTop5Board(title, items, type) {
        if (items.length === 0) {
            return `<div class="top5-board top5-${type}"><h3>${title}</h3><div class="top5-list"><p class="top5-empty">暂无数据</p></div></div>`;
        }

        let html = `<div class="top5-board top5-${type}">`;
        html += `<h3>${title}</h3>`;
        html += '<div class="top5-list">';

        items.forEach((item, index) => {
            const colorClass = item.profitRate >= 0 ? 'positive' : 'negative';
            html += `<div class="top5-item" data-fund-id="${item.fund.id}">`;
            html += `<span class="top5-rank">${index + 1}</span>`;
            html += `<span class="top5-name">${item.fund.name}</span>`;
            html += `<span class="top5-rate ${colorClass}">${item.profitRate.toFixed(2)}%</span>`;
            html += '</div>';
        });

        html += '</div></div>';
        return html;
    },

    /**
     * 更新Top5盈亏榜单
     */
    updateTop5() {
        const funds = FundManager.getAllFunds();
        const container = document.querySelector('.top5-container');
        if (!container) return;

        const { profitTop5, lossTop5 } = Overview.calculateTop5(funds);

        let html = Overview.renderTop5Board('盈利 Top5', profitTop5, 'profit');
        html += Overview.renderTop5Board('亏损 Top5', lossTop5, 'loss');
        container.innerHTML = html;

        // 绑定点击事件
        container.querySelectorAll('.top5-item').forEach(item => {
            item.addEventListener('click', () => {
                const fundId = item.dataset.fundId;
                Router.navigate('detail', { fundId });
            });
        });
    },

    /**
     * 更新汇总页图表
     */
    updateChart() {
        const funds = FundManager.getAllFunds();

        if (ChartManager.isEChartsAvailable()) {
            const container = document.getElementById('chart-profit-trend');
            if (container) {
                if (funds.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--color-text-tertiary); padding: 40px;">暂无基金数据</p>';
                    return;
                }
                ChartManager.createChart('chart-profit-trend', ChartManager.buildProfitTrendOption(funds));
            }
        } else {
            // Fallback: 简单文本统计
            const container = document.getElementById('chart-profit-trend');
            if (container && funds.length > 0) {
                let totalProfit = 0;
                funds.forEach(fund => {
                    const stats = FundManager.getFundStats(fund.id);
                    if (stats) totalProfit += stats.summary.totalProfit;
                });
                container.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--color-text-secondary);">总收益: ${Utils.formatMoneySmart(totalProfit)}</p>`;
            }
        }
    }
};

// 注册到模块系统
ModuleRegistry.register('Overview', Overview);

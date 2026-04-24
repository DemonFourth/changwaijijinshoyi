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

        // 净值显示 - 保持API返回的精度
        if (netValue) {
            if (fund.netValue) {
                // 直接显示，不格式化，保持原始精度
                netValue.textContent = fund.netValue;
            } else {
                netValue.textContent = '-';
            }
        }

        if (netDate) netDate.textContent = fund.netValueDate || '-';

        // 显示更多基金信息（如果API返回了）
        this.updateExtraFundInfo(fund);
    },

    /**
     * 更新额外的基金信息
     * @param {object} fund - 基金对象
     */
    updateExtraFundInfo(fund) {
        // 查找或创建额外信息容器
        let extraInfo = document.getElementById('extra-fund-info');
        if (!extraInfo) {
            // 在fund-info区域后添加
            const fundInfo = document.querySelector('.fund-info');
            if (fundInfo) {
                extraInfo = document.createElement('div');
                extraInfo.id = 'extra-fund-info';
                extraInfo.style.cssText = 'margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px;';
                fundInfo.appendChild(extraInfo);
            }
        }

        if (!extraInfo) return;

        // 构建额外信息HTML
        let html = '<h4 style="margin-bottom: 10px;">详细信息</h4>';
        html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px;">';

        // 估算净值
        if (fund.estimateNetValue) {
            html += `<div><span style="color: #666;">估算净值：</span><span style="font-weight: bold;">${fund.estimateNetValue}</span></div>`;
        }

        // 估算日期
        if (fund.estimateDate) {
            html += `<div><span style="color: #666;">估算日期：</span><span>${fund.estimateDate}</span></div>`;
        }

        // 估算增长率
        if (fund.estimateGrowthRate) {
            const rate = parseFloat(fund.estimateGrowthRate);
            const color = rate >= 0 ? '#4caf50' : '#f44336';
            html += `<div><span style="color: #666;">估算涨幅：</span><span style="font-weight: bold; color: ${color};">${rate >= 0 ? '+' : ''}${rate}%</span></div>`;
        }

        // 基金类型
        if (fund.fundType) {
            html += `<div><span style="color: #666;">基金类型：</span><span>${fund.fundType}</span></div>`;
        }

        // 基金规模
        if (fund.fundScale) {
            html += `<div><span style="color: #666;">基金规模：</span><span>${fund.fundScale}</span></div>`;
        }

        // 基金经理
        if (fund.fundManager) {
            html += `<div><span style="color: #666;">基金经理：</span><span>${fund.fundManager}</span></div>`;
        }

        // 成立日期
        if (fund.establishDate) {
            html += `<div><span style="color: #666;">成立日期：</span><span>${fund.establishDate}</span></div>`;
        }

        // 公司
        if (fund.company) {
            html += `<div style="grid-column: span 2;"><span style="color: #666;">基金公司：</span><span>${fund.company}</span></div>`;
        }

        html += '</div>';
        extraInfo.innerHTML = html;
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

        const summary = stats.summary;
        const currentHolding = summary.currentHolding;

        // 基础持仓信息
        const shares = document.getElementById('holding-shares');
        const cost = document.getElementById('holding-cost');
        const costPerShare = document.getElementById('cost-per-share');
        const value = document.getElementById('holding-value');
        const profit = document.getElementById('holding-profit');
        const rate = document.getElementById('holding-rate');

        // 已实现收益和总收益
        const realizedProfit = document.getElementById('realized-profit');
        const totalProfit = document.getElementById('total-profit');
        const totalRate = document.getElementById('total-rate');

        // 持仓周期信息
        const cycleCount = document.getElementById('cycle-count');
        const closedCycles = document.getElementById('closed-cycles');
        const activeCycles = document.getElementById('active-cycles');
        const cycleList = document.getElementById('cycle-list');

        // 显示基础持仓
        if (shares) shares.textContent = Utils.formatNumber(currentHolding.shares || 0);
        if (cost) cost.textContent = Utils.formatMoney(currentHolding.cost || 0);
        if (costPerShare) costPerShare.textContent = Utils.formatMoney(
            currentHolding.shares > 0 ? currentHolding.cost / currentHolding.shares : 0
        );
        if (value) value.textContent = Utils.formatMoney(currentHolding.value || 0);

        if (profit) {
            profit.textContent = Utils.formatMoney(currentHolding.floatingProfit || 0);
            profit.className = `value ${Utils.getValueColor(currentHolding.floatingProfit || 0)}`;
        }

        if (rate) {
            const holdingRate = currentHolding.cost > 0
                ? (currentHolding.floatingProfit / currentHolding.cost * 100)
                : 0;
            rate.textContent = Utils.formatPercent(holdingRate);
            rate.className = `value ${Utils.getValueColor(holdingRate)}`;
        }

        // 显示已实现收益
        if (realizedProfit) {
            realizedProfit.textContent = Utils.formatMoney(summary.totalRealizedProfit || 0);
            realizedProfit.className = `value ${Utils.getValueColor(summary.totalRealizedProfit || 0)}`;
        }

        // 显示总收益
        if (totalProfit) {
            totalProfit.textContent = Utils.formatMoney(summary.totalProfit || 0);
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
            this.renderCycleList(stats.cycles);
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
        const chartContainer = document.getElementById('chart-detail-trend');
        if (!chartContainer) return;

        // 暂时显示交易记录统计图表
        const trades = TradeManager.getTradesByFund(fund.id);
        if (trades.length === 0) {
            chartContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无交易记录</p>';
            return;
        }

        // 简单的统计图表（使用HTML/CSS实现）
        let html = '<div style="padding: 20px;">';
        html += '<h4 style="margin-bottom: 15px;">交易统计</h4>';

        // 统计数据
        let buyCount = 0, sellCount = 0;
        let buyAmount = 0, sellAmount = 0;

        trades.forEach(t => {
            if (t.type === 'buy') {
                buyCount++;
                buyAmount += parseFloat(t.amount);
            } else if (t.type === 'sell') {
                sellCount++;
                sellAmount += parseFloat(t.amount);
            }
        });

        const totalAmount = buyAmount + sellAmount;
        const buyPercent = totalAmount > 0 ? (buyAmount / totalAmount * 100) : 0;
        const sellPercent = totalAmount > 0 ? (sellAmount / totalAmount * 100) : 0;

        html += '<div style="margin-bottom: 20px;">';
        html += `<div style="margin-bottom: 10px;"><span style="color: #4caf50;">买入 ${buyCount}笔</span> vs <span style="color: #f44336;">卖出 ${sellCount}笔</span></div>`;
        html += '<div style="display: flex; height: 30px; border-radius: 4px; overflow: hidden;">';
        html += `<div style="width: ${buyPercent}%; background: #4caf50; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">${buyPercent > 10 ? '买入' : ''}</div>`;
        html += `<div style="width: ${sellPercent}%; background: #f44336; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">${sellPercent > 10 ? '卖出' : ''}</div>`;
        html += '</div>';
        html += '<div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #666;">';
        html += `<span>¥${buyAmount.toFixed(2)}</span>`;
        html += `<span>¥${sellAmount.toFixed(2)}</span>`;
        html += '</div>';
        html += '</div>';

        // 收益趋势
        if (stats && stats.summary) {
            html += '<div style="border-top: 1px solid #eee; padding-top: 15px;">';
            html += '<h4 style="margin-bottom: 10px;">收益情况</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
            html += '<div style="padding: 10px; background: #f9f9f9; border-radius: 4px;">';
            html += '<div style="color: #666; font-size: 12px;">已实现收益</div>';
            html += `<div style="font-weight: bold; color: ${stats.summary.totalRealizedProfit >= 0 ? '#4caf50' : '#f44336'};">¥${stats.summary.totalRealizedProfit.toFixed(2)}</div>`;
            html += '</div>';
            html += '<div style="padding: 10px; background: #f9f9f9; border-radius: 4px;">';
            html += '<div style="color: #666; font-size: 12px;">浮动收益</div>';
            html += `<div style="font-weight: bold; color: ${stats.summary.totalFloatingProfit >= 0 ? '#4caf50' : '#f44336'};">¥${(stats.summary.totalFloatingProfit || 0).toFixed(2)}</div>`;
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }

        html += '</div>';
        chartContainer.innerHTML = html;
    },

    /**
     * 渲染持仓周期列表
     * @param {array} cycles - 持仓周期数组
     */
    renderCycleList(cycles) {
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
                            <span style="color: #666;">收益：</span>
                            <span style="font-weight: bold; color: ${cycle.totalProfit >= 0 ? '#4caf50' : '#f44336'};">¥${cycle.totalProfit.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style="color: #666;">收益率：</span>
                            <span style="font-weight: bold; color: ${cycle.profitRate >= 0 ? '#4caf50' : '#f44336'};">${cycle.profitRate.toFixed(2)}%</span>
                        </div>
                        <div>
                            <span style="color: #666;">持仓天数：</span>
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

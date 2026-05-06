/**
 * 持仓轮次分组渲染器
 * 纯函数式渲染：输入数据输出HTML，不持有状态，不操作DOM
 * 所有输出均为<tr>元素，合法存在于<tbody>中
 */

const CycleGroupRenderer = {
    renderModeToggle(currentMode) {
        return '<div class="display-mode-toggle">' +
            '<button class="display-mode-btn' + (currentMode === 'grouped' ? ' display-mode-btn--active' : '') + '" data-mode="grouped">分组</button>' +
            '<button class="display-mode-btn' + (currentMode === 'flat' ? ' display-mode-btn--active' : '') + '" data-mode="flat">列表</button>' +
            '</div>';
    },

    renderCycleFilter(cycles, selectedCycleId) {
        if (!cycles || cycles.length <= 1) return '';

        let html = '<select id="filter-cycle" class="filter-cycle-select">';
        html += '<option value="">全部轮次</option>';
        for (let i = 0; i < cycles.length; i++) {
            const cycle = cycles[i];
            const selected = (selectedCycleId === cycle.id) ? ' selected' : '';
            const statusText = cycle.status === 'active' ? '进行中' : '已结束';
            html += '<option value="' + cycle.id + '"' + selected + '>第' + cycle.id + '轮持仓 (' + statusText + ')</option>';
        }
        html += '</select>';
        return html;
    },

    renderCycleGroupHeaderRow(cycle, isExpanded, color, summary, cycleIndex) {
        return '';
    },

    renderCycleSummary(summary) {
        return '';
    },

    renderTradeRow(trade, cycleColor, isExpanded, cycleId, cycleIndex, profitMap = new Map()) {
        const typeText = { buy: '买入', sell: '卖出', dividend: '分红' };
        const typeClass = { buy: 'trade-type-badge trade-type-buy', sell: 'trade-type-badge trade-type-sell', dividend: 'trade-type-badge trade-type-dividend' };
        const priceDisplay = trade.netValue ? Utils.formatNumber(trade.netValue, 4) : '-';
        const remarkTitle = trade.remark || '';
        const bgColor = (cycleIndex % 2 === 0) ? 'var(--color-cycle-bg-odd)' : 'var(--color-cycle-bg-even)';
        const displayStyle = isExpanded ? '' : 'display:none;';
        const cycleLabel = cycleId > 0 ? '第' + cycleId + '轮' : '-';
        const labelColor = cycleId > 0 ? cycleColor : 'var(--color-text-tertiary)';
        let profitDisplay = '-';
        let profitClass = '';
        if (trade.type === 'sell') {
            const profitData = profitMap.get(trade.id);
            if (profitData) {
                const profitSign = profitData.profit >= 0 ? '+' : '';
                const rateSign = profitData.profitRate >= 0 ? '+' : '';
                profitDisplay = profitSign + Utils.formatMoneySmart(profitData.profit) + ' / ' + rateSign + Utils.formatNumber(profitData.profitRate, 2) + '%';
                profitClass = profitData.profit >= 0 ? 'trade-profit--positive' : 'trade-profit--negative';
            }
        }

        return '<tr class="cycle-group-trade-row" data-trade-id="' + trade.id + '" data-cycle-id="' + cycleId + '" ' +
            'data-tooltip="' + remarkTitle + '" style="border-left: 3px solid ' + cycleColor + '; background: ' + bgColor + '; ' + displayStyle + '">' +
            '<td>' + trade.date + '</td>' +
            '<td class="' + typeClass[trade.type] + '">' + typeText[trade.type] + '</td>' +
            '<td>' + priceDisplay + '</td>' +
            '<td>' + Utils.formatNumber(trade.shares) + '</td>' +
            '<td>' + Utils.formatMoney(trade.fee) + '</td>' +
            '<td>' + Utils.formatMoney(trade.amount) + '</td>' +
            '<td class="' + profitClass + '">' + profitDisplay + '</td>' +
            '<td class="trade-cycle-column"><span style="color: ' + labelColor + '; font-weight: 500;">' + cycleLabel + '</span></td>' +
            '<td>' +
            '<button class="btn btn-secondary btn-edit-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">编辑</button>' +
            '<button class="btn btn-danger btn-delete-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>' +
            '</td>' +
            '</tr>';
    },

    renderGroupedView(renderItems, profitMap = new Map()) {
        if (!renderItems || renderItems.length === 0) {
            return CycleGroupRenderer.renderEmptyState('暂无交易记录');
        }

        let html = '';
        for (let i = 0; i < renderItems.length; i++) {
            const item = renderItems[i];
            if (item.type === 'cycle-header') {
                html += CycleGroupRenderer.renderCycleGroupHeaderRow(
                    item.cycle, item.isExpanded, item.color, item.summary, item.cycleIndex
                );
            } else if (item.type === 'trade') {
                html += CycleGroupRenderer.renderTradeRow(
                    item.trade, item.color, item.isExpanded, item.cycleId, item.cycleIndex, profitMap
                );
            }
        }
        return html;
    },

    renderEmptyState(message) {
        return '<tr><td colspan="9" style="text-align: center; color: var(--color-text-tertiary); padding: 20px;">' + message + '</td></tr>';
    },

    renderUncategorizedGroup(trades, profitMap = new Map()) {
        if (!trades || trades.length === 0) return '';
        let html = '<tr class="cycle-group-header-row" style="border-left: 3px dashed var(--color-warning); background: var(--color-cycle-bg-odd);">' +
            '<td colspan="8"><div class="cycle-group-header"><span class="cycle-group-label" style="color: var(--color-warning);">未分类</span>' +
            '<span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">数据可能存在异常</span></div></td></tr>';
        for (let i = 0; i < trades.length; i++) {
            html += CycleGroupRenderer.renderTradeRow(trades[i], 'var(--color-warning)', true, -1, 0, profitMap);
        }
        return html;
    }
};

ModuleRegistry.register('CycleGroupRenderer', CycleGroupRenderer);

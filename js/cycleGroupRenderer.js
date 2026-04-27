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

        var html = '<select id="filter-cycle" class="filter-cycle-select">';
        html += '<option value="">全部轮次</option>';
        for (var i = 0; i < cycles.length; i++) {
            var cycle = cycles[i];
            var selected = (selectedCycleId === cycle.id) ? ' selected' : '';
            var statusText = cycle.status === 'active' ? '进行中' : '已结束';
            html += '<option value="' + cycle.id + '"' + selected + '>第' + cycle.id + '轮持仓 (' + statusText + ')</option>';
        }
        html += '</select>';
        return html;
    },

    renderCycleGroupHeaderRow(cycle, isExpanded, color, summary, cycleIndex) {
        var statusText = cycle.status === 'active' ? '进行中' : '已结束';
        var statusClass = cycle.status === 'active' ? 'cycle-group-status--active' : 'cycle-group-status--closed';
        var periodEnd = cycle.endDate || '至今';
        var bgColor = (cycleIndex % 2 === 0) ? 'var(--color-cycle-bg-odd)' : 'var(--color-cycle-bg-even)';
        var expandClass = isExpanded ? 'cycle-group--expanded' : 'cycle-group--collapsed';

        var html = '<tr class="cycle-group-header-row ' + expandClass + '" data-cycle-id="' + cycle.id + '" ' +
            'style="border-left: 3px solid ' + color + '; background: ' + bgColor + '; cursor: pointer;">' +
            '<td colspan="8" style="padding: 0;">' +
            '<div class="cycle-group-header" data-cycle-id="' + cycle.id + '">' +
            '<span class="cycle-toggle-indicator"></span>' +
            '<span class="cycle-group-label" style="color: ' + color + ';">第' + cycle.id + '轮持仓</span>' +
            '<span class="cycle-group-status ' + statusClass + '">' + statusText + '</span>' +
            '<span class="cycle-group-period">' + cycle.startDate + ' ~ ' + periodEnd + '</span>' +
            '</div>' +
            '</td>' +
            '</tr>';

        html += '<tr class="cycle-group-summary-row ' + expandClass + '" data-cycle-id="' + cycle.id + '" ' +
            'style="border-left: 3px solid ' + color + '; background: ' + bgColor + ';">' +
            '<td colspan="8">' +
            CycleGroupRenderer.renderCycleSummary(summary) +
            '</td>' +
            '</tr>';

        return html;
    },

    renderCycleSummary(summary) {
        var profitClass = summary.realizedProfit >= 0 ? 'summary-profit--positive' : 'summary-profit--negative';
        var profitSign = summary.realizedProfit >= 0 ? '+' : '';
        return '<div class="cycle-group-summary">' +
            summary.tradeCount + '笔交易 | ' +
            '投入 ' + Utils.formatMoneySmart(summary.totalInvest) + ' | ' +
            '收益 <span class="' + profitClass + '">' + profitSign + Utils.formatMoneySmart(summary.realizedProfit) + '</span>' +
            '</div>';
    },

    renderTradeRow(trade, cycleColor, isExpanded, cycleId, cycleIndex) {
        var typeText = { buy: '买入', sell: '卖出', dividend: '分红' };
        var typeClass = { buy: 'trade-type-buy', sell: 'trade-type-sell', dividend: 'trade-type-dividend' };
        var netValueDisplay = trade.netValue ? Utils.formatNumber(trade.netValue, 4) : '-';
        var remarkDisplay = trade.remark ? (trade.remark.length > 20 ? trade.remark.substring(0, 20) + '...' : trade.remark) : '-';
        var remarkTitle = trade.remark || '';
        var bgColor = (cycleIndex % 2 === 0) ? 'var(--color-cycle-bg-odd)' : 'var(--color-cycle-bg-even)';
        var displayStyle = isExpanded ? '' : 'display:none;';

        return '<tr class="cycle-group-trade-row" data-trade-id="' + trade.id + '" data-cycle-id="' + cycleId + '" ' +
            'style="border-left: 3px solid ' + cycleColor + '; background: ' + bgColor + '; ' + displayStyle + '">' +
            '<td><span class="trade-row-cycle-bar" style="background: ' + cycleColor + ';"></span>' + trade.date + '</td>' +
            '<td class="' + typeClass[trade.type] + '">' + typeText[trade.type] + '</td>' +
            '<td>' + netValueDisplay + '</td>' +
            '<td>' + Utils.formatNumber(trade.shares) + '</td>' +
            '<td>' + Utils.formatMoney(trade.amount) + '</td>' +
            '<td>' + Utils.formatMoney(trade.fee) + '</td>' +
            '<td class="trade-remark" title="' + remarkTitle + '">' + remarkDisplay + '</td>' +
            '<td>' +
            '<button class="btn btn-secondary btn-edit-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">编辑</button>' +
            '<button class="btn btn-danger btn-delete-trade" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>' +
            '</td>' +
            '</tr>';
    },

    renderGroupedView(renderItems) {
        if (!renderItems || renderItems.length === 0) {
            return CycleGroupRenderer.renderEmptyState('暂无交易记录');
        }

        var html = '';
        for (var i = 0; i < renderItems.length; i++) {
            var item = renderItems[i];
            if (item.type === 'cycle-header') {
                html += CycleGroupRenderer.renderCycleGroupHeaderRow(
                    item.cycle, item.isExpanded, item.color, item.summary, item.cycleIndex
                );
            } else if (item.type === 'trade') {
                html += CycleGroupRenderer.renderTradeRow(
                    item.trade, item.color, item.isExpanded, item.cycleId, item.cycleIndex
                );
            }
        }
        return html;
    },

    renderEmptyState(message) {
        return '<tr><td colspan="8" style="text-align: center; color: var(--color-text-tertiary); padding: 20px;">' + message + '</td></tr>';
    },

    renderUncategorizedGroup(trades) {
        if (!trades || trades.length === 0) return '';
        var html = '<tr class="cycle-group-header-row" style="border-left: 3px dashed var(--color-warning); background: var(--color-cycle-bg-odd);">' +
            '<td colspan="8"><div class="cycle-group-header"><span class="cycle-group-label" style="color: var(--color-warning);">未分类</span>' +
            '<span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">数据可能存在异常</span></div></td></tr>';
        for (var i = 0; i < trades.length; i++) {
            html += CycleGroupRenderer.renderTradeRow(trades[i], 'var(--color-warning)', true, -1, 0);
        }
        return html;
    }
};

ModuleRegistry.register('CycleGroupRenderer', CycleGroupRenderer);

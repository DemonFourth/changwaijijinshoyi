const TradeModalHelper = {
    getEffectiveFeeTiers(fund, settings) {
        const sourceTiers = fund && fund.feeTiers ? fund.feeTiers : { buyTiers: [], sellTiers: [] };
        const effective = {
            buyTiers: Array.isArray(sourceTiers.buyTiers) ? [...sourceTiers.buyTiers] : [],
            sellTiers: Array.isArray(sourceTiers.sellTiers) ? [...sourceTiers.sellTiers] : []
        };

        if (effective.buyTiers.length === 0 && settings.defaultBuyFeeRate > 0) {
            effective.buyTiers = [{
                minAmount: 0,
                maxAmount: null,
                rate: settings.defaultBuyFeeRate
            }];
        }

        if (effective.sellTiers.length === 0 && settings.defaultSellFeeRate > 0) {
            effective.sellTiers = [{
                minDays: 0,
                maxDays: null,
                rate: settings.defaultSellFeeRate
            }];
        }

        return effective;
    },

    calculateAutoAmount(netValue, shares, fee, type) {
        if (!Utils.isPositive(netValue) || !Utils.isPositive(shares)) {
            return {
                amount: null,
                hintText: ''
            };
        }

        let amount = netValue * shares;
        let hintText = '自动计算：净值×份额 = ' + amount.toFixed(2);

        if (type === 'buy') {
            amount += fee;
            hintText = '自动计算：净值×份额+手续费 = ' + amount.toFixed(2);
        } else if (type === 'sell') {
            amount -= fee;
            hintText = '自动计算：净值×份额-手续费 = ' + amount.toFixed(2);
        }

        return {
            amount,
            hintText
        };
    },

    buildAmountHintHtml(amount, tradeTypeLabel) {
        const label = tradeTypeLabel === '买入' ? '净值×份额+手续费' : tradeTypeLabel === '卖出' ? '净值×份额-手续费' : '净值×份额';
        return '<span class="hint-amount-inline">自动计算：' + label + ' = ' + amount.toFixed(2) + ' <button type="button" class="btn btn-primary btn-import-amount" data-amount="' + amount.toFixed(2) + '">导入金额</button></span>';
    },

    renderTradeFormSections(data) {
        const isEdit = data && data.trade;
        const trade = isEdit ? data.trade : {};
        const dateVal = isEdit ? trade.date : Utils.formatDate(new Date());
        const settings = window.AppSettingsService.loadSettings() || {};

        let html = '';

        html += '<div class="trade-form-compact">';

        html += '<div class="trade-form-row trade-form-row-main">';
        html += '<div class="trade-form-field">';
        html += '<label class="form-label">交易日期 *</label>';
        html += '<input type="date" id="input-trade-date" class="form-input" value="' + dateVal + '">';
        html += '</div>';
        html += '<div class="trade-form-field">';
        html += '<label class="form-label">交易类型 *</label>';
        html += '<select id="input-trade-type" class="form-select">';
        html += '<option value="buy"' + (trade.type === 'buy' ? ' selected' : '') + '>买入</option>';
        html += '<option value="sell"' + (trade.type === 'sell' ? ' selected' : '') + '>卖出</option>';
        html += '<option value="dividend"' + (trade.type === 'dividend' ? ' selected' : '') + '>分红</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="trade-form-field" id="dividend-mode-group"' + (trade.type === 'dividend' ? '' : ' style="display:none;"') + '>';
        html += '<label class="form-label">分红模式 *</label>';
        html += '<select id="input-dividend-mode" class="form-select">';
        const divMode = trade.dividendMode || settings.defaultDividendMode || 'cash';
        html += '<option value="cash"' + (divMode === 'cash' ? ' selected' : '') + '>现金分红</option>';
        html += '<option value="reinvest"' + (divMode === 'reinvest' ? ' selected' : '') + '>分红再投资</option>';
        html += '</select>';
        html += '</div>';
        html += '</div>';

        html += '<div class="trade-form-row trade-form-row-main">';
        html += '<div class="trade-form-field">';
        html += '<label class="form-label">净值 *</label>';
        html += '<input type="number" id="input-trade-net-value" class="form-input" value="' + (trade.netValue || '') + '" placeholder="请输入净值" step="0.0001" min="0">';
        html += '</div>';
        html += '<div class="trade-form-field">';
        html += '<label class="form-label">份额 *</label>';
        html += '<input type="number" id="input-trade-shares" class="form-input" value="' + (trade.shares || '') + '" placeholder="请输入份额" step="0.01" min="0">';
        html += '</div>';
        html += '<div class="trade-form-field">';
        html += '<label class="form-label">手续费 *</label>';
        const defaultFee = isEdit ? trade.fee : 0;
        html += '<input type="number" id="input-trade-fee" class="form-input" value="' + (trade.fee !== undefined && trade.fee !== '' ? trade.fee : defaultFee) + '" placeholder="请输入手续费" step="0.01" min="0">';
        html += '</div>';
        html += '</div>';

        html += '<div id="fee-suggestion-panel" class="fee-suggestion-panel hidden"></div>';

        html += '<div class="trade-form-row">';
        html += '<div class="trade-form-field trade-form-field-amount">';
        html += '<label class="form-label">金额</label>';
        html += '<input type="number" id="input-trade-amount" class="form-input" value="' + (trade.amount || '') + '" placeholder="自动计算，可手动修改" step="0.01" min="0">';
        html += '<div class="form-hint" id="hint-amount"></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="trade-form-field trade-form-remark">';
        html += '<label class="form-label">备注</label>';
        html += '<input type="text" id="input-trade-remark" class="form-input" value="' + (trade.remark || '') + '" placeholder="备注信息（可选）" maxlength="50">';
        html += '</div>';

        html += '</div>';

        return html;
    }
};

ModuleRegistry.register('TradeModalHelper', TradeModalHelper);

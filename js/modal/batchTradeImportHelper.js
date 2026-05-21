const BatchTradeImportHelper = {
    _fundId: null,
    _textarea: null,
    _separatorSelect: null,
    _savedTextareaContent: null,
    _savedSeparator: null,

    TYPE_MAP: {
        '1': { type: 'buy', label: '买入' },
        '2': { type: 'sell', label: '卖出' },
        '3': { type: 'dividend', dividendMode: 'cash', label: '分红(现金)' },
        '4': { type: 'dividend', dividendMode: 'reinvest', label: '分红(再投资)' }
    },

    SEPARATOR_MAP: {
        'comma': ',',
        'slash': '/',
        'space': ' ',
        'semicolon': ';',
        'tab': '\t'
    },

    show(fundId) {
        this._fundId = fundId;
        window.Modal.show('batchTradeImport', { fundId: fundId });
    },

    renderContent() {
        const content = `
            <div class="batch-import-modal">
                <div class="batch-import-info-row">
                    <div class="batch-import-format-hint">
                        <div class="format-title">格式说明：</div>
                        <div class="format-example" id="batch-import-format-example">
                            日期,类型,净值,份额,手续费,金额,备注
                        </div>
                        <div class="format-type-map">
                            类型：1=买入  2=卖出  3=分红(现金)  4=分红(再投资)
                        </div>
                        <div class="format-note">
                            手续费/金额/备注可留空，导入时自动计算
                        </div>
                    </div>

                    <div id="batch-import-error" class="batch-import-error hidden"></div>
                </div>

                <div class="batch-import-controls-row">
                    <div class="batch-import-quick-buttons">
                        <button type="button" class="btn btn-secondary btn-xs btn-quick-type" data-type="1">1 买入</button>
                        <button type="button" class="btn btn-secondary btn-xs btn-quick-type" data-type="2">2 卖出</button>
                        <button type="button" class="btn btn-secondary btn-xs btn-quick-type" data-type="3">3 分红(现金)</button>
                        <button type="button" class="btn btn-secondary btn-xs btn-quick-type" data-type="4">4 分红(再投资)</button>
                    </div>
                    <div class="batch-import-separator-inline">
                        <label class="separator-label">分隔符：</label>
                        <select id="batch-import-separator" class="form-select form-select-xs">
                            <option value="comma">逗号 ,</option>
                            <option value="slash">斜杠 /</option>
                            <option value="space">空格</option>
                            <option value="semicolon">分号 ;</option>
                            <option value="tab">制表符</option>
                        </select>
                    </div>
                </div>

                <textarea id="batch-import-textarea" class="batch-import-textarea"
                    placeholder="2024-01-15,1,1.2345,1000,,,首次买入&#10;2024-02-20,2,1.3000,500,,,&#10;2024-03-10,3,1.2500,100,50,1250,季度分红"
                    rows="10"></textarea>
            </div>
        `;

        const actions = `
            <button type="button" class="btn btn-secondary" id="btn-batch-import-cancel">取消</button>
            <button type="button" class="btn btn-primary" id="btn-batch-import-preview">预览并导入</button>
        `;

        return { content, actions };
    },

    bindEvents() {
        const btnCancel = document.getElementById('btn-batch-import-cancel');
        const btnPreview = document.getElementById('btn-batch-import-preview');
        const separatorSelect = document.getElementById('batch-import-separator');
        const textarea = document.getElementById('batch-import-textarea');

        this._separatorSelect = separatorSelect;
        this._textarea = textarea;

        btnCancel.addEventListener('click', () => {
            window.Modal.hide();
        });

        separatorSelect.addEventListener('change', () => {
            BatchTradeImportHelper._updateFormatHint();
        });

        textarea.addEventListener('input', () => {
            BatchTradeImportHelper._clearError();
        });

        document.querySelectorAll('.btn-quick-type').forEach(btn => {
            btn.addEventListener('click', () => {
                BatchTradeImportHelper._insertTypeAtCursor(btn.dataset.type);
            });
        });

        btnPreview.addEventListener('click', () => {
            BatchTradeImportHelper._handlePreview();
        });
    },

    _updateFormatHint() {
        const sep = this._getSeparator();
        const formatExample = document.getElementById('batch-import-format-example');
        if (formatExample) {
            const displaySep = sep === '\t' ? 'Tab' : sep;
            formatExample.textContent = '日期' + displaySep + '类型' + displaySep + '净值' + displaySep + '份额' + displaySep + '手续费' + displaySep + '金额' + displaySep + '备注';
        }
    },

    _getSeparator() {
        const value = this._separatorSelect ? this._separatorSelect.value : 'comma';
        return this.SEPARATOR_MAP[value] || ',';
    },

    _insertTypeAtCursor(typeCode) {
        const textarea = this._textarea;
        if (!textarea) return;

        const sep = this._getSeparator();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        const insertText = typeCode + sep;
        textarea.value = text.substring(0, start) + insertText + text.substring(end);

        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        textarea.focus();
    },

    _parseText(text) {
        const sep = this._getSeparator();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const results = {
            success: [],
            errors: []
        };

        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            const line = lines[i].trim();

            if (!line) continue;

            const parts = this._splitLine(line, sep);

            if (parts.length < 4) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '字段不足（至少需要日期、类型、净值、份额）'
                });
                continue;
            }

            const dateStr = parts[0].trim();
            const typeCode = parts[1].trim();
            const netValueStr = parts[2].trim();
            const sharesStr = parts[3].trim();
            const feeStr = parts.length > 4 ? parts[4].trim() : '';
            const amountStr = parts.length > 5 ? parts[5].trim() : '';
            const remark = parts.length > 6 ? parts[6].trim() : '';

            if (!dateStr || !Utils.isValidDate(dateStr)) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '日期格式错误（应为 YYYY-MM-DD）'
                });
                continue;
            }

            if (!this.TYPE_MAP[typeCode]) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '类型码无效（应为 1/2/3/4）'
                });
                continue;
            }

            const netValue = parseFloat(netValueStr);
            if (isNaN(netValue) || Utils.isNonPositive(netValue)) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '净值必须为正数'
                });
                continue;
            }

            const shares = parseFloat(sharesStr);
            if (isNaN(shares) || Utils.isNonPositive(shares)) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '份额必须为正数'
                });
                continue;
            }

            const typeInfo = this.TYPE_MAP[typeCode];
            const trade = {
                id: Utils.generateId(),
                fundId: this._fundId,
                date: dateStr,
                type: typeInfo.type,
                netValue: netValue,
                shares: shares,
                remark: remark
            };

            if (typeInfo.type === 'dividend') {
                trade.dividendMode = typeInfo.dividendMode;
            }

            const fee = feeStr !== '' ? parseFloat(feeStr) : null;
            const amount = amountStr !== '' ? parseFloat(amountStr) : null;

            if (fee !== null && (isNaN(fee) || Utils.isNegative(fee))) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '手续费必须为非负数'
                });
                continue;
            }

            if (amount !== null && isNaN(amount)) {
                results.errors.push({
                    line: lineNum,
                    content: line,
                    reason: '金额格式错误'
                });
                continue;
            }

            trade.fee = fee;
            trade.amount = amount;

            results.success.push(trade);
        }

        return results;
    },

    _splitLine(line, sep) {
        if (sep === ' ') {
            return line.split(/\s+/);
        }
        return line.split(sep);
    },

    _calculateMissingFields(trades) {
        const fund = FundManager.getFund(this._fundId);
        if (!fund) return trades;

        const settings = window.AppSettingsService.loadSettings() || {};
        const effectiveFeeTiers = window.TradeModalHelper.getEffectiveFeeTiers(fund, settings);
        const allExistingTrades = TradeManager.getTradesByFund(this._fundId);

        return trades.map(trade => {
            const calculatedTrade = { ...trade };

            if (calculatedTrade.fee === null) {
                calculatedTrade.fee = this._calculateFee(calculatedTrade, effectiveFeeTiers, allExistingTrades);
            }

            if (calculatedTrade.amount === null) {
                calculatedTrade.amount = this._calculateAmount(calculatedTrade);
            }

            return calculatedTrade;
        });
    },

    _calculateFee(trade, effectiveFeeTiers, allExistingTrades) {
        if (trade.type === 'buy') {
            const hasBuyTiers = effectiveFeeTiers.buyTiers && effectiveFeeTiers.buyTiers.length > 0;
            if (hasBuyTiers) {
                const amount = trade.netValue * trade.shares;
                const result = FeeCalculator.calculateBuyFee(amount, effectiveFeeTiers.buyTiers);
                return result.fee;
            }
            return 0;
        }

        if (trade.type === 'sell') {
            const hasSellTiers = effectiveFeeTiers.sellTiers && effectiveFeeTiers.sellTiers.length > 0;
            if (hasSellTiers) {
                const sellTrade = {
                    date: trade.date,
                    shares: trade.shares,
                    netValue: trade.netValue,
                    id: null
                };
                const result = FeeCalculator.calculateSellFee(sellTrade, allExistingTrades, effectiveFeeTiers.sellTiers);
                return result.fee;
            }
            return 0;
        }

        return trade.fee || 0;
    },

    _calculateAmount(trade) {
        const nv = trade.netValue;
        const shares = trade.shares;
        const fee = trade.fee || 0;

        if (trade.type === 'buy') {
            return nv * shares + fee;
        }

        if (trade.type === 'sell') {
            return nv * shares - fee;
        }

        if (trade.type === 'dividend') {
            if (trade.dividendMode === 'reinvest') {
                return nv * shares;
            }
            return nv * shares;
        }

        return nv * shares;
    },

    _handlePreview() {
        const textarea = document.getElementById('batch-import-textarea');
        if (!textarea) return;

        const text = textarea.value.trim();
        if (!text) {
            Utils.showToast('请输入交易记录数据', 'warning');
            return;
        }

        const parseResult = this._parseText(text);

        if (parseResult.errors.length > 0) {
            this._showParseErrors(parseResult.errors);
            return;
        }

        if (parseResult.success.length === 0) {
            Utils.showToast('未解析到有效的交易记录', 'warning');
            return;
        }

        const calculatedTrades = this._calculateMissingFields(parseResult.success);

        this._showPreview(calculatedTrades);
    },

    _showError(message) {
        const errorDiv = document.getElementById('batch-import-error');
        if (!errorDiv) return;

        errorDiv.innerHTML = '<div class="batch-import-error-message">' + message + '</div>';
        errorDiv.classList.remove('hidden');
    },

    _clearError() {
        const errorDiv = document.getElementById('batch-import-error');
        if (!errorDiv) return;

        errorDiv.innerHTML = '';
        errorDiv.classList.add('hidden');
    },

    _showParseErrors(errors) {
        const errorDiv = document.getElementById('batch-import-error');
        if (!errorDiv) return;

        let html = '<div class="batch-import-error-title">解析错误（共' + errors.length + '行）：</div>';
        html += '<ul class="batch-import-error-list">';

        errors.slice(0, 10).forEach(err => {
            html += '<li>第' + err.line + '行：' + err.reason + '</li>';
        });

        if (errors.length > 10) {
            html += '<li>... 还有' + (errors.length - 10) + '个错误</li>';
        }

        html += '</ul>';
        errorDiv.innerHTML = html;
        errorDiv.classList.remove('hidden');
    },

    _showPreview(trades) {
        const fund = FundManager.getFund(this._fundId);
        if (!fund) {
            this._showError('基金不存在');
            return;
        }

        const cleanTrades = trades.map(t => this._cleanUndefinedFields(t));

        this._savedTextareaContent = this._textarea ? this._textarea.value : '';
        this._savedSeparator = this._separatorSelect ? this._separatorSelect.value : 'comma';

        const analysis = {
            success: true,
            summary: {
                newFundsCount: 0,
                existingFundsCount: 1,
                newTradesCount: cleanTrades.length,
                duplicateTradesCount: 0,
                importFundsCount: 1,
                importTradesCount: cleanTrades.length,
                existingFundsCount2: 1,
                existingTradesCount: TradeManager.getTradesByFund(this._fundId).length
            },
            fundsWithNewTrades: [{
                fund: fund,
                trades: cleanTrades,
                tradeItems: cleanTrades.map(t => ({ trade: t, isNew: true })),
                newTrades: cleanTrades,
                duplicateTrades: []
            }],
            allDuplicateFunds: [],
            normalized: {
                funds: [fund],
                trades: cleanTrades
            }
        };

        window.Modal.hide();
        window.ImportPreviewHelper.show(analysis);
    },

    restoreState() {
        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        if (!container || !title || !body) return;

        title.textContent = '批量导入交易记录';
        body.innerHTML = this.renderContent().content;

        const rendered = this.renderContent();
        body.innerHTML = rendered.content;
        footer.innerHTML = rendered.actions || '';

        container.classList.remove('hidden');
        container.className = 'modal-container modal-batch-trade-import';

        this.bindEvents();

        setTimeout(() => {
            const textarea = document.getElementById('batch-import-textarea');
            const separatorSelect = document.getElementById('batch-import-separator');
            if (textarea && this._savedTextareaContent !== null) {
                textarea.value = this._savedTextareaContent;
            }
            if (separatorSelect && this._savedSeparator !== null) {
                separatorSelect.value = this._savedSeparator;
            }
            this._textarea = textarea;
            this._separatorSelect = separatorSelect;
        }, 0);
    },

    _cleanUndefinedFields(obj) {
        const clean = {};
        Object.keys(obj).forEach(key => {
            clean[key] = obj[key] === undefined ? null : obj[key];
        });
        return clean;
    }
};

ModuleRegistry.register('BatchTradeImportHelper', BatchTradeImportHelper);

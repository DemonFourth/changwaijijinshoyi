const ImportPreviewHelper = {
    _pendingData: null,
    _analysis: null,

    show(analysis) {
        console.log('[ImportPreview] show() called', analysis);
        console.log('[ImportPreview] ImportPreviewHelper available:', typeof ImportPreviewHelper);
        
        this._analysis = analysis;
        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        console.log('[ImportPreview] container:', container);
        console.log('[ImportPreview] title:', title);
        console.log('[ImportPreview] body:', body);

        if (!container || !title || !body) {
            console.error('[ImportPreview] ERROR: Required modal elements not found!');
            return;
        }

        title.textContent = '导入预览';
        console.log('[ImportPreview] Rendering content...');
        body.innerHTML = this._renderContent();
        footer.innerHTML = '';

        container.classList.remove('hidden');
        container.classList.add('modal-import-preview');

        console.log('[ImportPreview] Binding events...');
        this._bindEvents();
        console.log('[ImportPreview] show() complete');
    },

    hide() {
        window.Modal.hide();
        this._pendingData = null;
        this._analysis = null;
    },

    _renderContent() {
        const summary = this._analysis.summary;
        const hasNewTrades = this._analysis.fundsWithNewTrades.length > 0;
        const hasDuplicates = this._analysis.allDuplicateFunds.length > 0;
        const hasAnyData = hasNewTrades || hasDuplicates;

        let html = '';

        html += '<div class="ip-stat-cards">';
        html += `<div class="ip-stat-card ip-stat-card--new"><div class="ip-stat-num">${summary.newFundsCount}</div><div class="ip-stat-label">新增基金</div></div>`;
        html += `<div class="ip-stat-card ip-stat-card--existing"><div class="ip-stat-num">${summary.existingFundsCount}</div><div class="ip-stat-label">已存在基金</div></div>`;
        html += `<div class="ip-stat-card ip-stat-card--trades"><div class="ip-stat-num">${summary.newTradesCount}</div><div class="ip-stat-label">新增记录</div></div>`;
        html += `<div class="ip-stat-card ip-stat-card--duplicate"><div class="ip-stat-num">${summary.duplicateTradesCount}</div><div class="ip-stat-label">重复跳过</div></div>`;
        html += '</div>';

        if (!hasAnyData) {
            html += '<div class="ip-empty">没有需要导入的数据</div>';
            return html;
        }

        if (hasNewTrades) {
            html += '<div class="ip-stock-section">';
            html += '<div class="ip-section-label">有新增交易的基金</div>';
            for (const item of this._analysis.fundsWithNewTrades) {
                html += this._buildStockRow(item, false);
            }
            html += '</div>';
        }

        if (hasDuplicates) {
            html += '<div class="ip-stock-section">';
            html += '<div class="ip-section-label">全部重复的基金</div>';
            for (const item of this._analysis.allDuplicateFunds) {
                html += this._buildStockRow(item, true);
            }
            html += '</div>';
        }

        html += '<div class="ip-warning-box">';
        html += '<div class="ip-warning-icon">⚠️</div>';
        html += '<div class="ip-warning-text">';
        html += '<div class="ip-warning-title">覆盖警告</div>';
        
        const { importFundsCount, importTradesCount, existingFundsCount2, existingTradesCount } = summary;
        const fundsDiff = importFundsCount - existingFundsCount2;
        const tradesDiff = importTradesCount - existingTradesCount;
        
        if (fundsDiff < 0 || tradesDiff < 0) {
            html += `<div class="ip-warning-desc">导入数据较少：基金 ${importFundsCount} vs 现有 ${existingFundsCount2}，交易 ${importTradesCount} vs 现有 ${existingTradesCount}。覆盖将删除多余数据！</div>`;
        } else {
            html += '<div class="ip-warning-desc">覆盖操作将使用导入数据完全替换现有数据，建议使用「合并数据」功能</div>';
        }
        html += '</div>';
        html += '</div>';

        html += '<div class="ip-actions">';
        html += '<button class="btn btn-secondary" id="btn-import-cancel">取消</button>';
        html += '<button class="btn btn-warning" id="btn-import-merge">合并数据</button>';
        html += '<button class="btn btn-primary" id="btn-import-overwrite">覆盖数据</button>';
        html += '</div>';

        return html;
    },

    _buildStockRow(item, isDuplicate) {
        const fund = item.fund;
        const newCount = item.newTrades.length;
        const dupCount = item.duplicateTrades.length;
        const totalCount = item.trades.length;

        let html = '';
        html += `<div class="ip-stock-row ${isDuplicate ? 'ip-stock-row--duplicate' : ''}" data-fund-id="${fund.id}">`;
        html += '<div class="ip-stock-row-header">';
        html += `<span class="ip-stock-name">${fund.name}</span>`;
        html += `<span class="ip-stock-code">${fund.code}</span>`;

        if (isDuplicate) {
            html += `<span class="ip-stock-badge ip-stock-badge--duplicate">${totalCount}条重复</span>`;
        } else {
            if (newCount > 0) {
                html += `<span class="ip-stock-badge ip-stock-badge--new">${newCount}条新增</span>`;
            }
            if (dupCount > 0) {
                html += `<span class="ip-stock-badge ip-stock-badge--duplicate">${dupCount}条重复</span>`;
            }
        }

        html += `<span class="ip-stock-toggle ip-stock-toggle--collapsed">▼详情</span>`;
        html += '</div>';

        html += '<div class="ip-stock-detail" style="display: none;">';
        html += '<table class="ip-trade-table">';
        html += '<thead><tr><th>日期</th><th>类型</th><th>净值</th><th>份额</th><th>金额</th><th>状态</th></tr></thead>';
        html += '<tbody>';
        html += this._buildTradeRows(item.trades, isDuplicate);
        html += '</tbody>';
        html += '</table>';
        html += '</div>';

        html += '</div>';
        return html;
    },

    _buildTradeRows(items, isDuplicate = false) {
        const typeMap = { buy: '买入', sell: '卖出', dividend: '分红' };

        return items.map(trade => {
            return `
                <tr class="ip-trade-row ${isDuplicate ? 'ip-trade-row--muted' : ''}">
                    <td>${trade.date}</td>
                    <td>${typeMap[trade.type] || trade.type}</td>
                    <td>${trade.netValue}</td>
                    <td>${trade.shares}</td>
                    <td>${trade.amount || '-'}</td>
                    <td><span class="ip-trade-status ${isDuplicate ? 'ip-trade-status--duplicate' : 'ip-trade-status--new'}">${isDuplicate ? '重复' : '新增'}</span></td>
                </tr>
            `;
        }).join('');
    },

    _toggleDetail(header) {
        const row = header.closest('.ip-stock-row');
        const detail = row.querySelector('.ip-stock-detail');
        const toggle = row.querySelector('.ip-stock-toggle');

        if (detail.style.display === 'none' || detail.style.display === '') {
            detail.style.display = 'block';
            toggle.classList.remove('ip-stock-toggle--collapsed');
            toggle.textContent = '▲收起';
        } else {
            detail.style.display = 'none';
            toggle.classList.add('ip-stock-toggle--collapsed');
            toggle.textContent = '▼详情';
        }
    },

    _bindEvents() {
        const btnCancel = document.getElementById('btn-import-cancel');
        const btnMerge = document.getElementById('btn-import-merge');
        const btnOverwrite = document.getElementById('btn-import-overwrite');
        const btnClose = document.querySelector('.modal-close');

        btnCancel?.addEventListener('click', () => this.hide());

        btnMerge?.addEventListener('click', async () => {
            if (this._analysis?.normalized) {
                const result = await window.ImportAppService.importData(this._analysis.normalized, { merge: true });
                if (result.success) {
                    Utils.showToast(`合并成功：${result.importedTrades}条交易记录`, 'success');
                    this.hide();
                    EventBus.emit(EventType.DATA_IMPORTED, { merge: true, data: this._analysis.normalized });
                } else {
                    Utils.showToast('合并失败：' + result.reason, 'error');
                }
            }
        });

        btnOverwrite?.addEventListener('click', async () => {
            if (this._analysis?.normalized) {
                const result = await window.ImportAppService.importData(this._analysis.normalized, { merge: false });
                if (result.success) {
                    Utils.showToast(`覆盖成功：${result.importedTrades}条交易记录`, 'success');
                    this.hide();
                    EventBus.emit(EventType.DATA_IMPORTED, { merge: false, data: this._analysis.normalized });
                } else {
                    Utils.showToast('覆盖失败：' + result.reason, 'error');
                }
            }
        });

        btnClose?.addEventListener('click', () => this.hide());

        console.log('[ImportPreview] Binding toggle events, toggles found:', document.querySelectorAll('.ip-stock-toggle').length);
        document.querySelectorAll('.ip-stock-toggle').forEach(toggle => {
            console.log('[ImportPreview] Adding click listener to toggle:', toggle);
            toggle.addEventListener('click', (e) => {
                console.log('[ImportPreview] Toggle clicked!');
                e.stopPropagation();
                const header = toggle.closest('.ip-stock-row-header');
                console.log('[ImportPreview] header:', header);
                if (header) {
                    this._toggleDetail(header);
                }
            });
        });
    }
};

ModuleRegistry.register('ImportPreviewHelper', ImportPreviewHelper);
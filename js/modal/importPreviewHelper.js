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

        const rendered = this._renderContent();
        body.innerHTML = rendered.content;

        const modalEl = container.querySelector('.modal');
        if (modalEl) {
            const existingActions = modalEl.querySelector('.ip-actions');
            if (existingActions) existingActions.remove();
            modalEl.insertAdjacentHTML('beforeend', rendered.actionsHtml);
        }

        footer.innerHTML = '';
        footer.style.display = 'none';

        container.classList.remove('hidden');
        container.classList.add('modal-import-preview');

        console.log('[ImportPreview] Binding events...');
        this._bindEvents();
        console.log('[ImportPreview] show() complete');
    },

    hide() {
        const footer = document.getElementById('modal-footer');
        if (footer) {
            footer.style.display = '';
        }
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
        html += `<div class="ip-stat-card ip-stat-card--new"><span class="ip-stat-card-icon">📦</span><div class="ip-stat-card-value">${summary.newFundsCount}</div><div class="ip-stat-card-label">新增基金</div></div>`;
        html += `<div class="ip-stat-card ip-stat-card--existing"><span class="ip-stat-card-icon">📋</span><div class="ip-stat-card-value">${summary.existingFundsCount}</div><div class="ip-stat-card-label">已存在基金</div></div>`;
        html += `<div class="ip-stat-card ip-stat-card--trades"><span class="ip-stat-card-icon">📝</span><div class="ip-stat-card-value">${summary.newTradesCount}</div><div class="ip-stat-card-label">新增记录</div></div>`;
        html += `<div class="ip-stat-card ip-stat-card--duplicate"><span class="ip-stat-card-icon">⏭</span><div class="ip-stat-card-value">${summary.duplicateTradesCount}</div><div class="ip-stat-card-label">重复跳过</div></div>`;
        html += '</div>';

        if (!hasAnyData) {
            html += '<div class="ip-empty">';
            html += '<div class="ip-empty-icon">📭</div>';
            html += '<div class="ip-empty-text">没有需要导入的数据</div>';
            html += '</div>';
            return { content: html, actionsHtml: '' };
        }

        if (hasNewTrades) {
            html += '<div class="ip-section">';
            html += '<div class="ip-section-header"><span class="ip-section-icon">✨</span><span class="ip-section-title">有新增交易的基金</span><span class="ip-section-count">' + this._analysis.fundsWithNewTrades.length + '只</span></div>';
            for (const item of this._analysis.fundsWithNewTrades) {
                html += this._buildStockRow(item, false);
            }
            html += '</div>';
        }

        if (hasDuplicates) {
            html += '<div class="ip-section">';
            html += '<div class="ip-section-header"><span class="ip-section-icon">📋</span><span class="ip-section-title">全部重复的基金</span><span class="ip-section-count">' + this._analysis.allDuplicateFunds.length + '只</span></div>';
            for (const item of this._analysis.allDuplicateFunds) {
                html += this._buildStockRow(item, true);
            }
            html += '</div>';
        }

        const { importFundsCount, importTradesCount, existingFundsCount2, existingTradesCount } = summary;
        const fundsDiff = importFundsCount - existingFundsCount2;
        const tradesDiff = importTradesCount - existingTradesCount;

        html += '<div class="ip-warning-box">';
        html += '<svg class="ip-warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        html += '<div class="ip-warning-content">';
        html += '<div class="ip-warning-title">覆盖警告</div>';
        if (fundsDiff < 0 || tradesDiff < 0) {
            html += `<div class="ip-warning-desc">导入数据较少：基金 ${importFundsCount} vs 现有 ${existingFundsCount2}，交易 ${importTradesCount} vs 现有 ${existingTradesCount}。覆盖将删除多余数据！</div>`;
        } else {
            html += '<div class="ip-warning-desc">覆盖操作将使用导入数据完全替换现有数据，建议使用「合并数据」功能</div>';
        }
        html += '</div>';
        html += '</div>';

        return {
            content: html,
            actionsHtml: '<div class="ip-actions">' +
                '<button class="ip-btn ip-btn--secondary" id="btn-import-cancel">取消</button>' +
                '<button class="ip-btn ip-btn--merge" id="btn-import-merge">合并数据</button>' +
                '<button class="ip-btn ip-btn--overwrite" id="btn-import-overwrite">覆盖数据</button>' +
                '</div>'
        };
    },

    _buildStockRow(item, isDuplicate) {
        const fund = item.fund;
        const newCount = item.newTrades ? item.newTrades.length : 0;
        const dupCount = item.duplicateTrades ? item.duplicateTrades.length : 0;
        const totalCount = item.trades.length;

        let html = '';
        html += `<div class="ip-stock-row ${isDuplicate ? 'ip-stock-row--duplicate' : ''}" data-fund-id="${fund.id}">`;
        html += '<div class="ip-stock-row-header">';
        html += '<div class="ip-stock-indicator"></div>';
        html += '<div class="ip-stock-info">';
        html += `<div class="ip-stock-name">${fund.name}</div>`;
        html += `<div class="ip-stock-code">${fund.code}</div>`;
        html += '</div>';
        html += '<div class="ip-stock-badges">';

        if (isDuplicate) {
            html += `<span class="ip-badge ip-badge--duplicate">${totalCount}条重复</span>`;
        } else {
            if (newCount > 0) {
                html += `<span class="ip-badge ip-badge--new">${newCount}条新增</span>`;
            }
            if (dupCount > 0) {
                html += `<span class="ip-badge ip-badge--duplicate">${dupCount}条重复</span>`;
            }
        }

        html += '</div>';
        html += '<span class="ip-stock-toggle">▼详情</span>';
        html += '</div>';

        html += '<div class="ip-stock-detail" style="display: none;">';
        html += '<table class="ip-trade-table">';
        html += '<thead><tr><th>日期</th><th>类型</th><th>净值</th><th>份额</th><th>金额</th><th>状态</th></tr></thead>';
        html += '<tbody>';

        // tradeItems has {trade, isNew}, trades is raw array
        const tradeData = item.tradeItems || item.trades;
        html += this._buildTradeRows(tradeData, isDuplicate);
        html += '</tbody>';
        html += '</table>';
        html += '</div>';

        html += '</div>';
        return html;
    },

    _buildTradeRows(items, isDuplicate = false) {
        const typeConfig = {
            buy: { label: '买入', icon: '→', class: 'type-buy' },
            sell: { label: '卖出', icon: '←', class: 'type-sell' },
            dividend: { label: '分红', icon: '✦', class: 'type-dividend' }
        };

        const formatNumber = (num, decimals = 2) => {
            if (num === null || num === undefined || num === '-') return '-';
            const n = parseFloat(num);
            if (isNaN(n)) return num;
            return n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        };

        const formatAmount = (num) => {
            if (num === null || num === undefined || num === '-') return '-';
            const n = parseFloat(num);
            if (isNaN(n)) return num;
            return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        return items.map(item => {
            const trade = item.trade || item;
            const isNew = item.isNew !== undefined ? item.isNew : !isDuplicate;
            const config = typeConfig[trade.type] || { label: trade.type, icon: '', class: '' };

            return `
                <tr class="ip-trade-row ${isNew ? '' : 'ip-trade-row--muted'}">
                    <td class="ip-td-date">${trade.date}</td>
                    <td class="ip-td-type"><span class="ip-type-badge ${config.class}">${config.icon} ${config.label}</span></td>
                    <td class="ip-td-netvalue">${formatNumber(trade.netValue, 4)}</td>
                    <td class="ip-td-shares">${formatNumber(trade.shares)}</td>
                    <td class="ip-td-amount ${isNew ? 'ip-td-amount--highlight' : ''}">${formatAmount(trade.amount)}</td>
                    <td class="ip-td-status"><span class="ip-status-badge ${isNew ? 'ip-status-badge--new' : 'ip-status-badge--duplicate'}">${isNew ? '新增' : '重复'}</span></td>
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
            toggle.classList.add('ip-stock-toggle--expanded');
            toggle.textContent = '▲收起';
        } else {
            detail.style.display = 'none';
            toggle.classList.remove('ip-stock-toggle--expanded');
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

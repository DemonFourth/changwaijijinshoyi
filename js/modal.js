/**
 * 弹窗管理器
 * 管理各种弹窗的显示和交互
 */

const Modal = {
    currentType: null,

    show(type, data = {}) {
        Modal.currentType = type;

        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        let result;

        switch (type) {
        case 'addFund':
            title.textContent = '添加基金';
            result = Modal.renderAddFundForm();
            break;

        case 'addTrade':
            title.textContent = '添加交易';
            result = Modal.renderAddTradeForm(data);
            break;

        case 'editTrade':
            title.textContent = '编辑交易';
            result = Modal.renderEditTradeForm(data);
            break;

        case 'deleteConfirm':
            title.textContent = '确认删除';
            result = Modal.renderDeleteConfirm(data);
            break;

        case 'import':
            title.textContent = '导入数据';
            result = Modal.renderImportForm();
            break;

        case 'export':
            title.textContent = '导出数据';
            result = Modal.renderExportForm();
            break;

        default:
            console.error('Unknown modal type:', type);
            return;
        }

        if (typeof result === 'object' && result.content !== undefined) {
            body.innerHTML = result.content;
            footer.innerHTML = result.actions || '';
        } else {
            body.innerHTML = result;
            footer.innerHTML = '';
        }

        container.classList.remove('hidden');

        body.scrollTop = 0;

        switch (type) {
        case 'addFund':
            Modal.bindAddFundEvents();
            break;
        case 'addTrade':
            Modal.bindAddTradeEvents(data);
            break;
        case 'editTrade':
            Modal.bindEditTradeEvents(data);
            break;
        case 'deleteConfirm':
            Modal.bindDeleteConfirmEvents(data);
            break;
        case 'import':
            Modal.bindImportEvents();
            break;
        case 'export':
            Modal.bindExportEvents();
            break;
        }

        EventBus.emit(EventType.MODAL_OPENED, { type, data });
    },

    hide() {
        const container = document.getElementById('modal-container');
        container.classList.add('hidden');
        Modal.currentType = null;
        EventBus.emit(EventType.MODAL_CLOSED);
    },

    renderAddFundForm() {
        return {
            content: '<div class="form-group">' +
                '<label class="form-label">基金代码 *</label>' +
                '<input type="text" id="input-fund-code" class="form-input" placeholder="请输入6位基金代码" maxlength="6">' +
                '<div id="error-fund-code" class="form-error"></div>' +
                '</div>' +
                '<div class="form-group">' +
                '<label class="form-label">基金名称</label>' +
                '<div class="form-name-preview">' +
                '<input type="text" id="input-fund-name" class="form-input form-name-preview-input" placeholder="输入代码后自动获取">' +
                '<button class="btn btn-secondary form-name-preview-refresh" id="btn-refresh-name" title="清除缓存并重新获取">🔄</button>' +
                '</div>' +
                '<div class="form-name-source" id="name-source-info">' +
                '<span class="form-name-source-badge" id="name-source-badge">等待获取</span>' +
                '<span class="form-name-status" id="name-status"></span>' +
                '</div>' +
                '</div>' +
                '<div class="form-group">' +
                '<label class="form-label">备注</label>' +
                '<input type="text" id="input-fund-remark" class="form-input" placeholder="添加备注（可选）" maxlength="50">' +
                '</div>',
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                '<button class="btn btn-primary" id="btn-confirm-add-fund">确定</button>'
        };
    },

    bindAddFundEvents() {
        const btnConfirm = document.getElementById('btn-confirm-add-fund');
        const inputCode = document.getElementById('input-fund-code');
        const inputName = document.getElementById('input-fund-name');
        const btnRefreshName = document.getElementById('btn-refresh-name');
        const errorDiv = document.getElementById('error-fund-code');
        const sourceBadge = document.getElementById('name-source-badge');
        const nameStatus = document.getElementById('name-status');

        let currentCode = '';
        let currentName = '';
        let currentSource = '';

        const updateNameUI = function(name, source, isGarbled) {
            inputName.value = name || '';
            currentName = name || '';
            currentSource = source || '';

            sourceBadge.textContent = source === 'api' ? 'API获取' :
                source === 'cache' ? '缓存' :
                    source === 'manual' ? '手动修改' : '等待获取';
            sourceBadge.className = 'form-name-source-badge';
            if (source === 'api') sourceBadge.classList.add('form-name-source-badge--api');
            else if (source === 'cache') sourceBadge.classList.add('form-name-source-badge--cache');
            else if (source === 'manual') sourceBadge.classList.add('form-name-source-badge--manual');

            if (isGarbled) {
                nameStatus.textContent = '⚠️ 可能是乱码';
                nameStatus.className = 'form-name-status form-name-status--garbled';
                inputName.style.borderColor = 'var(--color-warning)';
            } else if (name) {
                nameStatus.textContent = '✓ 名称有效';
                nameStatus.className = 'form-name-status form-name-status--valid';
                inputName.style.borderColor = '';
            } else {
                nameStatus.textContent = '';
                inputName.style.borderColor = '';
            }
        };

        const fetchName = async function(code, forceRefresh) {
            if (!Utils.isValidFundCode(code)) {
                updateNameUI('', '', false);
                return;
            }

            try {
                if (forceRefresh) {
                    FundAPI.clearCacheForFund(code);
                    NameCache.remove(code);
                }

                const cachedEntry = NameCache.get(code);
                if (cachedEntry && !forceRefresh) {
                    const isGarbled = NameValidator.detectGarbled(cachedEntry.name).isGarbled;
                    updateNameUI(cachedEntry.name, 'cache', isGarbled);
                    EventBus.emit(EventType.NAME_CACHE_HIT, { code: code, name: cachedEntry.name });
                    return;
                }

                const name = await FundAPI.fetchNameOnly(code);
                const validation = NameValidator.detectGarbled(name);
                updateNameUI(name, 'api', validation.isGarbled);

                if (!validation.isGarbled) {
                    NameCache.set(code, name, 'api');
                }

                EventBus.emit(EventType.NAME_FETCHED, { code: code, name: name, isGarbled: validation.isGarbled });
            } catch (error) {
                console.error('Failed to fetch name:', error);
                updateNameUI('', '', false);
                errorDiv.textContent = '获取基金名称失败: ' + error.message;
            }
        };

        let debounceTimer = null;
        inputCode.addEventListener('input', function() {
            const code = inputCode.value.trim();
            errorDiv.textContent = '';

            if (debounceTimer) clearTimeout(debounceTimer);

            if (!Utils.isValidFundCode(code)) {
                updateNameUI('', '', false);
                currentCode = '';
                return;
            }

            currentCode = code;
            debounceTimer = setTimeout(function() {
                fetchName(code, false);
            }, 500);
        });

        inputName.addEventListener('input', function() {
            const name = inputName.value.trim();
            if (name !== currentName) {
                const validation = NameValidator.detectGarbled(name);
                updateNameUI(name, 'manual', validation.isGarbled);
                EventBus.emit(EventType.NAME_MANUAL_EDIT, { code: currentCode, name: name });
            }
        });

        btnRefreshName.addEventListener('click', async function() {
            if (!currentCode) return;

            btnRefreshName.disabled = true;
            btnRefreshName.textContent = '...';

            await fetchName(currentCode, true);

            btnRefreshName.disabled = false;
            btnRefreshName.textContent = '🔄';
            EventBus.emit(EventType.NAME_REFRESH_REQUESTED, { code: currentCode });
        });

        btnConfirm.addEventListener('click', async () => {
            const code = inputCode.value.trim();
            const name = inputName.value.trim();
            const remark = document.getElementById('input-fund-remark').value.trim();
            currentCode = code;
            currentName = name;

            errorDiv.textContent = '';
            inputCode.classList.remove('form-input-error');

            if (!code) {
                errorDiv.textContent = '请输入基金代码';
                inputCode.classList.add('form-input-error');
                return;
            }

            if (!Utils.isValidFundCode(code)) {
                errorDiv.textContent = '基金代码格式不正确（6位数字）';
                inputCode.classList.add('form-input-error');
                return;
            }

            try {
                Utils.showLoading();
                EventBus.emit(EventType.FUND_ADDING);

                const fundData = {
                    code: code,
                    name: name,
                    remark: remark, // 添加备注
                    nameSource: name ? 'manual' : 'api'
                };

                const fund = await FundManager.addFund(fundData);

                Utils.hideLoading();
                Modal.hide();
                Router.navigate('detail', { fundId: fund.id });
            } catch (error) {
                Utils.hideLoading();
                errorDiv.textContent = error.message;
                inputCode.classList.add('form-input-error');
            }
        });
    },

    renderTradeFormSections(data) {
        const isEdit = data && data.trade;
        const trade = isEdit ? data.trade : {};
        const dateVal = isEdit ? trade.date : Utils.formatDate(new Date());

        let html = '';

        html += '<div class="form-section">';
        html += '<div class="form-section-title">基础信息</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">交易日期 *</label>';
        html += '<input type="date" id="input-trade-date" class="form-input" value="' + dateVal + '">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">交易类型 *</label>';
        html += '<select id="input-trade-type" class="form-select">';
        html += '<option value="buy"' + (trade.type === 'buy' ? ' selected' : '') + '>买入</option>';
        html += '<option value="sell"' + (trade.type === 'sell' ? ' selected' : '') + '>卖出</option>';
        html += '<option value="dividend"' + (trade.type === 'dividend' ? ' selected' : '') + '>分红</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="form-group" id="dividend-mode-group"' + (trade.type === 'dividend' ? '' : ' style="display:none;"') + '>';
        html += '<label class="form-label">分红模式 *</label>';
        html += '<select id="input-dividend-mode" class="form-select">';
        const divMode = trade.dividendMode || 'cash';
        html += '<option value="cash"' + (divMode === 'cash' ? ' selected' : '') + '>现金分红</option>';
        html += '<option value="reinvest"' + (divMode === 'reinvest' ? ' selected' : '') + '>分红再投资</option>';
        html += '</select>';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-section">';
        html += '<div class="form-section-title">交易详情</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">净值 *</label>';
        html += '<input type="number" id="input-trade-net-value" class="form-input" value="' + (trade.netValue || '') + '" placeholder="请输入净值" step="0.0001" min="0">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">份额 *</label>';
        html += '<input type="number" id="input-trade-shares" class="form-input" value="' + (trade.shares || '') + '" placeholder="请输入份额" step="0.01" min="0">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">手续费 *</label>';
        html += '<input type="number" id="input-trade-fee" class="form-input" value="' + (trade.fee !== undefined ? trade.fee : '0') + '" placeholder="请输入手续费" step="0.01" min="0">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">金额</label>';
        html += '<input type="number" id="input-trade-amount" class="form-input" value="' + (trade.amount || '') + '" placeholder="自动计算，可手动修改" step="0.01" min="0">';
        html += '<div class="form-hint" id="hint-amount"></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-section">';
        html += '<div class="form-section-title">其他信息</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">备注</label>';
        html += '<input type="text" id="input-trade-remark" class="form-input" value="' + (trade.remark || '') + '" placeholder="备注信息（可选）" maxlength="50">';
        html += '</div>';
        html += '</div>';

        return html;
    },

    renderAddTradeForm(data) {
        return {
            content: Modal.renderTradeFormSections(data || {}),
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                '<button class="btn btn-primary" id="btn-confirm-add-trade">确定</button>'
        };
    },

    renderEditTradeForm(data) {
        return {
            content: Modal.renderTradeFormSections(data),
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                '<button class="btn btn-primary" id="btn-confirm-edit-trade">确定</button>'
        };
    },

    bindTradeEvents(data, isEdit) {
        const btnId = isEdit ? 'btn-confirm-edit-trade' : 'btn-confirm-add-trade';
        const btnConfirm = document.getElementById(btnId);
        const tradeType = document.getElementById('input-trade-type');
        const dividendMode = document.getElementById('input-dividend-mode');
        const dividendModeGroup = document.getElementById('dividend-mode-group');
        const netValue = document.getElementById('input-trade-net-value');
        const shares = document.getElementById('input-trade-shares');
        const fee = document.getElementById('input-trade-fee');
        const amount = document.getElementById('input-trade-amount');
        const hintAmount = document.getElementById('hint-amount');

        const updateFieldsVisibility = function() {
            const type = tradeType.value;
            const divMode = dividendMode ? dividendMode.value : 'cash';

            if (dividendModeGroup) {
                dividendModeGroup.style.display = (type === 'dividend') ? '' : 'none';
            }

            if (type === 'dividend' && divMode === 'reinvest') {
                netValue.parentElement.style.display = '';
                fee.parentElement.style.display = 'none';
                fee.value = '0';
                amount.placeholder = '分红金额（可选，不知道可不填）';
            } else if (type === 'dividend') {
                netValue.parentElement.style.display = '';
                fee.parentElement.style.display = '';
                amount.placeholder = '自动计算，可手动修改';
            } else {
                netValue.parentElement.style.display = '';
                fee.parentElement.style.display = '';
                amount.placeholder = '自动计算，可手动修改';
            }
        };

        tradeType.addEventListener('change', updateFieldsVisibility);
        if (dividendMode) {
            dividendMode.addEventListener('change', updateFieldsVisibility);
        }
        updateFieldsVisibility();

        let autoCalcAmount = null;

        const calcAmount = () => {
            const nv = parseFloat(netValue.value);
            const s = parseFloat(shares.value);
            const f = parseFloat(fee.value) || 0;
            const type = tradeType.value;

            if (nv > 0 && s > 0) {
                if (type === 'buy') {
                    autoCalcAmount = nv * s + f;
                } else if (type === 'sell') {
                    autoCalcAmount = nv * s - f;
                } else {
                    autoCalcAmount = nv * s;
                }
                amount.value = autoCalcAmount.toFixed(2);
                hintAmount.textContent = type === 'buy'
                    ? '自动计算：净值×份额+手续费 = ' + autoCalcAmount.toFixed(2)
                    : type === 'sell'
                        ? '自动计算：净值×份额-手续费 = ' + autoCalcAmount.toFixed(2)
                        : '自动计算：净值×份额 = ' + autoCalcAmount.toFixed(2);
                hintAmount.classList.remove('form-hint-warn');
                amount.classList.remove('form-input-mismatch');
            } else {
                autoCalcAmount = null;
                amount.value = '';
                hintAmount.textContent = '';
            }
        };

        const checkMismatch = () => {
            if (autoCalcAmount === null) return;
            const currentAmount = parseFloat(amount.value);
            if (isNaN(currentAmount)) return;

            const diff = Math.abs(currentAmount - autoCalcAmount);
            if (diff > 0.01) {
                hintAmount.textContent = '与自动计算值 ' + autoCalcAmount.toFixed(2) + ' 不一致，请确认';
                hintAmount.classList.add('form-hint-warn');
                amount.classList.add('form-input-mismatch');
            } else {
                const type = tradeType.value;
                hintAmount.textContent = type === 'buy'
                    ? '自动计算：净值×份额+手续费 = ' + autoCalcAmount.toFixed(2)
                    : type === 'sell'
                        ? '自动计算：净值×份额-手续费 = ' + autoCalcAmount.toFixed(2)
                        : '自动计算：净值×份额 = ' + autoCalcAmount.toFixed(2);
                hintAmount.classList.remove('form-hint-warn');
                amount.classList.remove('form-input-mismatch');
            }
        };

        netValue.addEventListener('input', calcAmount);
        shares.addEventListener('input', calcAmount);
        fee.addEventListener('input', calcAmount);
        tradeType.addEventListener('change', calcAmount);

        amount.addEventListener('focus', () => {
            if (autoCalcAmount !== null) {
                amount.value = '';
            }
        });

        amount.addEventListener('input', checkMismatch);

        btnConfirm.addEventListener('click', () => {
            const tradeData = {
                date: document.getElementById('input-trade-date').value,
                type: tradeType.value,
                netValue: netValue.value,
                shares: shares.value,
                amount: amount.value,
                fee: fee.value,
                remark: document.getElementById('input-trade-remark').value
            };

            if (tradeType.value === 'dividend' && dividendMode) {
                tradeData.dividendMode = dividendMode.value;
            }

            if (isEdit) {
                const success = TradeManager.updateTrade(data.trade.id, tradeData);
                if (success) {
                    Modal.hide();
                    if (typeof Detail !== 'undefined') {
                        Detail.refresh();
                    }
                }
            } else {
                tradeData.fundId = data.fundId;
                const trade = TradeManager.addTrade(tradeData);
                if (trade) {
                    Modal.hide();
                    if (typeof Detail !== 'undefined') {
                        Detail.refresh();
                    }
                }
            }
        });
    },

    bindAddTradeEvents(data) {
        Modal.bindTradeEvents(data, false);
    },

    bindEditTradeEvents(data) {
        Modal.bindTradeEvents(data, true);
    },

    renderDeleteConfirm(data) {
        return {
            content: '<p style="margin-bottom: 1.5rem;">' + (data.message || '确定要删除吗？此操作不可恢复。') + '</p>',
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                '<button class="btn btn-danger" id="btn-confirm-delete">删除</button>'
        };
    },

    bindDeleteConfirmEvents(data) {
        const btnConfirm = document.getElementById('btn-confirm-delete');

        btnConfirm.addEventListener('click', () => {
            if (data.onConfirm) {
                data.onConfirm();
            }
            Modal.hide();
        });
    },

    renderImportForm() {
        return {
            content: '<div class="form-group">' +
                '<label class="form-label">选择文件</label>' +
                '<input type="file" id="input-import-file" class="form-input" accept=".json">' +
                '</div>' +
                '<div class="form-group">' +
                '<label>' +
                '<input type="checkbox" id="input-merge-data"> 合并数据（不勾选则覆盖）' +
                '</label>' +
                '</div>',
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                '<button class="btn btn-primary" id="btn-confirm-import">导入</button>'
        };
    },

    bindImportEvents() {
        const btnConfirm = document.getElementById('btn-confirm-import');

        btnConfirm.addEventListener('click', () => {
            const fileInput = document.getElementById('input-import-file');
            const mergeCheckbox = document.getElementById('input-merge-data');

            if (!fileInput.files || fileInput.files.length === 0) {
                Utils.showToast('请选择文件', 'error');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const merge = mergeCheckbox.checked;

                    const success = DataService.importData(data, merge);

                    if (success) {
                        Utils.showToast('数据导入成功', 'success');
                        Modal.hide();
                        if (typeof Overview !== 'undefined') {
                            Overview.refresh();
                        }
                    } else {
                        Utils.showToast('数据导入失败', 'error');
                    }
                } catch (error) {
                    Utils.showToast('文件格式错误', 'error');
                }
            };

            reader.readAsText(file);
        });
    },

    renderExportForm() {
        const data = DataService.exportData();
        const jsonStr = JSON.stringify(data, null, 2);

        return {
            content: '<div class="form-group">' +
                '<label class="form-label">数据预览</label>' +
                '<textarea class="form-input" rows="10" readonly>' + jsonStr + '</textarea>' +
                '</div>',
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">关闭</button>' +
                '<button class="btn btn-primary" id="btn-confirm-export">下载文件</button>'
        };
    },

    bindExportEvents() {
        const btnConfirm = document.getElementById('btn-confirm-export');

        btnConfirm.addEventListener('click', () => {
            const data = DataService.exportData();
            const jsonStr = JSON.stringify(data, null, 2);

            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'fund-data-' + Utils.formatDate(new Date(), 'YYYY-MM-DD') + '.json';
            a.click();
            URL.revokeObjectURL(url);

            Utils.showToast('数据导出成功', 'success');
            Modal.hide();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.querySelector('.modal-close');
    const overlay = document.querySelector('.modal-overlay');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => Modal.hide());
    }

    if (overlay) {
        overlay.addEventListener('click', () => Modal.hide());
    }
});

ModuleRegistry.register('Modal', Modal);

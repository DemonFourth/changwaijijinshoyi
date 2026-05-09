/**
 * 弹窗管理器
 * 管理各种弹窗的显示和交互
 */

/* global FeeCalculator ImportPreviewHelper */

const Modal = {
    currentType: null,
    modalConfigs: {
        addFund: {
            title: '添加基金',
            render: () => Modal.renderAddFundForm(),
            bind: () => Modal.bindAddFundEvents()
        },
        addTrade: {
            title: '添加交易',
            render: (data) => Modal.renderAddTradeForm(data),
            bind: (data) => Modal.bindAddTradeEvents(data)
        },
        editTrade: {
            title: '编辑交易',
            render: (data) => Modal.renderEditTradeForm(data),
            bind: (data) => Modal.bindEditTradeEvents(data)
        },
        deleteConfirm: {
            title: '确认删除',
            render: (data) => Modal.renderDeleteConfirm(data),
            bind: (data) => Modal.bindDeleteConfirmEvents(data)
        },
        import: {
            title: '导入数据',
            render: () => Modal.renderImportForm(),
            bind: () => Modal.bindImportEvents()
        },
        importPreview: {
            title: '导入预览',
            render: () => '',
            bind: () => {}
        },
        export: {
            title: '导出数据',
            render: () => Modal.renderExportForm(),
            bind: () => Modal.bindExportEvents()
        },
        feeSettings: {
            title: '交易费率设置',
            render: (data) => Modal.renderFeeSettingsForm(data),
            bind: (data) => Modal.bindFeeSettingsEvents(data)
        },
        verifyResult: {
            title: '验证计算',
            render: (data) => Modal.renderVerifyResultForm(data),
            bind: (data) => Modal.bindVerifyResultEvents(data)
        },
        settings: {
            title: '⚙️ 设置',
            render: () => Modal.renderSettingsForm(),
            bind: () => Modal.bindSettingsEvents()
        },
        editFund: {
            title: '✏️ 编辑基金',
            render: (data) => Modal.renderEditFundForm(data),
            bind: (data) => Modal.bindEditFundEvents(data)
        },
        syncTools: {
            title: '☁️ 云同步详情',
            render: () => window.SyncStatusPresenter.buildSyncToolsModalBody(window.SyncAppService.getSyncStatus()),
            bind: () => window.SyncStatusPresenter.bindSyncToolsModalEvents()
        }
    },

    show(type, data = {}) {
        Modal.currentType = type;

        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');
        const config = Modal.modalConfigs[type];

        container.className = 'modal-container';
        if (type) {
            const className = 'modal-' + type.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/--/g, '-');
            container.classList.add(className);
        }

        if (!config) {
            console.error('Unknown modal type:', type);
            return;
        }

        title.textContent = config.title;
        const result = config.render(data);

        if (typeof result === 'object' && result.content !== undefined) {
            body.innerHTML = result.content;
            footer.innerHTML = result.actions || '';
        } else {
            body.innerHTML = result;
            footer.innerHTML = '';
        }

        container.classList.remove('hidden');
        body.scrollTop = 0;

        if (config.bind) {
            config.bind(data);
        }

        EventBus.emit(EventType.MODAL_OPENED, { type, data });
    },

    hide() {
        const container = document.getElementById('modal-container');
        container.classList.add('hidden');
        Modal.currentType = null;
        EventBus.emit(EventType.MODAL_CLOSED);
    },

    showSyncConflict(syncResult) {
        if (window.SyncConflictModalHelper && typeof window.SyncConflictModalHelper.show === 'function') {
            window.SyncConflictModalHelper.show(syncResult.conflicts || [], async (resolutions) => {
                await window.SyncAppService.resolveConflicts(syncResult.conflicts || [], resolutions);
            });
            return;
        }

        Modal.show('syncConflict', syncResult);
    },

    /**
     * 渲染基金名称字段HTML（公共方法）
     * @param {object} options - 配置选项
     * @param {string} options.idPrefix - ID前缀
     * @param {string} options.label - 标签文本
     * @param {string} options.placeholder - 占位符
     * @param {string} options.value - 当前值
     * @param {string} options.source - 来源(api/cache/manual)
     * @param {string} options.updateTime - 更新时间
     * @param {boolean} options.disabled - 是否禁用
     * @returns {string} HTML字符串
     */
    renderFundNameFieldHtml(options) {
        const {
            idPrefix = 'name',
            label = '基金名称',
            placeholder = '输入代码后自动获取',
            value = '',
            source = '',
            updateTime = '',
            disabled = false
        } = options;

        const prefix = idPrefix ? idPrefix + '-' : '';

        const sourceText = source === 'api' ? 'API获取' :
            source === 'cache' ? '缓存' :
                source === 'manual' ? '手动修改' : '等待获取';
        const sourceClass = source === 'api' ? 'form-name-source-badge--api' :
            source === 'cache' ? 'form-name-source-badge--cache' :
                source === 'manual' ? 'form-name-source-badge--manual' : '';

        const timeInfo = updateTime ? `<span class="form-name-status">更新时间: ${updateTime.slice(0, 10)}</span>` : '';
        const statusId = prefix ? prefix + 'name-status' : 'name-status';
        const statusSpan = idPrefix === 'edit' ? '' : `<span class="form-name-status" id="${statusId}"></span>`;

        return `
            <div class="form-group">
                <label class="form-label">${label}</label>
                <div class="form-name-preview">
                    <input type="text" id="input-${prefix}fund-name" class="form-input form-name-preview-input"
                           value="${value}" placeholder="${placeholder}" ${disabled ? 'disabled' : ''}>
                    <button class="btn btn-secondary form-name-preview-refresh" id="btn-${prefix}refresh-name"
                            data-tooltip="清除缓存并重新获取" ${disabled ? 'disabled' : ''}>🔄</button>
                </div>
                <div class="form-name-source" id="${prefix}name-source-info">
                    <span class="form-name-source-badge ${sourceClass}" id="${prefix}name-source-badge">${sourceText}</span>
                    ${timeInfo}
                    ${statusSpan}
                </div>
            </div>
        `;
    },

    /**
     * 设置基金名称字段事件（公共方法）
     * @param {object} options - 配置选项
     * @param {string} options.idPrefix - ID前缀
     * @param {string} options.fundCode - 基金代码(添加时需要，编辑时可选)
     * @param {function} options.onCodeChange - 代码变化回调
     * @param {function} options.onNameChange - 名称变化回调
     * @param {function} options.onRefresh - 刷新回调
     * @returns {object} { currentCode, currentName, currentSource }
     */
    setupFundNameField(options) {
        const {
            idPrefix,
            fundCode: initialCode = '',
            onCodeChange,
            onNameChange,
            onRefresh
        } = options;

        const prefix = idPrefix ? idPrefix + '-' : '';

        const inputName = document.getElementById(`input-${prefix}fund-name`);
        const btnRefresh = document.getElementById(`btn-${prefix}refresh-name`);
        const sourceBadge = document.getElementById(`${prefix}name-source-badge`);
        const statusSpan = document.getElementById(`${prefix}name-status`);

        let currentCode = initialCode;
        let currentName = '';
        let currentSource = '';

        const updateNameUI = function(name, source, isGarbled) {
            if (inputName) inputName.value = name || '';
            currentName = name || '';
            currentSource = source || '';

            if (sourceBadge) {
                sourceBadge.textContent = source === 'api' ? 'API获取' :
                    source === 'cache' ? '缓存' :
                        source === 'manual' ? '手动修改' : '等待获取';
                sourceBadge.className = 'form-name-source-badge';
                if (source === 'api') sourceBadge.classList.add('form-name-source-badge--api');
                else if (source === 'cache') sourceBadge.classList.add('form-name-source-badge--cache');
                else if (source === 'manual') sourceBadge.classList.add('form-name-source-badge--manual');
            }

            if (statusSpan) {
                if (isGarbled) {
                    statusSpan.textContent = '⚠️ 可能是乱码';
                    statusSpan.className = 'form-name-status form-name-status--garbled';
                    if (inputName) inputName.style.borderColor = 'var(--color-warning)';
                } else if (name) {
                    statusSpan.textContent = '✓ 名称有效';
                    statusSpan.className = 'form-name-status form-name-status--valid';
                    if (inputName) inputName.style.borderColor = '';
                } else {
                    statusSpan.textContent = '';
                    if (inputName) inputName.style.borderColor = '';
                }
            }
        };

        const fetchName = async function(code, forceRefresh = false) {
            if (!code || !Utils.isValidFundCode(code)) {
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
            }
        };

        if (onCodeChange) {
            let debounceTimer = null;
            onCodeChange((code) => {
                currentCode = code;
                if (debounceTimer) clearTimeout(debounceTimer);
                if (!code || !Utils.isValidFundCode(code)) {
                    updateNameUI('', '', false);
                    return;
                }
                debounceTimer = setTimeout(() => fetchName(code, false), 500);
            });
        }

        if (inputName) {
            inputName.addEventListener('input', function() {
                const name = inputName.value.trim();
                if (name !== currentName) {
                    const validation = NameValidator.detectGarbled(name);
                    updateNameUI(name, 'manual', validation.isGarbled);
                    if (onNameChange) {
                        onNameChange(name, currentCode);
                    }
                }
            });
        }

        if (btnRefresh) {
            btnRefresh.addEventListener('click', async function() {
                if (!currentCode) return;

                btnRefresh.disabled = true;
                btnRefresh.textContent = '...';

                await fetchName(currentCode, true);

                btnRefresh.disabled = false;
                btnRefresh.textContent = '🔄';

                if (onRefresh) {
                    onRefresh(currentCode, currentName, currentSource);
                }
                EventBus.emit(EventType.NAME_REFRESH_REQUESTED, { code: currentCode });
            });
        }

        if (initialCode && Utils.isValidFundCode(initialCode)) {
            fetchName(initialCode, false);
        }

        return { currentCode, currentName, currentSource, updateNameUI, fetchName };
    },

    renderAddFundForm() {
        return {
            content: '<div class="form-group">' +
                '<label class="form-label">基金代码 *</label>' +
                '<input type="text" id="input-fund-code" class="form-input" placeholder="请输入6位基金代码" maxlength="6">' +
                '<div id="error-fund-code" class="form-error"></div>' +
                '</div>' +
                Modal.renderFundNameFieldHtml({
                    idPrefix: '',
                    label: '基金名称',
                    placeholder: '输入代码后自动获取'
                }) +
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

        const updateNameUI = function(name, source, isGarbled) {
            inputName.value = name || '';
            currentName = name || '';

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
        return window.TradeModalHelper.renderTradeFormSections(data);
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

        const bindImportAmountButton = () => {
            const importAmountBtn = hintAmount.querySelector('.btn-import-amount');
            if (importAmountBtn && autoCalcAmount !== null) {
                importAmountBtn.addEventListener('click', () => {
                    amount.value = autoCalcAmount.toFixed(2);
                    hintAmount.classList.remove('form-hint-warn');
                    amount.classList.remove('form-input-mismatch');
                });
            }
        };

        const calcAmount = (skipSetValue = false) => {
            const nv = parseFloat(netValue.value);
            const s = parseFloat(shares.value);
            const f = parseFloat(fee.value) || 0;
            const type = tradeType.value;
            const result = window.TradeModalHelper.calculateAutoAmount(nv, s, f, type);

            autoCalcAmount = result.amount;

            if (autoCalcAmount !== null) {
                if (!skipSetValue) {
                    amount.value = autoCalcAmount.toFixed(2);
                }
                const tradeTypeLabel = type === 'buy' ? '买入' : type === 'sell' ? '卖出' : '';
                hintAmount.innerHTML = window.TradeModalHelper.buildAmountHintHtml(autoCalcAmount, tradeTypeLabel);
                hintAmount.classList.remove('form-hint-warn');
                amount.classList.remove('form-input-mismatch');
                bindImportAmountButton();
            } else {
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
                const tradeTypeLabel = type === 'buy' ? '买入' : type === 'sell' ? '卖出' : '';
                hintAmount.innerHTML = window.TradeModalHelper.buildAmountHintHtml(autoCalcAmount, tradeTypeLabel);
                hintAmount.classList.remove('form-hint-warn');
                amount.classList.remove('form-input-mismatch');

                const importAmountBtn = hintAmount.querySelector('.btn-import-amount');
                if (importAmountBtn) {
                    importAmountBtn.addEventListener('click', () => {
                        amount.value = autoCalcAmount.toFixed(2);
                        checkMismatch();
                    });
                }
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

        // 费率自动计算
        let isFeeAutoCalculated = false;
        const resetFeeSuggestion = () => {
            const panel = document.getElementById('fee-suggestion-panel');
            if (panel) {
                panel.classList.add('hidden');
                panel.innerHTML = '';
            }
        };

        const autoCalcFee = () => {
            const fundId = data.fundId || (data.trade && data.trade.fundId);
            if (!fundId) return;

            const fund = FundManager.getFund(fundId);
            const settings = Storage.loadSettings() || {};
            const effectiveFeeTiers = window.TradeModalHelper.getEffectiveFeeTiers(fund, settings);
            resetFeeSuggestion();
            const type = tradeType.value;
            const nv = parseFloat(netValue.value);
            const s = parseFloat(shares.value);
            const dateVal = document.getElementById('input-trade-date').value;

            const hasBuyTiers = effectiveFeeTiers.buyTiers && effectiveFeeTiers.buyTiers.length > 0;
            const hasSellTiers = effectiveFeeTiers.sellTiers && effectiveFeeTiers.sellTiers.length > 0;

            // 优先使用基金费率
            if (type === 'buy' && nv > 0 && s > 0 && hasBuyTiers) {
                const amountVal = nv * s;
                const result = FeeCalculator.calculateBuyFee(amountVal, effectiveFeeTiers.buyTiers);

                const panel = document.getElementById('fee-suggestion-panel');
                if (result.matchedTier && panel) {
                    panel.classList.remove('hidden');
                    panel.innerHTML =
                        '<div class="fee-suggestion-content">' +
                            '<div class="fee-suggestion-title">费率参考</div>' +
                            '<div class="fee-suggestion-body">' +
                                '金额 ' + Utils.formatMoney(amountVal) + '，匹配买入费率 <strong>' + result.rate + '%</strong>' +
                            '</div>' +
                            '<div class="fee-suggestion-fee">' +
                                '建议手续费：¥' + result.fee.toFixed(2) +
                                ' <button type="button" class="btn btn-primary btn-xs btn-import-fee" data-fee="' + result.fee.toFixed(2) + '">导入</button>' +
                            '</div>' +
                        '</div>';

                    const importBtn = panel.querySelector('.btn-import-fee');
                    if (importBtn) {
                        importBtn.addEventListener('click', () => {
                            fee.value = result.fee.toFixed(2);
                            isFeeAutoCalculated = false;
                            calcAmount();
                        });
                    }

                    if (result.fee > 0 && !isFeeAutoCalculated) {
                        fee.value = result.fee.toFixed(2);
                        isFeeAutoCalculated = true;
                        calcAmount();
                        checkMismatch();
                    }
                }
            } else if (type === 'buy' && nv > 0 && s > 0 && !hasBuyTiers) {
                const panel = document.getElementById('fee-suggestion-panel');
                if (panel) panel.classList.add('hidden');
            } else if (type === 'sell' && nv > 0 && s > 0 && dateVal && hasSellTiers) {
                const allTrades = TradeManager.getTradesByFund(fundId);
                const sellTrade = { date: dateVal, shares: s, netValue: nv, id: data.trade ? data.trade.id : null };
                const result = FeeCalculator.calculateSellFee(sellTrade, allTrades, effectiveFeeTiers.sellTiers);

                const panel = document.getElementById('fee-suggestion-panel');
                if (result.details.length > 0 && panel) {
                    let detailHtml = '';
                    result.details.forEach(d => {
                        detailHtml += '<div>从' + d.fromDate + '买入的' + d.originalBuyShares.toFixed(2) + '份中卖出' + d.shares.toFixed(2) + '份，持有' + d.days + '天，费率' + d.rate + '%，手续费¥' + d.fee.toFixed(2) + '</div>';
                    });

                    panel.classList.remove('hidden');
                    panel.innerHTML =
                        '<div class="fee-suggestion-content">' +
                            '<div class="fee-suggestion-title">费率参考（FIFO）</div>' +
                            '<div class="fee-suggestion-body">' + detailHtml + '</div>' +
                            '<div class="fee-suggestion-fee">' +
                                '合计手续费：¥' + result.fee.toFixed(2) +
                                ' <button type="button" class="btn btn-primary btn-xs btn-import-fee" data-fee="' + result.fee.toFixed(2) + '">导入</button>' +
                            '</div>' +
                        '</div>';

                    const importBtn = panel.querySelector('.btn-import-fee');
                    if (importBtn) {
                        importBtn.addEventListener('click', () => {
                            fee.value = result.fee.toFixed(2);
                            isFeeAutoCalculated = false;
                            calcAmount();
                        });
                    }

                    if (result.fee > 0 && !isFeeAutoCalculated) {
                        fee.value = result.fee.toFixed(2);
                        isFeeAutoCalculated = true;
                        calcAmount();
                        checkMismatch();
                    }
                }
            } else if (type === 'sell' && nv > 0 && s > 0 && dateVal && !hasSellTiers) {
                const panel = document.getElementById('fee-suggestion-panel');
                if (panel) panel.classList.add('hidden');
            } else {
                const panel = document.getElementById('fee-suggestion-panel');
                if (panel) panel.classList.add('hidden');
            }
        };

        netValue.addEventListener('input', autoCalcFee);
        shares.addEventListener('input', autoCalcFee);
        tradeType.addEventListener('change', () => {
            isFeeAutoCalculated = false;
            fee.value = '0';
            resetFeeSuggestion();
            updateFieldsVisibility();
            autoCalcFee();
            calcAmount();
            checkMismatch();
        });
        document.getElementById('input-trade-date').addEventListener('change', autoCalcFee);

        fee.addEventListener('input', () => {
            isFeeAutoCalculated = false;
            calcAmount();
        });

        if (isEdit) {
            setTimeout(autoCalcFee, 100);
            setTimeout(() => {
                calcAmount(true);
                checkMismatch();
            }, 100);
        }

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

            if (!fileInput.files || fileInput.files.length === 0) {
                Utils.showToast('请选择文件', 'error');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // 先分析导入数据
                    const analysis = window.ImportAppService.analyzeImportData(data);

                    if (!analysis.success) {
                        Utils.showToast('数据分析失败: ' + analysis.reason, 'error');
                        return;
                    }

                    // 显示预览
                    ImportPreviewHelper.show(analysis);

                    // 隐藏导入弹窗
                    Modal.hide();
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
    },

    /**
     * 渲染验证计算结果弹窗
     */
    renderVerifyResultForm(data) {
        const fundId = data.fundId;
        const result = FIFOValidator.getDetailedResult(fundId);

        if (!result || !result.success) {
            return '<p>验证失败</p>';
        }

        const fund = result.fund;
        const trades = result.trades || [];
        const fifo = result.fifo;
        const weighted = result.weighted;
        const consistent = result.consistent;
        const diffs = result.differences || [];

        let diffHtml = '';
        if (!consistent && diffs.length > 0) {
            diffHtml = '<div class="verify-diff-list"><h4>差异项：</h4>';
            for (const d of diffs) {
                const diffClass = 'verify-diff-' + (d.diff > FIFOValidator.TOLERANCE ? 'fail' : 'warn');
                diffHtml += `<div class="verify-diff-item ${diffClass}">
                    <span class="verify-diff-name">${d.name}</span>
                    <span class="verify-diff-fifo">FIFO: ${Utils.formatMoneySmart(d.fifo)}</span>
                    <span class="verify-diff-weighted">加权: ${Utils.formatMoneySmart(d.weighted)}</span>
                    <span class="verify-diff-value">差异: ${Utils.formatMoneySmart(d.diff)}</span>
                </div>`;
            }
            diffHtml += '</div>';
        }

        const statusClass = consistent ? 'verify-success' : 'verify-fail';
        const statusText = consistent ? '✅ 验证通过' : '❌ 结果不一致';

        const content = `
            <div class="verify-result-modal">
                <div class="verify-status ${statusClass}">${statusText}</div>
                <div class="verify-summary">
                    <p>基金：${fund.name} (${fund.code})</p>
                    <p>交易记录：${trades.length} 笔</p>
                </div>
                <div class="verify-comparison">
                    <table class="verify-table">
                        <thead>
                            <tr>
                                <th>指标</th>
                                <th>FIFO</th>
                                <th>移动加权</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>总收益</td>
                                <td>${Utils.formatMoneySmart(fifo.totalProfit || 0)}</td>
                                <td>${Utils.formatMoneySmart(weighted.totalProfit || 0)}</td>
                            </tr>
                            <tr>
                                <td>已实现收益</td>
                                <td>${Utils.formatMoneySmart(fifo.realizedProfit || 0)}</td>
                                <td>${Utils.formatMoneySmart(weighted.realizedProfit || 0)}</td>
                            </tr>
                            <tr>
                                <td>浮动收益</td>
                                <td>${Utils.formatMoneySmart(fifo.floatingProfit || 0)}</td>
                                <td>${Utils.formatMoneySmart(weighted.floatingProfit || 0)}</td>
                            </tr>
                            <tr>
                                <td>持仓成本</td>
                                <td>${Utils.formatMoneySmart(fifo.holdingCost || 0)}</td>
                                <td>${Utils.formatMoneySmart(weighted.holdingCost || 0)}</td>
                            </tr>
                            <tr>
                                <td>持有份额</td>
                                <td>${(fifo.holdingShares || 0).toFixed(4)}</td>
                                <td>${(weighted.holdingShares || 0).toFixed(4)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                ${diffHtml}
            </div>
        `;

        const actions = '<button type="button" class="btn btn-secondary" id="btn-close-verify-modal">关闭</button>';

        return { content, actions };
    },

    /**
     * 绑定验证结果弹窗事件
     */
    bindVerifyResultEvents(_data) {
        const btnClose = document.getElementById('btn-close-verify-modal');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                Modal.hide();
            });
        }
    },

    /**
     * 渲染费率设置弹窗
     */
    renderFeeSettingsForm(data) {
        const fundId = data.fundId;
        const fund = DataService.getFund(fundId);
        const feeTiers = fund.feeTiers || { buyTiers: [], sellTiers: [] };

        let buyListHtml = '';
        (feeTiers.buyTiers || []).forEach((tier, index) => {
            buyListHtml += Modal.renderTierRow('buy', index, tier);
        });

        let sellListHtml = '';
        (feeTiers.sellTiers || []).forEach((tier, index) => {
            sellListHtml += Modal.renderTierRow('sell', index, tier);
        });

        const content = `
            <div class="fee-settings-modal">
                <div class="fee-tiers-grid">
                    <div class="fee-tier-group">
                        <div class="fee-tier-group-header">
                            <h4>买入费率（按金额区间）</h4>
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-buy-tier-modal">+ 添加费率段</button>
                        </div>
                        <div class="fee-tier-list" id="buy-tier-list-modal">${buyListHtml}</div>
                    </div>
                    <div class="fee-tier-group">
                        <div class="fee-tier-group-header">
                            <h4>卖出费率（按持有天数）</h4>
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-sell-tier-modal">+ 添加费率段</button>
                        </div>
                        <div class="fee-tier-list" id="sell-tier-list-modal">${sellListHtml}</div>
                    </div>
                </div>
            </div>
        `;

        const actions = `
            <button type="button" class="btn btn-primary" id="btn-save-fee-modal">保存</button>
            <button type="button" class="btn btn-secondary" id="btn-cancel-fee-modal">取消</button>
        `;

        return { content, actions };
    },

    /**
     * 渲染费率段行
     */
    renderTierRow(type, index, tier) {
        if (type === 'buy') {
            return `
                <div class="fee-tier-row" data-index="${index}">
                    <div class="fee-tier-row-inner">
                        <div class="tier-field">
                            <div class="tier-input-group">
                                <input type="number" class="form-input tier-min-amount tier-amount-input" value="${((tier.minAmount || 0) / 10000)}" step="0.1" min="0" placeholder="最低">
                                <span class="tier-sep">~</span>
                                <input type="number" class="form-input tier-max-amount tier-amount-input" value="${tier.maxAmount !== null && tier.maxAmount !== undefined ? (tier.maxAmount / 10000) : ''}" step="0.1" min="0" placeholder="无上限">
                                <span class="tier-unit">万元</span>
                            </div>
                        </div>
                        <div class="tier-field">
                            <input type="number" class="form-input tier-rate" value="${tier.rate || 0}" step="0.01" min="0">
                            <span class="tier-rate-suffix">%</span>
                        </div>
                        <button type="button" class="btn-remove-tier" data-type="buy" data-index="${index}">×</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="fee-tier-row" data-index="${index}">
                    <div class="fee-tier-row-inner">
                        <div class="tier-field">
                            <div class="sell-days-inline">
                                <span class="range-label">[</span>
                                <input type="number" class="form-input tier-min-days tier-days-input" value="${tier.minDays || 0}" step="1" min="0">
                                <span class="range-label">) ~ (</span>
                                <input type="number" class="form-input tier-max-days tier-days-input" value="${tier.maxDays !== null && tier.maxDays !== undefined ? tier.maxDays : ''}" step="1" min="0" placeholder="∞">
                                <span class="range-label">)</span>
                            </div>
                        </div>
                        <div class="tier-field">
                            <input type="number" class="form-input tier-rate" value="${tier.rate || 0}" step="0.01" min="0">
                            <span class="tier-rate-suffix">%</span>
                        </div>
                        <button type="button" class="btn-remove-tier" data-type="sell" data-index="${index}">×</button>
                    </div>
                </div>
            `;
        }
    },

    /**
     * 绑定费率设置弹窗事件
     */
    bindFeeSettingsEvents(data) {
        const fundId = data.fundId;
        const fund = DataService.getFund(fundId);

        // 首次打开时，如果基金未配置费率，用"设置→交易默认"填充
        const settings = Storage.loadSettings();
        const hasBuyTiers = fund.feeTiers && fund.feeTiers.buyTiers && fund.feeTiers.buyTiers.length > 0;
        const hasSellTiers = fund.feeTiers && fund.feeTiers.sellTiers && fund.feeTiers.sellTiers.length > 0;

        let needSave = false;

        if (!hasBuyTiers && settings.defaultBuyFeeRate > 0) {
            if (!fund.feeTiers) fund.feeTiers = { buyTiers: [], sellTiers: [] };
            fund.feeTiers.buyTiers = [{
                minAmount: 0,
                maxAmount: 1000000,
                rate: settings.defaultBuyFeeRate
            }];
            needSave = true;
        }

        if (!hasSellTiers && settings.defaultSellFeeRate > 0) {
            if (!fund.feeTiers) fund.feeTiers = { buyTiers: [], sellTiers: [] };
            fund.feeTiers.sellTiers = [{
                minDays: 0,
                maxDays: 7,
                rate: settings.defaultSellFeeRate
            }];
            needSave = true;
        }

        if (needSave) {
            FundManager.updateFund(fund.id, fund);
            // 重新渲染弹窗内容以显示填充的值
            Modal.show('feeSettings', { fundId: fundId });
            Modal.bindFeeSettingsEvents({ fundId: fundId });
            return;
        }

        // 添加买入费率段
        const btnAddBuy = document.getElementById('btn-add-buy-tier-modal');
        if (btnAddBuy) {
            btnAddBuy.addEventListener('click', () => {
                Modal.addTierInModal('buy');
            });
        }

        // 添加卖出费率段
        const btnAddSell = document.getElementById('btn-add-sell-tier-modal');
        if (btnAddSell) {
            btnAddSell.addEventListener('click', () => {
                Modal.addTierInModal('sell');
            });
        }

        // 保存
        const btnSave = document.getElementById('btn-save-fee-modal');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                Modal.saveFeeSettings(fundId);
            });
        }

        // 取消
        const btnCancel = document.getElementById('btn-cancel-fee-modal');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                Modal.hide();
            });
        }

        // 删除费率段（事件委托）
        const buyList = document.getElementById('buy-tier-list-modal');
        if (buyList) {
            buyList.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-tier')) {
                    e.target.closest('.fee-tier-row').remove();
                    Modal.reindexTiers('buy');
                }
            });
        }

        const sellList = document.getElementById('sell-tier-list-modal');
        if (sellList) {
            sellList.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-tier')) {
                    e.target.closest('.fee-tier-row').remove();
                    Modal.reindexTiers('sell');
                }
            });
        }
    },

    /**
     * 在弹窗中添加费率段
     */
    addTierInModal(type) {
        const listId = type === 'buy' ? 'buy-tier-list-modal' : 'sell-tier-list-modal';
        const list = document.getElementById(listId);
        if (!list) return;

        const index = list.children.length;
        const tier = type === 'buy'
            ? { minAmount: 0, maxAmount: null, rate: 0 }
            : { minDays: 0, maxDays: null, rate: 0 };

        list.insertAdjacentHTML('beforeend', Modal.renderTierRow(type, index, tier));
    },

    /**
     * 重新索引费率段
     */
    reindexTiers(type) {
        const listId = type === 'buy' ? 'buy-tier-list-modal' : 'sell-tier-list-modal';
        const list = document.getElementById(listId);
        if (!list) return;

        list.querySelectorAll('.fee-tier-row').forEach((row, index) => {
            row.dataset.index = index;
            const btn = row.querySelector('.btn-remove-tier');
            if (btn) btn.dataset.index = index;
        });
    },

    /**
     * 从弹窗收集费率数据
     */
    collectFeeTiersFromModal() {
        const buyList = document.getElementById('buy-tier-list-modal');
        const sellList = document.getElementById('sell-tier-list-modal');

        const buyTiers = [];
        if (buyList) {
            buyList.querySelectorAll('.fee-tier-row').forEach(row => {
                buyTiers.push({
                    minAmount: (parseFloat(row.querySelector('.tier-min-amount').value) || 0) * 10000,
                    maxAmount: row.querySelector('.tier-max-amount').value ? parseFloat(row.querySelector('.tier-max-amount').value) * 10000 : null,
                    rate: parseFloat(row.querySelector('.tier-rate').value) || 0
                });
            });
        }

        const sellTiers = [];
        if (sellList) {
            sellList.querySelectorAll('.fee-tier-row').forEach(row => {
                sellTiers.push({
                    minDays: parseInt(row.querySelector('.tier-min-days').value) || 0,
                    maxDays: row.querySelector('.tier-max-days').value ? parseInt(row.querySelector('.tier-max-days').value) : null,
                    rate: parseFloat(row.querySelector('.tier-rate').value) || 0
                });
            });
        }

        return { buyTiers, sellTiers };
    },

    /**
     * 保存费率设置
     */
    saveFeeSettings(fundId) {
        const feeTiers = Modal.collectFeeTiersFromModal();
        const fund = FundManager.getFund(fundId);
        if (!fund) return;

        // 验证
        for (let i = 0; i < feeTiers.buyTiers.length; i++) {
            const tier = feeTiers.buyTiers[i];
            if (tier.maxAmount !== null && tier.maxAmount <= tier.minAmount) {
                Utils.showToast('买入费率第' + (i + 1) + '段：最高金额必须大于最低金额', 'error');
                return;
            }
        }

        for (let i = 0; i < feeTiers.sellTiers.length; i++) {
            const tier = feeTiers.sellTiers[i];
            if (tier.maxDays !== null && tier.maxDays <= tier.minDays) {
                Utils.showToast('卖出费率第' + (i + 1) + '段：最高天数必须大于最低天数', 'error');
                return;
            }
        }

        const success = FundManager.updateFund(fundId, { feeTiers });
        if (success) {
            Utils.showToast('费率配置已保存', 'success');
            Modal.hide();
        }
    },

    /**
     * 渲染设置表单
     */
    renderSettingsForm() {
        const settings = window.AppSettingsService.loadSettings() || {};
        const defaults = {
            bigNumberEnabled: true,
            bigNumberWanThreshold: 10000,
            bigNumberYiThreshold: 100000000,
            defaultBuyFeeRate: 0,
            defaultSellFeeRate: 0,
            defaultDividendMode: 'cash',
            defaultViewMode: 'card',
            defaultSortField: 'profitRate',
            defaultSortOrder: 'desc',
            defaultPageSize: 10
        };
        const s = { ...defaults, ...settings };

        const content = `
            <div class="settings-modal">
                <div class="settings-tabs-nav">
                    <button class="settings-tab-btn active" data-tab="number">数字显示</button>
                    <button class="settings-tab-btn" data-tab="trade">交易默认</button>
                    <button class="settings-tab-btn" data-tab="dividend">分红设置</button>
                    <button class="settings-tab-btn" data-tab="display">显示设置</button>
                    <button class="settings-tab-btn" data-tab="data">数据管理</button>
                </div>
                <div class="settings-tabs-content">
                    <!-- 数字显示 -->
                    <div class="settings-tab-panel active" data-panel="number">
                        <div class="settings-group">
                            <div class="settings-label-row">
                                <span class="settings-label">大数字转换</span>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-big-number-enabled" ${s.bigNumberEnabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-desc">超过阈值自动转换为"万"/"亿"单位显示</div>
                        </div>
                        <div class="settings-group">
                            <div class="settings-label">万级阈值</div>
                            <div class="settings-input-group">
                                <input type="number" class="settings-input" id="settings-wan-threshold" value="${s.bigNumberWanThreshold}">
                                <span class="input-suffix">元</span>
                            </div>
                        </div>
                        <div class="settings-group">
                            <div class="settings-label">亿级阈值</div>
                            <div class="settings-input-group">
                                <input type="number" class="settings-input" id="settings-yi-threshold" value="${s.bigNumberYiThreshold}">
                                <span class="input-suffix">元</span>
                            </div>
                        </div>
                    </div>
                    <!-- 交易默认 -->
                    <div class="settings-tab-panel" data-panel="trade">
                        <div class="settings-group">
                            <div class="settings-label">默认买入费率</div>
                            <div class="settings-tier-row">
                                <span class="tier-interval-fixed">0 ~ 100 万元</span>
                                <input type="number" class="settings-input" id="settings-default-buy-rate" value="${s.defaultBuyFeeRate}" step="0.01">
                                <span class="input-suffix">%</span>
                            </div>
                            <div class="settings-desc">区间固定为 0~100 万元，更多区间请到交易费率设置</div>
                        </div>
                        <div class="settings-group">
                            <div class="settings-label">默认卖出费率</div>
                            <div class="settings-tier-row">
                                <span class="tier-interval-fixed">0 ~ 7 天</span>
                                <input type="number" class="settings-input" id="settings-default-sell-rate" value="${s.defaultSellFeeRate}" step="0.01">
                                <span class="input-suffix">%</span>
                            </div>
                            <div class="settings-desc">区间固定为 0~7 天，更多区间请到交易费率设置</div>
                        </div>
                    </div>
                    <!-- 分红设置 -->
                    <div class="settings-tab-panel" data-panel="dividend">
                        <div class="settings-group">
                            <div class="settings-label">默认分红方式</div>
                            <div class="settings-radio-group">
                                <label class="settings-radio-item">
                                    <input type="radio" name="settings-dividend-mode" value="cash" ${s.defaultDividendMode === 'cash' ? 'checked' : ''}>
                                    <span class="radio-circle"></span>
                                    <span class="radio-label">现金分红</span>
                                </label>
                                <label class="settings-radio-item">
                                    <input type="radio" name="settings-dividend-mode" value="reinvest" ${s.defaultDividendMode === 'reinvest' ? 'checked' : ''}>
                                    <span class="radio-circle"></span>
                                    <span class="radio-label">红利再投</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <!-- 显示设置 -->
                    <div class="settings-tab-panel" data-panel="display">
                        <div class="settings-group">
                            <div class="settings-label">默认视图模式</div>
                            <select class="settings-select" id="settings-view-mode">
                                <option value="card" ${s.defaultViewMode === 'card' ? 'selected' : ''}>卡片视图</option>
                                <option value="list" ${s.defaultViewMode === 'list' ? 'selected' : ''}>列表视图</option>
                            </select>
                        </div>
                        <div class="settings-group">
                            <div class="settings-label">默认排序字段</div>
                            <select class="settings-select" id="settings-sort-field">
                                <option value="profitRate" ${s.defaultSortField === 'profitRate' ? 'selected' : ''}>收益率</option>
                                <option value="marketValue" ${s.defaultSortField === 'marketValue' ? 'selected' : ''}>市值</option>
                                <option value="fundCode" ${s.defaultSortField === 'fundCode' ? 'selected' : ''}>基金代码</option>
                                <option value="investAmount" ${s.defaultSortField === 'investAmount' ? 'selected' : ''}>投入金额</option>
                            </select>
                        </div>
                        <div class="settings-group">
                            <div class="settings-label">排序方向</div>
                            <div class="settings-radio-group">
                                <label class="settings-radio-item">
                                    <input type="radio" name="settings-sort-order" value="asc" ${s.defaultSortOrder === 'asc' ? 'checked' : ''}>
                                    <span class="radio-circle"></span>
                                    <span class="radio-label">升序</span>
                                </label>
                                <label class="settings-radio-item">
                                    <input type="radio" name="settings-sort-order" value="desc" ${s.defaultSortOrder === 'desc' ? 'checked' : ''}>
                                    <span class="radio-circle"></span>
                                    <span class="radio-label">降序</span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-group">
                            <div class="settings-label">每页显示条数</div>
                            <select class="settings-select" id="settings-page-size">
                                <option value="10" ${s.defaultPageSize === 10 ? 'selected' : ''}>10条</option>
                                <option value="20" ${s.defaultPageSize === 20 ? 'selected' : ''}>20条</option>
                                <option value="50" ${s.defaultPageSize === 50 ? 'selected' : ''}>50条</option>
                            </select>
                        </div>
                    </div>
                    <!-- 数据管理 -->
                    <div class="settings-tab-panel" data-panel="data">
                        <div class="settings-data-buttons">
                            <button class="settings-data-btn" id="btn-settings-export">
                                <div class="data-btn-icon">📤</div>
                                <div class="data-btn-text">
                                    <div class="data-btn-title">导出数据</div>
                                    <div class="data-btn-desc">下载所有基金和交易记录为JSON文件</div>
                                </div>
                            </button>
                            <button class="settings-data-btn" id="btn-settings-import">
                                <div class="data-btn-icon">📥</div>
                                <div class="data-btn-text">
                                    <div class="data-btn-title">导入数据</div>
                                    <div class="data-btn-desc">从JSON文件导入数据（支持合并/覆盖）</div>
                                </div>
                            </button>
                            <button class="settings-data-btn settings-data-btn-danger" id="btn-settings-clear">
                                <div class="data-btn-icon">🗑️</div>
                                <div class="data-btn-text">
                                    <div class="data-btn-title">清除所有数据</div>
                                    <div class="data-btn-desc">删除所有基金和交易记录，此操作不可恢复</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return {
            content: content,
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                     '<button class="btn btn-primary" id="btn-save-settings">保存设置</button>'
        };
    },

    /**
     * 绑定设置弹窗事件
     */
    bindSettingsEvents() {
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.settings-tab-panel').forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                const tabId = this.dataset.tab;
                document.querySelector(`.settings-tab-panel[data-panel="${tabId}"]`).classList.add('active');
            });
        });

        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const settings = {
                    bigNumberEnabled: document.getElementById('settings-big-number-enabled')?.checked ?? true,
                    bigNumberWanThreshold: parseInt(document.getElementById('settings-wan-threshold')?.value) || 10000,
                    bigNumberYiThreshold: parseInt(document.getElementById('settings-yi-threshold')?.value) || 100000000,
                    defaultBuyFeeRate: parseFloat(document.getElementById('settings-default-buy-rate')?.value) || 0,
                    defaultSellFeeRate: parseFloat(document.getElementById('settings-default-sell-rate')?.value) || 0,
                    defaultDividendMode: document.querySelector('input[name="settings-dividend-mode"]:checked')?.value || 'cash',
                    defaultViewMode: document.getElementById('settings-view-mode')?.value || 'card',
                    defaultSortField: document.getElementById('settings-sort-field')?.value || 'profitRate',
                    defaultSortOrder: document.querySelector('input[name="settings-sort-order"]:checked')?.value || 'desc',
                    defaultPageSize: parseInt(document.getElementById('settings-page-size')?.value) || 10
                };
                window.AppSettingsService.saveSettings(settings);
                Modal.hide();
                Utils.showToast('设置已保存');
                EventBus.emit(EventType.SETTINGS_CHANGED, settings);
            });
        }

        const btnExport = document.getElementById('btn-settings-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                const data = window.AppSettingsService.exportData();
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `基金计算器数据_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                Utils.showToast('数据导出成功');
            });
        }

        const btnImport = document.getElementById('btn-settings-import');
        if (btnImport) {
            btnImport.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        const result = await window.AppSettingsService.importData(data, false);
                        if (result && result.success) {
                            Utils.showToast('数据导入成功');
                        } else {
                            Utils.showToast('数据格式错误', 'error');
                        }
                    } catch (err) {
                        Utils.showToast('导入失败: ' + err.message, 'error');
                    }
                };
                input.click();
            });
        }

        const btnClear = document.getElementById('btn-settings-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
                    Promise.resolve(window.AppSettingsService.clearAllData()).then(() => {
                        Utils.showToast('数据已清除');
                        location.reload();
                    });
                }
            });
        }
    },

    /**
     * 渲染编辑基金表单
     */
    renderEditFundForm(data) {
        const fundId = data.fundId;
        const fund = FundManager.getFund(fundId);
        if (!fund) {
            return { content: '<p>基金不存在</p>', actions: '<button class="btn btn-secondary" onclick="Modal.hide()">关闭</button>' };
        }

        const code = fund.code || '';
        const name = fund.name || '';
        const remark = fund.remark || '';
        const nameSource = fund.nameSource || '';
        const nameUpdateTime = fund.nameUpdateTime || '';

        const content = `
            <div class="form-group">
                <label class="form-label">基金代码</label>
                <div class="form-value">${code}</div>
            </div>
            ${Modal.renderFundNameFieldHtml({
        idPrefix: 'edit',
        label: '基金名称 *',
        placeholder: '输入名称或点击刷新按钮获取',
        value: name,
        source: nameSource,
        updateTime: nameUpdateTime
    })}
            <div class="form-group">
                <label class="form-label">备注</label>
                <input type="text" id="input-edit-fund-remark" class="form-input" value="${remark}" placeholder="添加备注（可选）" maxlength="50">
            </div>
        `;

        return {
            content: content,
            actions: '<button class="btn btn-secondary" onclick="Modal.hide()">取消</button>' +
                     '<button class="btn btn-primary" id="btn-confirm-edit-fund">保存</button>'
        };
    },

    /**
     * 绑定编辑基金弹窗事件
     */
    bindEditFundEvents(data) {
        const fundId = data.fundId;
        const fund = FundManager.getFund(fundId);
        if (!fund) return;

        const inputName = document.getElementById('input-edit-fund-name');
        const btnRefreshName = document.getElementById('btn-edit-refresh-name');
        const sourceBadge = document.getElementById('edit-name-source-badge');
        const statusSpan = document.getElementById('edit-name-status');

        const updateNameUI = function(name, source, isGarbled = false) {
            if (inputName) inputName.value = name || '';
            if (sourceBadge) {
                sourceBadge.textContent = source === 'api' ? 'API获取' :
                    source === 'cache' ? '缓存' :
                        source === 'manual' ? '手动修改' : '等待获取';
                sourceBadge.className = 'form-name-source-badge';
                if (source === 'api') sourceBadge.classList.add('form-name-source-badge--api');
                else if (source === 'cache') sourceBadge.classList.add('form-name-source-badge--cache');
                else if (source === 'manual') sourceBadge.classList.add('form-name-source-badge--manual');
            }
            if (statusSpan) {
                if (isGarbled) {
                    statusSpan.textContent = '⚠️ 可能是乱码';
                    statusSpan.className = 'form-name-status form-name-status--garbled';
                } else if (name) {
                    statusSpan.textContent = '✓ 名称有效';
                    statusSpan.className = 'form-name-status form-name-status--valid';
                } else {
                    statusSpan.textContent = '';
                }
            }
        };

        if (btnRefreshName) {
            btnRefreshName.addEventListener('click', async function() {
                const code = fund.code;
                if (!code) return;

                btnRefreshName.disabled = true;
                btnRefreshName.textContent = '...';

                try {
                    const cachedEntry = NameCache.get(code);
                    if (cachedEntry) {
                        const isGarbled = NameValidator.detectGarbled(cachedEntry.name).isGarbled;
                        updateNameUI(cachedEntry.name, 'cache', isGarbled);
                        btnRefreshName.disabled = false;
                        btnRefreshName.textContent = '🔄';
                        return;
                    }

                    const name = await FundAPI.fetchNameOnly(code);
                    const validation = NameValidator.detectGarbled(name);
                    updateNameUI(name, 'api', validation.isGarbled);

                    if (!validation.isGarbled) {
                        NameCache.set(code, name, 'api');
                    }

                    Utils.showToast(validation.isGarbled ? '名称可能是乱码，请手动确认' : '名称已刷新', validation.isGarbled ? 'warning' : 'success');
                } catch (error) {
                    console.error('Fetch fund name error:', error);
                    Utils.showToast('获取名称失败', 'error');
                } finally {
                    btnRefreshName.disabled = false;
                    btnRefreshName.textContent = '🔄';
                }
            });
        }

        if (inputName) {
            inputName.addEventListener('input', function() {
                const name = inputName.value.trim();
                if (name) {
                    const validation = NameValidator.detectGarbled(name);
                    updateNameUI(name, 'manual', validation.isGarbled);
                }
            });
        }

        const btnConfirm = document.getElementById('btn-confirm-edit-fund');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', async function() {
                const newName = inputName ? inputName.value.trim() : '';
                const newRemark = document.getElementById('input-edit-fund-remark')?.value.trim() || '';

                if (!newName) {
                    Utils.showToast('基金名称不能为空', 'error');
                    return;
                }

                const currentFund = FundManager.getFund(fundId);
                const nameChanged = newName !== (currentFund.name || '');
                const remarkChanged = newRemark !== (currentFund.remark || '');

                if (!nameChanged && !remarkChanged) {
                    Modal.hide();
                    Utils.showToast('未做任何修改');
                    return;
                }

                const updateData = {};
                if (nameChanged) {
                    updateData.name = newName;
                    updateData.nameSource = 'manual';
                    updateData.nameUpdateTime = new Date().toISOString();
                    NameCache.set(fund.code, newName, 'manual');
                }
                if (remarkChanged) {
                    updateData.remark = newRemark;
                }

                const success = await FundManager.updateFund(fundId, updateData);
                if (success) {
                    Modal.hide();
                    Utils.showToast('基金信息已更新', 'success');
                    Detail.refresh();
                } else {
                    Utils.showToast('保存失败', 'error');
                }
            });
        }
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

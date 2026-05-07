/**
 * 工具页面管理
 * 管理工具箱页面的显示和交互
 */

const ToolPage = {
    currentResult: null,
    tierCount: 0,

    /**
     * 初始化工具页面
     */
    init() {
        if (ToolPage._initialized) return;
        ToolPage._initialized = true;

        const toolCard = document.querySelector('.tool-card[data-tool="conversion"]');
        const btnCalc = document.getElementById('btn-calc-conversion');
        const btnSave = document.getElementById('btn-save-conversion');

        if (toolCard) {
            toolCard.addEventListener('click', () => {
                ToolPage.toggleTool('conversion');
            });
        }

        if (btnCalc) {
            btnCalc.addEventListener('click', () => {
                ToolPage.handleCalculate();
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                ToolPage.handleSave();
            });
        }

        const inputs = [
            'conv-a-net-value', 'conv-a-shares', 'conv-a-sell-rate',
            'conv-b-net-value', 'conv-b-shares', 'conv-b-buy-rate'
        ];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    document.getElementById('conv-result')?.classList.add('hidden');
                    ToolPage.currentResult = null;
                });
            }
        });

        // 费率模式切换
        ToolPage.initFeeModeToggle();

        // 添加费率段按钮
        const btnAddTier = document.getElementById('btn-add-tier');
        if (btnAddTier) {
            btnAddTier.addEventListener('click', () => {
                ToolPage.addFeeTier();
            });
        }

        // A基金份额变化时更新分段费率提示
        const aSharesInput = document.getElementById('conv-a-shares');
        if (aSharesInput) {
            aSharesInput.addEventListener('input', () => {
                ToolPage.validateTieredShares();
            });
        }
    },

    /**
     * 初始化费率模式切换
     */
    initFeeModeToggle() {
        const radios = document.querySelectorAll('input[name="fee-mode"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                ToolPage.switchFeeMode(mode);
            });
        });
    },

    /**
     * 切换费率模式
     */
    switchFeeMode(mode) {
        const singleSection = document.getElementById('single-fee-section');
        const tieredSection = document.getElementById('tiered-fee-section');

        if (mode === 'single') {
            singleSection.classList.remove('hidden');
            tieredSection.classList.add('hidden');
        } else {
            singleSection.classList.add('hidden');
            tieredSection.classList.remove('hidden');

            // 初始化第一个费率段
            if (ToolPage.tierCount === 0) {
                ToolPage.addFeeTier();
            }
        }

        // 隐藏计算结果
        document.getElementById('conv-result')?.classList.add('hidden');
        ToolPage.currentResult = null;
    },

    /**
     * 添加费率段
     */
    addFeeTier() {
        ToolPage.tierCount++;
        const container = document.getElementById('tiered-fee-container');
        const tierId = `tier-${ToolPage.tierCount}`;

        const tierDiv = document.createElement('div');
        tierDiv.className = 'fee-tier-row';
        tierDiv.id = tierId;
        tierDiv.innerHTML = `
            <div class="form-row">
                <div class="form-group flex-2">
                    <label class="form-label">份额</label>
                    <input type="number" class="form-input tier-shares" step="0.01" min="0" placeholder="0.00" data-tier="${ToolPage.tierCount}">
                </div>
                <div class="form-group flex-1">
                    <label class="form-label">费率(%)</label>
                    <input type="number" class="form-input tier-rate" step="0.01" min="0" placeholder="0.00" data-tier="${ToolPage.tierCount}">
                </div>
                <div class="form-group flex-0">
                    <label class="form-label">&nbsp;</label>
                    <button type="button" class="btn btn-danger btn-sm btn-remove-tier" data-tier="${ToolPage.tierCount}">×</button>
                </div>
            </div>
        `;

        container.appendChild(tierDiv);

        // 绑定事件
        const sharesInput = tierDiv.querySelector('.tier-shares');
        const rateInput = tierDiv.querySelector('.tier-rate');
        const removeBtn = tierDiv.querySelector('.btn-remove-tier');

        sharesInput.addEventListener('input', () => {
            ToolPage.validateTieredShares();
        });

        rateInput.addEventListener('input', () => {
            document.getElementById('conv-result')?.classList.add('hidden');
            ToolPage.currentResult = null;
        });

        removeBtn.addEventListener('click', () => {
            ToolPage.removeFeeTier(tierId);
        });
    },

    /**
     * 移除费率段
     */
    removeFeeTier(tierId) {
        const container = document.getElementById('tiered-fee-container');
        const tierElement = document.getElementById(tierId);

        if (container.children.length <= 1) {
            Utils.showToast('至少保留一个费率段', 'error');
            return;
        }

        if (tierElement) {
            tierElement.remove();
            ToolPage.validateTieredShares();
        }
    },

    /**
     * 验证分段费率份额总和
     */
    validateTieredShares() {
        const totalShares = parseFloat(document.getElementById('conv-a-shares')?.value) || 0;
        const tierSharesInputs = document.querySelectorAll('.tier-shares');
        let totalTierShares = 0;

        tierSharesInputs.forEach(input => {
            totalTierShares += parseFloat(input.value) || 0;
        });

        const validationEl = document.getElementById('tiered-shares-validation');
        if (!validationEl) return;

        if (totalShares === 0) {
            validationEl.textContent = '';
            validationEl.className = 'validation-message';
            return;
        }

        const diff = Math.abs(totalTierShares - totalShares);
        if (diff < 0.01) {
            validationEl.textContent = `✓ 已分配 ${totalTierShares.toFixed(2)} / ${totalShares.toFixed(2)} 份`;
            validationEl.className = 'validation-message valid';
        } else {
            validationEl.textContent = `⚠ 已分配 ${totalTierShares.toFixed(2)} / ${totalShares.toFixed(2)} 份（${totalTierShares > totalShares ? '超出' : '不足'} ${(diff).toFixed(2)} 份）`;
            validationEl.className = 'validation-message invalid';
        }
    },

    /**
     * 收集分段费率参数
     */
    collectTieredFeeParams() {
        const tiers = [];
        const tierRows = document.querySelectorAll('.fee-tier-row');

        tierRows.forEach(row => {
            const shares = parseFloat(row.querySelector('.tier-shares').value) || 0;
            const rate = parseFloat(row.querySelector('.tier-rate').value) || 0;

            tiers.push({
                shares: shares,
                rate: rate
            });
        });

        return tiers;
    },

    /**
     * 切换工具展开/收起
     */
    toggleTool(toolName) {
        const detail = document.getElementById(`tool-${toolName}`);
        if (!detail) return;

        const isHidden = detail.classList.contains('hidden');
        document.querySelectorAll('.tool-detail').forEach(d => d.classList.add('hidden'));

        if (isHidden) {
            detail.classList.remove('hidden');
            if (toolName === 'conversion') {
                ToolPage.populateFundSelect();
                ToolPage.resetTieredFeeUI();
            }
        }
    },

    /**
     * 重置分段费率UI状态
     */
    resetTieredFeeUI() {
        ToolPage.tierCount = 0;
        const container = document.getElementById('tiered-fee-container');
        if (container) {
            container.innerHTML = '';
        }

        // 重置为单费率模式
        const singleRadio = document.querySelector('input[name="fee-mode"][value="single"]');
        if (singleRadio) {
            singleRadio.checked = true;
        }

        const singleSection = document.getElementById('single-fee-section');
        const tieredSection = document.getElementById('tiered-fee-section');
        if (singleSection) singleSection.classList.remove('hidden');
        if (tieredSection) tieredSection.classList.add('hidden');

        const validationEl = document.getElementById('tiered-shares-validation');
        if (validationEl) {
            validationEl.textContent = '';
            validationEl.className = 'validation-message';
        }

        // 隐藏计算结果
        document.getElementById('conv-result')?.classList.add('hidden');
        ToolPage.currentResult = null;
    },

    /**
     * 填充基金下拉框
     */
    populateFundSelect() {
        const select = document.getElementById('conv-target-fund');
        if (!select) return;

        const funds = FundManager.getAllFunds();
        select.innerHTML = '<option value="">不生成记录，仅计算</option>';

        funds.forEach(fund => {
            const option = document.createElement('option');
            option.value = fund.id;
            option.textContent = `${fund.name || fund.code}`;
            select.appendChild(option);
        });
    },

    /**
     * 执行计算
     */
    handleCalculate() {
        const feeMode = document.querySelector('input[name="fee-mode"]:checked')?.value || 'single';

        const baseParams = {
            aNetValue: parseFloat(document.getElementById('conv-a-net-value').value),
            aShares: parseFloat(document.getElementById('conv-a-shares').value),
            bNetValue: parseFloat(document.getElementById('conv-b-net-value').value),
            bShares: parseFloat(document.getElementById('conv-b-shares').value),
            bBuyRate: parseFloat(document.getElementById('conv-b-buy-rate').value)
        };

        let params;

        if (feeMode === 'tiered') {
            params = {
                ...baseParams,
                useTieredFee: true,
                sellFeeTiers: ToolPage.collectTieredFeeParams()
            };
        } else {
            params = {
                ...baseParams,
                useTieredFee: false,
                aSellRate: parseFloat(document.getElementById('conv-a-sell-rate').value)
            };
        }

        const result = ConversionCalculator.calculate(params);

        if (result.error) {
            Utils.showToast(result.error, 'error');
            return;
        }

        ToolPage.currentResult = result;
        ToolPage.renderResult(result);
    },

    /**
     * 渲染计算结果
     */
    renderResult(result) {
        const resultDiv = document.getElementById('conv-result');
        if (!resultDiv) return;

        document.getElementById('conv-result-transfer').textContent = Utils.formatMoney(result.transferAmount);
        document.getElementById('conv-result-sell-fee').textContent = Utils.formatMoney(result.sellFee);
        document.getElementById('conv-result-received').textContent = Utils.formatMoney(result.receivedAmount);
        document.getElementById('conv-result-base').textContent = Utils.formatMoney(result.baseAmount);
        document.getElementById('conv-result-buy-fee').textContent = Utils.formatMoney(result.buyFee);
        document.getElementById('conv-result-paid').textContent = Utils.formatMoney(result.paidAmount);

        const balanceEl = document.getElementById('conv-result-balance');
        if (result.balance >= 0) {
            balanceEl.textContent = `+${Utils.formatMoney(result.balance)}（退还）`;
            balanceEl.className = 'summary-value profit';
        } else {
            balanceEl.textContent = `${Utils.formatMoney(result.balance)}（补交）`;
            balanceEl.className = 'summary-value loss';
        }

        document.getElementById('conv-result-total-fee').textContent = Utils.formatMoney(result.totalFee);

        // 渲染卖出手续费明细
        ToolPage.renderSellFeeDetails(result);

        const btnSave = document.getElementById('btn-save-conversion');
        const targetFundId = document.getElementById('conv-target-fund')?.value;
        if (targetFundId) {
            btnSave.classList.remove('hidden');
        } else {
            btnSave.classList.add('hidden');
        }

        resultDiv.classList.remove('hidden');
    },

    /**
     * 渲染卖出手续费明细
     */
    renderSellFeeDetails(result) {
        const detailsSection = document.getElementById('sell-fee-details');
        const detailsList = document.getElementById('sell-fee-details-list');

        if (!detailsSection || !detailsList) return;

        if (!result.sellFeeDetails || result.sellFeeDetails.length <= 1) {
            detailsSection.classList.add('hidden');
            return;
        }

        detailsSection.classList.remove('hidden');
        detailsList.innerHTML = '';

        result.sellFeeDetails.forEach((tier, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'fee-detail-item';
            itemDiv.innerHTML = `
                <span class="fee-detail-label">第${index + 1}段：</span>
                <span class="fee-detail-value">${tier.shares.toFixed(2)}份 × ${Utils.formatMoney(tier.amount / tier.shares)} × ${tier.rate}% = </span>
                <span class="fee-detail-fee">${Utils.formatMoney(tier.fee)}</span>
            `;
            detailsList.appendChild(itemDiv);
        });
    },

    /**
     * 保存交易记录
     */
    handleSave() {
        if (!ToolPage.currentResult) {
            Utils.showToast('请先执行计算', 'error');
            return;
        }

        const targetFundId = document.getElementById('conv-target-fund').value;
        if (!targetFundId) {
            Utils.showToast('请选择转入基金', 'error');
            return;
        }

        const date = document.getElementById('conv-date').value || Utils.formatDate(new Date());
        const remark = document.getElementById('conv-remark')?.value || '';

        const trades = ConversionCalculator.generateTrades(ToolPage.currentResult, {
            date: date,
            remark: remark,
            targetFundId: targetFundId,
            sourceFundId: ''
        });

        const buyTrade = TradeManager.addTrade(trades[1]);

        if (buyTrade) {
            Utils.showToast('转换记录已保存', 'success');
        }
    }
};

// 注册到模块系统
ModuleRegistry.register('ToolPage', ToolPage);

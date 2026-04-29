/**
 * 工具页面管理
 * 管理工具箱页面的显示和交互
 */

const ToolPage = {
    currentResult: null,

    /**
     * 初始化工具页面
     */
    init() {
        const btnBack = document.getElementById('btn-back-from-tools');
        const toolCard = document.querySelector('.tool-card[data-tool="conversion"]');
        const btnCalc = document.getElementById('btn-calc-conversion');
        const btnSave = document.getElementById('btn-save-conversion');

        if (btnBack) {
            btnBack.addEventListener('click', () => {
                Router.navigate('overview');
            });
        }

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
            }
        }
    },

    /**
     * 填充基金下拉框
     */
    populateFundSelect() {
        const select = document.getElementById('conv-target-fund');
        if (!select) return;

        const funds = DataService.loadFunds();
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
        const params = {
            aNetValue: parseFloat(document.getElementById('conv-a-net-value').value),
            aShares: parseFloat(document.getElementById('conv-a-shares').value),
            aSellRate: parseFloat(document.getElementById('conv-a-sell-rate').value),
            bNetValue: parseFloat(document.getElementById('conv-b-net-value').value),
            bShares: parseFloat(document.getElementById('conv-b-shares').value),
            bBuyRate: parseFloat(document.getElementById('conv-b-buy-rate').value)
        };

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

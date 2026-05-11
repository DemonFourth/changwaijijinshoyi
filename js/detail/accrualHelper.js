const AccrualHelper = {
    ACCRUAL_PERCENTAGES: [10, 20, 30, 50, 100],
    _resultData: null,

    render(containerId, fund, trades) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stats = FundManager.getFundStats(fund.id);
        if (!stats) return;

        const summary = stats.summary;
        const currentHolding = summary.currentHolding;
        const estimatedValue = fund.estimatedValue || fund.netValue || 0;

        if (currentHolding.shares <= 0 || estimatedValue <= 0) {
            container.innerHTML = '';
            return;
        }

        const estimatedMarketValue = currentHolding.shares * estimatedValue;

        const activeCycle = stats?.cycles?.find(c => c.status === 'active');
        const totalBuyCost = activeCycle?.trades
            ?.filter(t => t.type === 'buy')
            ?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

        const html = `
            <div class="accrual-section">
                <div class="accrual-header">
                    <h3>🎯 计提计算</h3>
                    <span class="accrual-hint">按当前估算净值计算</span>
                </div>

                <div class="accrual-main-layout">
                    <div class="accrual-left">
                        <div class="accrual-info-grid">
                            <div class="accrual-info-card">
                                <div class="accrual-card-label">估算市值</div>
                                <div class="accrual-card-value">${Utils.formatMoney(estimatedMarketValue)}</div>
                                <div class="accrual-card-meta">当前持有</div>
                            </div>
                            <div class="accrual-info-card accrual-info-card--highlight">
                                <div class="accrual-card-label">累计买入成本</div>
                                <div class="accrual-card-value">${Utils.formatMoney(totalBuyCost)}</div>
                                <div class="accrual-card-meta">提取基准</div>
                            </div>
                        </div>

                        <div class="accrual-holding-row">
                            <div class="accrual-holding-card">
                                <div class="accrual-holding-label">持有份额</div>
                                <div class="accrual-holding-value">${Utils.formatNumber(currentHolding.shares)}</div>
                            </div>
                            <div class="accrual-holding-card">
                                <div class="accrual-holding-label">估算净值</div>
                                <div class="accrual-holding-value">${Utils.formatNumber(estimatedValue, 4)}</div>
                            </div>
                        </div>

                        <div class="accrual-percentage-section">
                            <div class="accrual-percentage-label">提取比例</div>
                            <div class="accrual-percentage-options">
                                ${this.ACCRUAL_PERCENTAGES.map(p => `
                                    <button class="btn btn-outline btn-percentage" data-percentage="${p}">${p}%</button>
                                `).join('')}
                                <button class="btn btn-outline btn-percentage" data-percentage="custom">自定义</button>
                            </div>
                            <div class="accrual-custom-input hidden" id="accrual-custom-container">
                                <input type="number" id="accrual-custom-percentage" min="1" max="999" placeholder="输入">
                                <span>%</span>
                            </div>
                        </div>
                    </div>

                    <div class="accrual-right hidden" id="accrual-result">
                        <div class="accrual-target-section">
                            <div class="accrual-target-label">目标金额</div>
                            <div class="accrual-target-value" id="accrual-target-amount-value">¥0.00</div>
                            <div class="accrual-target-hint" id="accrual-target-hint"></div>
                        </div>
                        <div class="accrual-detail-list">
                            <div class="accrual-detail-row">
                                <span class="accrual-detail-row-label">所需份额</span>
                                <span class="accrual-detail-row-value" id="accrual-shares-value">-</span>
                            </div>
                            <div class="accrual-detail-row">
                                <span class="accrual-detail-row-label">预估手续费</span>
                                <span class="accrual-detail-row-value" id="accrual-fee-value">¥0.00</span>
                            </div>
                            <div class="accrual-detail-row accrual-detail-row--highlight">
                                <span class="accrual-detail-row-label">实际到账</span>
                                <span class="accrual-detail-row-value" id="accrual-actual-amount-value">¥0.00</span>
                            </div>
                        </div>
                        <div class="accrual-fee-details hidden" id="accrual-fee-details"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.bindEvents(fund, trades);
    },

    bindEvents(fund, trades) {
        const container = document.querySelector('.accrual-section');
        if (!container) return;

        let currentPercentage = null;
        AccrualHelper._resultData = null;

        container.querySelectorAll('.btn-percentage').forEach(btn => {
            btn.addEventListener('click', () => {
                const percentage = btn.dataset.percentage;

                container.querySelectorAll('.btn-percentage').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (percentage === 'custom') {
                    document.getElementById('accrual-custom-container').classList.remove('hidden');
                    document.getElementById('accrual-custom-percentage').focus();
                } else {
                    document.getElementById('accrual-custom-container').classList.add('hidden');
                    currentPercentage = parseInt(percentage);
                    this.updateResult(fund, trades, currentPercentage);
                }
            });
        });

        const customInput = document.getElementById('accrual-custom-percentage');
        if (customInput) {
            customInput.addEventListener('input', () => {
                const val = parseFloat(customInput.value);
                if (val > 0 && val <= 999) {
                    currentPercentage = val;
                    this.updateResult(fund, trades, currentPercentage);
                }
            });
        }
    },

    updateResult(fund, trades, percentage) {
        const result = CalculatorV2.calculateAccrualShares(trades, fund, percentage);

        if (result.error) {
            Utils.showToast(result.error, 'warning');
            return;
        }

        AccrualHelper._resultData = result;

        document.getElementById('accrual-result').classList.remove('hidden');

        document.getElementById('accrual-target-amount-value').textContent = Utils.formatMoney(result.targetAmount);
        document.getElementById('accrual-target-hint').textContent = '(= 累计买入成本的' + percentage + '%)';

        document.getElementById('accrual-shares-value').textContent = Utils.formatNumber(result.shares, 2);
        document.getElementById('accrual-fee-value').textContent = Utils.formatMoney(result.fee);
        document.getElementById('accrual-actual-amount-value').textContent = Utils.formatMoney(result.actualAmount);

        const feeDetailsEl = document.getElementById('accrual-fee-details');
        if (feeDetailsEl && result.feeDetails && result.feeDetails.length > 0) {
            let feeHtml = '<div class="fee-detail-title">手续费明细：</div>';
            result.feeDetails.forEach(d => {
                feeHtml += '<div class="fee-detail-item">' + d.fromDate + '买入的' +
                    d.originalBuyShares.toFixed(2) + '份卖出' + d.shares.toFixed(2) + '份，' +
                    '持有' + d.days + '天费率' + d.rate + '%手续费¥' + d.fee.toFixed(2) + '</div>';
            });
            feeDetailsEl.innerHTML = feeHtml;
            feeDetailsEl.classList.remove('hidden');
        } else if (feeDetailsEl) {
            feeDetailsEl.classList.add('hidden');
        }
    },

    refresh(fund, trades) {
        const container = document.getElementById('accrual-container');
        if (container) {
            this.render('accrual-container', fund, trades);
        }
    }
};

ModuleRegistry.register('AccrualHelper', AccrualHelper);

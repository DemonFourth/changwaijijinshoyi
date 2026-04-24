/**
 * 弹窗管理器
 * 管理各种弹窗的显示和交互
 */

const Modal = {
    // 当前弹窗类型
    currentType: null,

    /**
     * 显示弹窗
     * @param {string} type - 弹窗类型
     * @param {object} data - 弹窗数据
     */
    show(type, data = {}) {
        this.currentType = type;

        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        // 根据类型生成弹窗内容
        switch (type) {
        case 'addFund':
            title.textContent = '添加基金';
            body.innerHTML = this.renderAddFundForm();
            this.bindAddFundEvents();
            break;

        case 'addTrade':
            title.textContent = '添加交易';
            body.innerHTML = this.renderAddTradeForm(data);
            this.bindAddTradeEvents(data);
            break;

        case 'editTrade':
            title.textContent = '编辑交易';
            body.innerHTML = this.renderEditTradeForm(data);
            this.bindEditTradeEvents(data);
            break;

        case 'deleteConfirm':
            title.textContent = '确认删除';
            body.innerHTML = this.renderDeleteConfirm(data);
            this.bindDeleteConfirmEvents(data);
            break;

        case 'import':
            title.textContent = '导入数据';
            body.innerHTML = this.renderImportForm();
            this.bindImportEvents();
            break;

        case 'export':
            title.textContent = '导出数据';
            body.innerHTML = this.renderExportForm();
            this.bindExportEvents();
            break;

        default:
            console.error('Unknown modal type:', type);
            return;
        }

        // 显示弹窗
        container.classList.remove('hidden');
        EventBus.emit(EventType.MODAL_OPENED, { type, data });
    },

    /**
     * 隐藏弹窗
     */
    hide() {
        const container = document.getElementById('modal-container');
        container.classList.add('hidden');
        this.currentType = null;
        EventBus.emit(EventType.MODAL_CLOSED);
    },

    /**
     * 渲染添加基金表单
     */
    renderAddFundForm() {
        return `
            <div class="form-group">
                <label class="form-label">基金代码 *</label>
                <input type="text" id="input-fund-code" class="form-input" 
                       placeholder="请输入6位基金代码" maxlength="6">
                <div id="error-fund-code" class="form-error"></div>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
                <button class="btn btn-primary" id="btn-confirm-add-fund">确定</button>
            </div>
        `;
    },

    /**
     * 绑定添加基金事件
     */
    bindAddFundEvents() {
        const btnConfirm = document.getElementById('btn-confirm-add-fund');
        const inputCode = document.getElementById('input-fund-code');
        const errorDiv = document.getElementById('error-fund-code');

        btnConfirm.addEventListener('click', async () => {
            const code = inputCode.value.trim();

            // 验证
            if (!Utils.isValidFundCode(code)) {
                errorDiv.textContent = '请输入正确的6位基金代码';
                return;
            }

            if (FundManager.isFundCodeExists(code)) {
                errorDiv.textContent = '该基金已存在';
                return;
            }

            errorDiv.textContent = '';

            try {
                const fund = await FundManager.addFund({ code });
                if (fund) {
                    this.hide();
                    // 刷新页面
                    if (typeof Overview !== 'undefined') {
                        Overview.refresh();
                    }
                }
            } catch (error) {
                errorDiv.textContent = error.message;
            }
        });
    },

    /**
     * 渲染添加交易表单
     */
    renderAddTradeForm() {
        return `
            <div class="form-group">
                <label class="form-label">交易日期 *</label>
                <input type="date" id="input-trade-date" class="form-input" 
                       value="${Utils.formatDate(new Date())}">
            </div>
            <div class="form-group">
                <label class="form-label">交易类型 *</label>
                <select id="input-trade-type" class="form-select">
                    <option value="buy">买入</option>
                    <option value="sell">卖出</option>
                    <option value="dividend">分红</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">净值</label>
                <input type="number" id="input-trade-net-value" class="form-input" 
                       placeholder="买入时的净值（可选）" step="0.0001" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">份额 *</label>
                <input type="number" id="input-trade-shares" class="form-input" 
                       placeholder="请输入份额" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">金额 *</label>
                <input type="number" id="input-trade-amount" class="form-input" 
                       placeholder="请输入金额" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">手续费</label>
                <input type="number" id="input-trade-fee" class="form-input" 
                       placeholder="请输入手续费" step="0.01" min="0" value="0">
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <input type="text" id="input-trade-remark" class="form-input" 
                       placeholder="备注信息（可选）">
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
                <button class="btn btn-primary" id="btn-confirm-add-trade">确定</button>
            </div>
        `;
    },

    /**
     * 绑定添加交易事件
     */
    bindAddTradeEvents(data) {
        const btnConfirm = document.getElementById('btn-confirm-add-trade');

        btnConfirm.addEventListener('click', () => {
            const tradeData = {
                fundId: data.fundId,
                date: document.getElementById('input-trade-date').value,
                type: document.getElementById('input-trade-type').value,
                netValue: document.getElementById('input-trade-net-value').value,
                shares: document.getElementById('input-trade-shares').value,
                amount: document.getElementById('input-trade-amount').value,
                fee: document.getElementById('input-trade-fee').value,
                remark: document.getElementById('input-trade-remark').value
            };

            const trade = TradeManager.addTrade(tradeData);
            if (trade) {
                this.hide();
                // 刷新详情页
                if (typeof Detail !== 'undefined') {
                    Detail.refresh();
                }
            }
        });
    },

    /**
     * 渲染编辑交易表单
     */
    renderEditTradeForm(data) {
        const trade = data.trade;
        return `
            <div class="form-group">
                <label class="form-label">交易日期 *</label>
                <input type="date" id="input-trade-date" class="form-input" 
                       value="${trade.date}">
            </div>
            <div class="form-group">
                <label class="form-label">交易类型 *</label>
                <select id="input-trade-type" class="form-select">
                    <option value="buy" ${trade.type === 'buy' ? 'selected' : ''}>买入</option>
                    <option value="sell" ${trade.type === 'sell' ? 'selected' : ''}>卖出</option>
                    <option value="dividend" ${trade.type === 'dividend' ? 'selected' : ''}>分红</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">份额 *</label>
                <input type="number" id="input-trade-shares" class="form-input" 
                       value="${trade.shares}" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">金额 *</label>
                <input type="number" id="input-trade-amount" class="form-input" 
                       value="${trade.amount}" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">手续费</label>
                <input type="number" id="input-trade-fee" class="form-input" 
                       value="${trade.fee}" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <input type="text" id="input-trade-remark" class="form-input" 
                       value="${trade.remark || ''}">
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
                <button class="btn btn-primary" id="btn-confirm-edit-trade">确定</button>
            </div>
        `;
    },

    /**
     * 绑定编辑交易事件
     */
    bindEditTradeEvents(data) {
        const btnConfirm = document.getElementById('btn-confirm-edit-trade');

        btnConfirm.addEventListener('click', () => {
            const updates = {
                date: document.getElementById('input-trade-date').value,
                type: document.getElementById('input-trade-type').value,
                shares: document.getElementById('input-trade-shares').value,
                amount: document.getElementById('input-trade-amount').value,
                fee: document.getElementById('input-trade-fee').value,
                remark: document.getElementById('input-trade-remark').value
            };

            const success = TradeManager.updateTrade(data.trade.id, updates);
            if (success) {
                this.hide();
                // 刷新详情页
                if (typeof Detail !== 'undefined') {
                    Detail.refresh();
                }
            }
        });
    },

    /**
     * 渲染删除确认
     */
    renderDeleteConfirm(data) {
        return `
            <p style="margin-bottom: 1.5rem;">${data.message || '确定要删除吗？此操作不可恢复。'}</p>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
                <button class="btn btn-danger" id="btn-confirm-delete">删除</button>
            </div>
        `;
    },

    /**
     * 绑定删除确认事件
     */
    bindDeleteConfirmEvents(data) {
        const btnConfirm = document.getElementById('btn-confirm-delete');

        btnConfirm.addEventListener('click', () => {
            if (data.onConfirm) {
                data.onConfirm();
            }
            this.hide();
        });
    },

    /**
     * 渲染导入表单
     */
    renderImportForm() {
        return `
            <div class="form-group">
                <label class="form-label">选择文件</label>
                <input type="file" id="input-import-file" class="form-input" 
                       accept=".json">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="input-merge-data"> 合并数据（不勾选则覆盖）
                </label>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
                <button class="btn btn-primary" id="btn-confirm-import">导入</button>
            </div>
        `;
    },

    /**
     * 绑定导入事件
     */
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
                        this.hide();
                        // 刷新页面
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

    /**
     * 渲染导出表单
     */
    renderExportForm() {
        const data = DataService.exportData();
        const jsonStr = JSON.stringify(data, null, 2);

        return `
            <div class="form-group">
                <label class="form-label">数据预览</label>
                <textarea class="form-input" rows="10" readonly>${jsonStr}</textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">关闭</button>
                <button class="btn btn-primary" id="btn-confirm-export">下载文件</button>
            </div>
        `;
    },

    /**
     * 绑定导出事件
     */
    bindExportEvents() {
        const btnConfirm = document.getElementById('btn-confirm-export');

        btnConfirm.addEventListener('click', () => {
            const data = DataService.exportData();
            const jsonStr = JSON.stringify(data, null, 2);

            // 创建下载
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fund-data-${Utils.formatDate(new Date(), 'YYYY-MM-DD')}.json`;
            a.click();
            URL.revokeObjectURL(url);

            Utils.showToast('数据导出成功', 'success');
            this.hide();
        });
    }
};

// 绑定弹窗关闭事件
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

// 注册到模块系统
ModuleRegistry.register('Modal', Modal);

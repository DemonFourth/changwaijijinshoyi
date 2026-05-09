const SyncConflictModalHelper = {
    show(conflicts, onResolve) {
        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        title.textContent = '同步冲突';
        body.innerHTML = `
            <p>检测到 ${conflicts.length} 个冲突，请选择保留的版本：</p>
            <div class="conflict-list">
                ${conflicts.map((conflict, index) => this._renderConflictItem(conflict, index)).join('')}
            </div>
        `;
        footer.innerHTML = `
            <button class="btn btn-secondary" id="btn-conflict-use-local">全部使用本地版本</button>
            <button class="btn btn-secondary" id="btn-conflict-use-cloud">全部使用云端版本</button>
            <button class="btn btn-primary" id="btn-conflict-apply">应用选择</button>
        `;

        container.classList.remove('hidden');
        container.classList.add('modal-sync-conflict');

        this._bindEvents(conflicts, onResolve);
    },

    _getDiffFields(entityType, local, cloud) {
        const diffFields = new Set();
        if (entityType === 'fund') {
            if (local.name !== cloud.name) diffFields.add('name');
            if (local.code !== cloud.code) diffFields.add('code');
            if (local.remark !== cloud.remark) diffFields.add('remark');
            if (JSON.stringify(local.feeTiers) !== JSON.stringify(cloud.feeTiers)) diffFields.add('feeTiers');
        } else {
            if (local.date !== cloud.date) diffFields.add('date');
            if (local.type !== cloud.type) diffFields.add('type');
            if (local.netValue !== cloud.netValue) diffFields.add('netValue');
            if (local.shares !== cloud.shares) diffFields.add('shares');
            if (local.amount !== cloud.amount) diffFields.add('amount');
            if (local.fee !== cloud.fee) diffFields.add('fee');
            if (local.dividendMode !== cloud.dividendMode) diffFields.add('dividendMode');
            if (local.remark !== cloud.remark) diffFields.add('remark');
        }
        return diffFields;
    },

    _formatFieldLabel(field, value, isDiff) {
        const label = isDiff ? `<span class="diff-highlight">${field}</span>` : field;
        return `<div class="detail-row">${label}: ${value}</div>`;
    },

    _renderConflictItem(conflict, index) {
        const entityType = conflict.entityType === 'fund' ? '基金' : '交易';
        const localVersion = conflict.local;
        const cloudVersion = conflict.cloud;
        const diffFields = this._getDiffFields(entityType, localVersion, cloudVersion);

        return `
            <div class="conflict-item" data-index="${index}">
                <div class="conflict-header">
                    <span class="conflict-type">${entityType}</span>
                    <span class="conflict-id">${localVersion.name || localVersion.date}</span>
                </div>
                <div class="conflict-versions">
                    <div class="version local">
                        <label>
                            <input type="radio" name="conflict-${index}" value="local" checked />
                            <strong>本地版本</strong>
                            <span class="version-time">${localVersion.updatedAt}</span>
                        </label>
                        <div class="version-detail">
                            ${this._formatVersionDetail(entityType, localVersion, diffFields)}
                        </div>
                    </div>
                    <div class="version cloud">
                        <label>
                            <input type="radio" name="conflict-${index}" value="cloud" />
                            <strong>云端版本</strong>
                            <span class="version-time">${cloudVersion.updatedAt}</span>
                        </label>
                        <div class="version-detail">
                            ${this._formatVersionDetail(entityType, cloudVersion, diffFields)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    _formatFeeTiers(tiers) {
        if (!tiers || (!tiers.buyTiers?.length && !tiers.sellTiers?.length)) return '未设置';
        const parts = [];
        if (tiers.buyTiers?.length) {
            parts.push('买入: ' + tiers.buyTiers.map(t => `${t.minAmount / 10000}-${t.maxAmount ? t.maxAmount / 10000 + '万' : '∞'}: ${t.rate}%`).join(', '));
        }
        if (tiers.sellTiers?.length) {
            parts.push('卖出: ' + tiers.sellTiers.map(t => `${t.minDays}-${t.maxDays ? t.maxDays + '天' : '∞'}: ${t.rate}%`).join(', '));
        }
        return parts.join(' | ');
    },

    _formatVersionDetail(type, entity, diffFields) {
        if (type === 'fund') {
            return `
                ${this._formatFieldLabel('名称', entity.name, diffFields.has('name'))}
                ${this._formatFieldLabel('代码', entity.code, diffFields.has('code'))}
                ${this._formatFieldLabel('净值', entity.netValue ?? '-', diffFields.has('netValue'))}
                ${this._formatFieldLabel('估算净值', entity.estimatedValue ?? '-', diffFields.has('estimatedValue'))}
                ${this._formatFieldLabel('净值日期', entity.netValueDate ?? '-', diffFields.has('netValueDate'))}
                ${this._formatFieldLabel('费率配置', this._formatFeeTiers(entity.feeTiers), diffFields.has('feeTiers'))}
                ${this._formatFieldLabel('备注', entity.remark || '-', diffFields.has('remark'))}
            `;
        } else {
            const typeMap = { buy: '买入', sell: '卖出', dividend: '分红' };
            return `
                ${this._formatFieldLabel('日期', entity.date, diffFields.has('date'))}
                ${this._formatFieldLabel('类型', typeMap[entity.type] || entity.type, diffFields.has('type'))}
                ${this._formatFieldLabel('净值', entity.netValue, diffFields.has('netValue'))}
                ${this._formatFieldLabel('份额', entity.shares, diffFields.has('shares'))}
                ${this._formatFieldLabel('金额', entity.amount, diffFields.has('amount'))}
                ${this._formatFieldLabel('手续费', entity.fee, diffFields.has('fee'))}
                ${this._formatFieldLabel('分红方式', entity.dividendMode === 'reinvest' ? '红利再投' : entity.dividendMode === 'cash' ? '现金分红' : '-', diffFields.has('dividendMode'))}
                ${this._formatFieldLabel('备注', entity.remark || '-', diffFields.has('remark'))}
            `;
        }
    },

    _bindEvents(conflicts, onResolve) {
        const btnUseLocal = document.getElementById('btn-conflict-use-local');
        const btnUseCloud = document.getElementById('btn-conflict-use-cloud');
        const btnApply = document.getElementById('btn-conflict-apply');
        const btnClose = document.querySelector('.modal-close');

        btnUseLocal?.addEventListener('click', () => {
            const resolutions = conflicts.map(() => 'local');
            onResolve(resolutions);
            this.close();
        });

        btnUseCloud?.addEventListener('click', () => {
            const resolutions = conflicts.map(() => 'cloud');
            onResolve(resolutions);
            this.close();
        });

        btnApply?.addEventListener('click', () => {
            const resolutions = conflicts.map((_, index) => {
                const checked = document.querySelector(`input[name="conflict-${index}"]:checked`);
                return checked?.value || 'local';
            });
            onResolve(resolutions);
            this.close();
        });

        btnClose?.addEventListener('click', () => this.close());
    },

    close() {
        window.Modal.hide();
    }
};

ModuleRegistry.register('SyncConflictModalHelper', SyncConflictModalHelper);

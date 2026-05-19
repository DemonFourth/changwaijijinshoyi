const SyncConflictModalHelper = {
    FUND_FIELDS: [
        { key: 'name', label: '名称', fmt: function (v) { return v || '-'; } },
        { key: 'code', label: '代码', fmt: function (v) { return v || '-'; } },
        { key: 'feeTiers', label: '费率配置', fmt: function (v) { return SyncConflictModalHelper._formatFeeTiers(v); } },
        { key: 'remark', label: '备注', fmt: function (v) { return v || '-'; } }
    ],

    TRADE_FIELDS: [
        { key: 'date', label: '日期', fmt: function (v) { return v || '-'; } },
        { key: 'type', label: '类型', fmt: function (v) {
            const map = { buy: '\u4e70\u5165', sell: '\u5356\u51fa', dividend: '\u5206\u7ea2' };
            return map[v] || v || '-';
        } },
        { key: 'netValue', label: '\u51c0\u503c', fmt: function (v) { return v !== null && v !== undefined ? v : '-'; } },
        { key: 'shares', label: '\u4efd\u989d', fmt: function (v) { return v !== null && v !== undefined ? v : '-'; } },
        { key: 'amount', label: '\u91d1\u989d', fmt: function (v) { return v !== null && v !== undefined ? v : '-'; } },
        { key: 'fee', label: '\u624b\u7eed\u8d39', fmt: function (v) { return v !== null && v !== undefined ? v : '-'; } },
        { key: 'dividendMode', label: '分红方式', fmt: function (v) {
            if (v === 'reinvest') return '红利再投';
            if (v === 'cash') return '现金分红';
            return '-';
        } },
        { key: 'remark', label: '备注', fmt: function (v) { return v || '-'; } }
    ],

    show: function (conflicts, onResolve) {
        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        // 重置滚动位置
        if (body) body.scrollTop = 0;
        if (container) container.scrollTop = 0;

        title.textContent = '同步冲突';
        body.innerHTML = '\
            <div class="sync-conflict-info">&#9888; 检测到 ' + conflicts.length + ' 个冲突，点击展开查看详情：</div>\
            <div class="conflict-list">\
                ' + conflicts.map(function (conflict, index) {
            return SyncConflictModalHelper._renderConflictItem(conflict, index);
        }).join('') + '\
            </div>\
        ';
        footer.innerHTML = '\
            <button class="btn btn-secondary" id="btn-conflict-use-local">全部使用本地版本</button>\
            <button class="btn btn-secondary" id="btn-conflict-use-cloud">全部使用云端版本</button>\
            <button class="btn btn-primary" id="btn-conflict-apply">应用选择</button>\
        ';

        container.classList.remove('hidden');
        container.classList.add('modal-sync-conflict');

        SyncConflictModalHelper._bindEvents(conflicts, onResolve);
    },

    _getDiffFields: function (entityType, local, cloud) {
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

    _renderConflictItem: function (conflict, index) {
        const entityTypeLabel = conflict.entityType === 'fund' ? '基金' : '交易';
        const localVersion = conflict.local;
        const cloudVersion = conflict.cloud;
        const diffFields = SyncConflictModalHelper._getDiffFields(conflict.entityType, localVersion, cloudVersion);
        const diffCount = diffFields.size;
        let titleText = localVersion.name || localVersion.date || '-';
        if (localVersion.code) titleText += ' (' + localVersion.code + ')';

        const badgeHtml = diffCount > 0
            ? '<span class="conflict-badge">' + diffCount + '\u5904\u5dee\u5f02</span>'
            : '<span class="conflict-badge conflict-badge-warn">\u4ec5\u65f6\u95f4\u6233\u4e0d\u540c</span>';

        const tableHtml = SyncConflictModalHelper._renderConflictTable(conflict.entityType, localVersion, cloudVersion, diffFields);

        return '\
            <div class="conflict-item" data-index="' + index + '">\
                <div class="conflict-header">\
                    <div class="conflict-header-left">\
                        <span class="conflict-expand-icon">&#9654;</span>\
                        <span class="conflict-type-badge">' + entityTypeLabel + '</span>\
                        <span class="conflict-title">' + SyncConflictModalHelper._escapeHtml(titleText) + '</span>\
                    </div>\
                    <div class="conflict-header-right">\
                        ' + badgeHtml + '\
                        <span class="conflict-version-time">' + SyncConflictModalHelper._escapeHtml(localVersion.updatedAt || '') + '</span>\
                    </div>\
                </div>\
                <div class="conflict-body" style="display:none">\
                    <div class="conflict-radio-row">\
                        <label class="radio-local"><input type="radio" name="conflict-' + index + '" value="local" checked> \u4f7f\u7528\u672c\u5730\u7248\u672c</label>\
                        <label class="radio-cloud"><input type="radio" name="conflict-' + index + '" value="cloud"> \u4f7f\u7528\u4e91\u7aef\u7248\u672c</label>\
                    </div>\
                    ' + tableHtml + '\
                </div>\
            </div>\
        ';
    },

    _renderConflictTable: function (type, local, cloud, diffFields) {
        const fields = type === 'fund'
            ? SyncConflictModalHelper.FUND_FIELDS
            : SyncConflictModalHelper.TRADE_FIELDS;

        const rows = fields.map(function (field) {
            const isDiff = diffFields.has(field.key);
            const localVal = field.fmt(local[field.key]);
            const cloudVal = field.fmt(cloud[field.key]);
            const localClass = isDiff ? ' class="cell-diff"' : '';
            const cloudClass = isDiff ? ' class="cell-diff"' : '';
            return '\
                <tr>\
                    <td class="cell-label">' + field.label + '</td>\
                    <td' + localClass + '>' + localVal + '</td>\
                    <td' + cloudClass + '>' + cloudVal + '</td>\
                </tr>\
            ';
        }).join('');

        return '\
            <table class="conflict-table">\
                <thead><tr><th>\u5b57\u6bb5</th><th>\u672c\u5730</th><th>\u4e91\u7aef</th></tr></thead>\
                <tbody>' + rows + '</tbody>\
            </table>\
        ';
    },

    _escapeHtml: function (str) {
        if (typeof str !== 'string') return String(str);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _formatFeeTiers: function (tiers) {
        if (!tiers || (!tiers.buyTiers || !tiers.buyTiers.length) && (!tiers.sellTiers || !tiers.sellTiers.length)) return '\u672a\u8bbe\u7f6e';
        const parts = [];
        if (tiers.buyTiers && tiers.buyTiers.length) {
            parts.push('\u4e70\u5165: ' + tiers.buyTiers.map(function (t) {
                return t.minAmount / 10000 + '-' + (t.maxAmount ? t.maxAmount / 10000 + '\u4e07' : '\u221e') + ': ' + t.rate + '%';
            }).join(', '));
        }
        if (tiers.sellTiers && tiers.sellTiers.length) {
            parts.push('\u5356\u51fa: ' + tiers.sellTiers.map(function (t) {
                return t.minDays + '-' + (t.maxDays ? t.maxDays + '\u5929' : '\u221e') + ': ' + t.rate + '%';
            }).join(', '));
        }
        return parts.join(' | ');
    },

    _bindEvents: function (conflicts, onResolve) {
        const btnUseLocal = document.getElementById('btn-conflict-use-local');
        const btnUseCloud = document.getElementById('btn-conflict-use-cloud');
        const btnApply = document.getElementById('btn-conflict-apply');
        const btnClose = document.querySelector('.modal-close');

        const conflictList = document.querySelector('.conflict-list');
        if (conflictList) {
            conflictList.addEventListener('click', function (e) {
                const header = e.target.closest('.conflict-header');
                if (!header) return;
                const item = header.closest('.conflict-item');
                if (!item) return;
                const body = item.querySelector('.conflict-body');
                const icon = header.querySelector('.conflict-expand-icon');
                if (body) {
                    const isHidden = body.style.display === 'none' || body.style.display === '';
                    body.style.display = isHidden ? 'block' : 'none';
                    if (icon) icon.textContent = isHidden ? '\u25BC' : '\u25B6';
                }
            });
        }

        if (btnUseLocal) {
            btnUseLocal.addEventListener('click', function () {
                const resolutions = conflicts.map(function () { return 'local'; });
                onResolve(resolutions);
                SyncConflictModalHelper.close();
            });
        }

        if (btnUseCloud) {
            btnUseCloud.addEventListener('click', function () {
                const resolutions = conflicts.map(function () { return 'cloud'; });
                onResolve(resolutions);
                SyncConflictModalHelper.close();
            });
        }

        if (btnApply) {
            btnApply.addEventListener('click', function () {
                const resolutions = conflicts.map(function (_, index) {
                    const checked = document.querySelector('input[name="conflict-' + index + '"]:checked');
                    return checked && checked.value || 'local';
                });
                onResolve(resolutions);
                SyncConflictModalHelper.close();
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', function () { SyncConflictModalHelper.close(); });
        }
    },

    close: function () {
        window.Modal.hide();
    }
};

ModuleRegistry.register('SyncConflictModalHelper', SyncConflictModalHelper);

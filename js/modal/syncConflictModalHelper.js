const SyncConflictModalHelper = {
    show(conflicts, onResolve) {
        const modal = document.getElementById('modal-container');

        const html = `
            <div class="modal-header">
                <h3>同步冲突</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>检测到 ${conflicts.length} 个冲突，请选择保留的版本：</p>
                <div class="conflict-list">
                    ${conflicts.map((conflict, index) => this._renderConflictItem(conflict, index)).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="btn-conflict-use-local">全部使用本地版本</button>
                <button class="btn btn-secondary" id="btn-conflict-use-cloud">全部使用云端版本</button>
                <button class="btn btn-primary" id="btn-conflict-apply">应用选择</button>
            </div>
        `;

        modal.innerHTML = html;
        modal.classList.add('active');

        this._bindEvents(conflicts, onResolve);
    },

    _renderConflictItem(conflict, index) {
        const entityType = conflict.entityType === 'fund' ? '基金' : '交易';
        const localVersion = conflict.local;
        const cloudVersion = conflict.cloud;

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
                            ${this._formatVersionDetail(conflict.entityType, localVersion)}
                        </div>
                    </div>
                    <div class="version cloud">
                        <label>
                            <input type="radio" name="conflict-${index}" value="cloud" />
                            <strong>云端版本</strong>
                            <span class="version-time">${cloudVersion.updatedAt}</span>
                        </label>
                        <div class="version-detail">
                            ${this._formatVersionDetail(conflict.entityType, cloudVersion)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    _formatVersionDetail(type, entity) {
        if (type === 'fund') {
            return `
                <div class="detail-row">名称: ${entity.name}</div>
                <div class="detail-row">代码: ${entity.code}</div>
                <div class="detail-row">备注: ${entity.remark || '-'}</div>
            `;
        } else {
            return `
                <div class="detail-row">日期: ${entity.date}</div>
                <div class="detail-row">类型: ${entity.type}</div>
                <div class="detail-row">金额: ${entity.amount}</div>
                <div class="detail-row">份额: ${entity.shares}</div>
                <div class="detail-row">备注: ${entity.remark || '-'}</div>
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
        const modal = document.getElementById('modal-container');
        modal.classList.remove('active');
    }
};

ModuleRegistry.register('SyncConflictModalHelper', SyncConflictModalHelper);

/**
 * 同步状态面板 Helper
 * 显示详细的同步状态信息
 */

const SyncStatusPanelHelper = {
    /**
     * 显示同步状态面板
     */
    show() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const adapter = window.SyncAdapterRegistry.getCurrentAdapter();
        const status = adapter?.getStatus() || {};

        const content = this._renderContent(syncMeta, status);

        window.Modal.showCustom({
            title: '📊 同步状态详情',
            content,
            buttons: [
                {
                    text: '🔄 立即同步',
                    primary: true,
                    action: () => this._triggerSync()
                },
                {
                    text: '⬆️ 强制上传',
                    action: () => this._forcePush()
                },
                {
                    text: '⬇️ 强制下载',
                    action: () => this._forcePull()
                },
                { text: '关闭', class: 'btn-secondary' }
            ]
        });
    },

    /**
     * 渲染面板内容
     */
    _renderContent(syncMeta, status) {
        const providerLabel = status.provider === 'cloudflare'
            ? '☁️ Cloudflare 云端同步'
            : '📁 本地存储（无云端）';

        const lastSync = syncMeta.lastSyncAt
            ? Utils.formatDate(syncMeta.lastSyncAt, 'YYYY-MM-DD HH:mm:ss')
            : '从未同步';

        const syncStatusBadge = this._getStatusBadge(syncMeta.syncStatus);
        const pendingWarning = (syncMeta.pendingChanges || 0) > 0
            ? `<span style="color: #f59e0b; font-weight: 600;">${syncMeta.pendingChanges} 条待同步</span>`
            : '<span style="color: #10b981;">无待同步</span>';

        const localFunds = window.FundManager?.getAllFunds()?.length || 0;
        const localTrades = window.TradeManager?.getAllTrades()?.length || 0;

        return `
            <div class="sync-status-panel" style="padding: 16px;">
                <div class="sync-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">存储模式</h4>
                    <div style="font-size: 16px; font-weight: 500;">${providerLabel}</div>
                </div>

                <div class="sync-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">同步状态</h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">当前状态</span>
                            <span>${syncStatusBadge}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">最后同步</span>
                            <span>${lastSync}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">待同步变更</span>
                            <span>${pendingWarning}</span>
                        </div>
                    </div>
                </div>

                <div class="sync-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">数据统计</h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">本地基金</span>
                            <span>${localFunds} 只</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">本地交易</span>
                            <span>${localTrades} 条</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">云端基金</span>
                            <span>${syncMeta.cloudFunds || 0} 只</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">云端交易</span>
                            <span>${syncMeta.cloudTrades || 0} 条</span>
                        </div>
                    </div>
                </div>

                <div class="sync-section">
                    <h4 style="margin: 0 0 12px 0; color: var(--color-text-primary);">设备信息</h4>
                    <div style="display: grid; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">设备 ID</span>
                            <span style="font-family: monospace; font-size: 12px;">${syncMeta.deviceId?.slice(0, 16) || '-'}...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">云端版本</span>
                            <span>r${syncMeta.cloudRevision || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 获取状态徽章
     */
    _getStatusBadge(status) {
        const statusMap = {
            'idle': '<span style="color: #10b981;">● 空闲</span>',
            'pending': '<span style="color: #f59e0b;">● 待同步</span>',
            'syncing': '<span style="color: #3b82f6;">● 同步中</span>',
            'error': '<span style="color: #ef4444;">● 错误</span>',
            'conflict': '<span style="color: #f59e0b;">● 冲突</span>'
        };
        return statusMap[status] || '<span style="color: #6b7280;">● 未知</span>';
    },

    /**
     * 触发同步
     */
    async _triggerSync() {
        window.Utils?.showLoading();
        try {
            const result = await window.SyncAppService.startBackgroundSync();
            window.Utils?.hideLoading();

            if (result?.success) {
                window.Utils?.showToast('同步成功', 'success');
                window.Overview?.refresh();
                this.show();
            } else {
                window.Utils?.showToast('同步失败：' + (result?.reason || '未知错误'), 'error');
            }
        } catch (error) {
            window.Utils?.hideLoading();
            window.Utils?.showToast('同步异常：' + error.message, 'error');
        }
    },

    /**
     * 强制上传
     */
    async _forcePush() {
        window.Utils?.showToast('正在强制上传...', 'info');
        try {
            const result = await window.SyncAppService._executePush();
            if (result?.success) {
                window.Utils?.showToast('上传成功', 'success');
            } else {
                window.Utils?.showToast('上传失败：' + (result?.reason || '未知错误'), 'error');
            }
        } catch (error) {
            window.Utils?.showToast('上传异常：' + error.message, 'error');
        }
    },

    /**
     * 强制下载
     */
    async _forcePull() {
        window.Utils?.showToast('正在强制下载...', 'info');
        try {
            const result = await window.SyncAppService._executePull();
            if (result?.success) {
                window.Utils?.showToast('下载成功', 'success');
                window.Overview?.refresh();
            } else {
                window.Utils?.showToast('下载失败：' + (result?.reason || '未知错误'), 'error');
            }
        } catch (error) {
            window.Utils?.showToast('下载异常：' + error.message, 'error');
        }
    }
};

ModuleRegistry.register('SyncStatusPanelHelper', SyncStatusPanelHelper);

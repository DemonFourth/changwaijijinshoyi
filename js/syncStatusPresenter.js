/* global SyncAppService, SyncConflictModalHelper, Overview, Modal, Utils */

const SyncStatusPresenter = {
    getStatusLabel(syncStatus) {
        const status = syncStatus && syncStatus.syncStatus ? syncStatus.syncStatus : 'idle';
        const pendingChanges = syncStatus && syncStatus.pendingChanges ? syncStatus.pendingChanges : 0;
        const labelMap = {
            idle: '已同步',
            syncing: '同步中',
            pending: `待同步 ${pendingChanges} 项`,
            error: '同步失败',
            conflict: '存在冲突'
        };
        return labelMap[status] || '同步状态未知';
    },

    buildHeaderIndicatorHtml(syncStatus) {
        const status = syncStatus && syncStatus.syncStatus ? syncStatus.syncStatus : 'idle';
        const statusText = SyncStatusPresenter.getStatusLabel(syncStatus);
        const statusClass = `sync-indicator sync-indicator-${status}`;
        return `<span id="sync-status" class="${statusClass}">
            <span class="sync-indicator-icon">${this._getStatusIcon(status)}</span>
            <span class="sync-indicator-text">${statusText}</span>
        </span>`;
    },

    updateHeaderIndicator() {
        const container = document.getElementById('sync-status-container');
        if (!container) return;
        if (window.RuntimeConfigLoader && window.RuntimeConfigLoader.getStorageMode() !== 'hybrid') {
            container.innerHTML = '';
            return;
        }
        const syncStatus = window.SyncAppService ? window.SyncAppService.getSyncStatus() : {};
        container.innerHTML = SyncStatusPresenter.buildHeaderIndicatorHtml(syncStatus);
        const indicator = container.querySelector('#sync-status');
        if (indicator) {
            indicator.style.cursor = 'pointer';
            indicator.title = '点击查看同步详情';
            indicator.addEventListener('click', () => {
                if (window.SyncStatusPanelHelper) {
                    window.SyncStatusPanelHelper.show();
                } else {
                    window.Modal.show('syncTools');
                }
            });
        }
        SyncStatusPresenter.bindBannerClick();
    },

    _getStatusIcon(status) {
        const iconMap = {
            idle: '✓',
            syncing: '⟳',
            pending: '↑',
            error: '✗',
            conflict: '⚠'
        };
        return iconMap[status] || '?';
    },

    buildToolSectionHtml(syncStatus) {
        const lastErrorHtml = syncStatus && syncStatus.lastError
            ? `<div class="sync-info"><span class="status-label">失败原因:</span><span class="status-value">${syncStatus.lastError}</span></div>`
            : '';

        return `
            <div class="tool-section sync-status-section">
                <h4>云同步状态</h4>
                <div class="sync-info">
                    <span class="status-label">状态:</span>
                    <span class="status-value">${SyncStatusPresenter.getStatusLabel(syncStatus)}</span>
                </div>
                <div class="sync-info">
                    <span class="status-label">待同步:</span>
                    <span class="status-value">${syncStatus && syncStatus.pendingChanges || 0}</span>
                </div>
                <div class="sync-info">
                    <span class="status-label">云端版本:</span>
                    <span class="status-value">${syncStatus && syncStatus.cloudRevision || 0}</span>
                </div>
                ${lastErrorHtml}
                <div class="sync-actions">
                    <button class="btn btn-secondary" id="btn-manual-sync">立即同步</button>
                    <button class="btn btn-secondary" id="btn-force-push">强制上传本地</button>
                    <button class="btn btn-secondary" id="btn-force-pull">强制下载云端</button>
                </div>
            </div>
        `;
    },

    buildBannerHtml(syncStatus) {
        const status = syncStatus && syncStatus.syncStatus ? syncStatus.syncStatus : 'idle';
        const statusText = SyncStatusPresenter.getStatusLabel(syncStatus);
        const errorText = syncStatus && syncStatus.lastError ? ` · ${syncStatus.lastError}` : '';
        return `<div class="sync-status-banner sync-status-${status}" data-action="open-sync-tools">${statusText}${errorText} · 查看同步工具</div>`;
    },

    bindBannerClick() {
        document.addEventListener('click', function (e) {
            const banner = e.target.closest('[data-action="open-sync-tools"]');
            if (banner) {
                window.Modal.show('syncTools');
            }
        });
    },

    _buildSyncToolsBodyHtml(syncStatus, localSnapshot) {
        const localFunds = localSnapshot.funds || [];
        const localTrades = localSnapshot.trades || [];
        const cloudRevision = syncStatus && syncStatus.cloudRevision ? syncStatus.cloudRevision : 0;
        const cloudFunds = syncStatus && syncStatus.cloudFunds !== undefined ? syncStatus.cloudFunds : '-';
        const cloudTrades = syncStatus && syncStatus.cloudTrades !== undefined ? syncStatus.cloudTrades : '-';
        const lastSyncAt = syncStatus && syncStatus.lastSyncAt ? syncStatus.lastSyncAt : '-';
        const pendingChanges = syncStatus && syncStatus.pendingChanges ? syncStatus.pendingChanges : 0;
        const lastError = syncStatus && syncStatus.lastError ? syncStatus.lastError : '';

        const statusIcon = this._getStatusIcon(syncStatus && syncStatus.syncStatus ? syncStatus.syncStatus : 'idle');
        const statusText = SyncStatusPresenter.getStatusLabel(syncStatus);

        return `
            <div class="sync-tools-modal">
                <div class="sync-tools-row">
                    <div class="sync-tools-card">
                        <div class="sync-tools-card-header">
                            <span class="sync-tools-icon">☁️</span>
                            <span>云端</span>
                        </div>
                        <div class="sync-tools-card-body">
                            <div class="sync-tools-stat">
                                <span class="sync-tools-stat-value">${cloudRevision}</span>
                                <span class="sync-tools-stat-label">版本</span>
                            </div>
                            <div class="sync-tools-stat">
                                <span class="sync-tools-stat-value">${cloudFunds}</span>
                                <span class="sync-tools-stat-label">基金</span>
                            </div>
                            <div class="sync-tools-stat">
                                <span class="sync-tools-stat-value">${cloudTrades}</span>
                                <span class="sync-tools-stat-label">交易</span>
                            </div>
                        </div>
                    </div>
                    <div class="sync-tools-card">
                        <div class="sync-tools-card-header">
                            <span class="sync-tools-icon">💾</span>
                            <span>本地</span>
                        </div>
                        <div class="sync-tools-card-body">
                            <div class="sync-tools-stat">
                                <span class="sync-tools-stat-value">-</span>
                                <span class="sync-tools-stat-label">版本</span>
                            </div>
                            <div class="sync-tools-stat">
                                <span class="sync-tools-stat-value">${localFunds.length}</span>
                                <span class="sync-tools-stat-label">基金</span>
                            </div>
                            <div class="sync-tools-stat">
                                <span class="sync-tools-stat-value">${localTrades.length}</span>
                                <span class="sync-tools-stat-label">交易</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sync-tools-info">
                    <div class="sync-tools-info-row">
                        <span class="sync-tools-info-label">状态</span>
                        <span class="sync-tools-info-value">${statusIcon} ${statusText}</span>
                    </div>
                    <div class="sync-tools-info-row">
                        <span class="sync-tools-info-label">待同步</span>
                        <span class="sync-tools-info-value">${pendingChanges} 项</span>
                    </div>
                    <div class="sync-tools-info-row">
                        <span class="sync-tools-info-label">上次同步</span>
                        <span class="sync-tools-info-value">${lastSyncAt}</span>
                    </div>
                    ${lastError ? `<div class="sync-tools-info-row sync-tools-info-error">
                        <span class="sync-tools-info-label">失败原因</span>
                        <span class="sync-tools-info-value">${lastError}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    },

    _buildSyncToolsActionsHtml() {
        return `
            <button class="btn btn-secondary" id="btn-refresh-cloud">刷新云端数据</button>
            <button class="btn btn-primary" id="btn-manual-sync">立即同步</button>
            <button class="btn btn-secondary" id="btn-force-push">强制上传本地</button>
            <button class="btn btn-secondary" id="btn-force-pull">强制下载云端</button>
        `;
    },

    buildSyncToolsModalBody(syncStatus) {
        const localSnapshot = window.LocalStorageAdapter ? window.LocalStorageAdapter.loadSnapshot() : { funds: [], trades: [] };
        return {
            content: SyncStatusPresenter._buildSyncToolsBodyHtml(syncStatus, localSnapshot),
            actions: SyncStatusPresenter._buildSyncToolsActionsHtml()
        };
    },

    bindSyncToolsModalEvents() {
        this._bindSyncActionEvents();
    },

    _bindSyncActionEvents() {
        document.getElementById('btn-refresh-cloud')?.addEventListener('click', async () => {
            Utils.showLoading('刷新中...');
            await SyncAppService.refreshCloudMeta();
            Utils.hideLoading();
            SyncStatusPresenter.refreshSyncToolsModalContent();
        });

        document.getElementById('btn-manual-sync')?.addEventListener('click', async () => {
            Utils.showLoading('同步中...');
            const result = await SyncAppService.manualSync();
            Utils.hideLoading();
            if (result && result.firstSync) {
                if (window.SyncFirstSyncHelper) {
                    window.SyncFirstSyncHelper.show(result, async function (choice) {
                        await SyncAppService._handleFirstSyncChoice(choice);
                        Overview.refresh();
                        Modal.hide();
                    });
                }
            } else if (result.success) {
                Overview.refresh();
                Modal.hide();
            } else if (result.conflict) {
                SyncConflictModalHelper.show(result.conflicts, async (resolutions) => {
                    await SyncAppService.resolveConflicts(result.conflicts, resolutions);
                    Overview.refresh();
                });
            } else {
                Utils.showToast(result.reason || '同步失败', 'error');
            }
        });

        document.getElementById('btn-force-push')?.addEventListener('click', async () => {
            if (!confirm('确定强制上传本地数据覆盖云端吗？此操作不可撤销。')) return;
            Utils.showLoading('上传中...');
            const result = await SyncAppService.forcePushLocal();
            Utils.hideLoading();
            if (result.success) {
                Utils.showToast('强制上传成功', 'success');
                Overview.refresh();
                Modal.hide();
            } else {
                Utils.showToast(result.reason || '强制上传失败', 'error');
            }
        });

        document.getElementById('btn-force-pull')?.addEventListener('click', async () => {
            if (!confirm('确定强制下载云端数据覆盖本地吗？此操作不可撤销。')) return;
            Utils.showLoading('下载中...');
            const result = await SyncAppService.forceOverwriteLocal();
            Utils.hideLoading();
            if (result.success) {
                Utils.showToast('强制下载成功', 'success');
                Overview.refresh();
                Modal.hide();
            } else {
                Utils.showToast(result.reason || '强制下载失败', 'error');
            }
        });
    },

    refreshSyncToolsModalContent() {
        const modalBody = document.getElementById('modal-body');
        if (!modalBody) return;
        const syncToolsModal = modalBody.querySelector('.sync-tools-modal');
        if (!syncToolsModal) return;
        const freshStatus = SyncAppService.getSyncStatus();
        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        syncToolsModal.outerHTML = SyncStatusPresenter._buildSyncToolsBodyHtml(freshStatus, localSnapshot);
        SyncStatusPresenter._bindSyncActionEvents();
    }
};

ModuleRegistry.register('SyncStatusPresenter', SyncStatusPresenter);

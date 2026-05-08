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

    buildBannerHtml(syncStatus) {
        const status = syncStatus && syncStatus.syncStatus ? syncStatus.syncStatus : 'idle';
        const statusText = SyncStatusPresenter.getStatusLabel(syncStatus);
        const errorText = syncStatus && syncStatus.lastError ? ` · ${syncStatus.lastError}` : '';
        return `<div class="sync-status-banner sync-status-${status}" data-action="open-sync-tools">${statusText}${errorText} · 查看同步工具</div>`;
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
    }
};

ModuleRegistry.register('SyncStatusPresenter', SyncStatusPresenter);

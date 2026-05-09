const SyncAppService = {
    _syncInProgress: false,
    _pendingChanges: [],
    _pushTimeout: null,
    _retryCount: 0,
    _maxRetryCount: 3,
    _retryBaseDelay: 3000,

    _getNowIso() {
        return new Date().toISOString();
    },

    _toLogText(label, value) {
        if (value === undefined) {
            console.log(label);
            return;
        }

        try {
            console.log(label + ' ' + JSON.stringify(value));
        } catch (_error) {
            console.log(label + ' [日志序列化失败]');
        }
    },

    _finalizePushSuccess(result) {
        const now = SyncAppService._getNowIso();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        const currentSyncMeta = window.LocalStorageAdapter.getSyncMeta();

        snapshot.funds = (snapshot.funds || []).map(fund => ({
            ...fund,
            lastSyncedAt: now
        }));
        snapshot.trades = (snapshot.trades || []).map(trade => ({
            ...trade,
            lastSyncedAt: now
        }));

        window.LocalStorageAdapter.saveSnapshot(snapshot);
        window.LocalStorageAdapter.updateSyncMeta({
            lastSyncAt: now,
            lastPushedAt: now,
            cloudRevision: result.revision || currentSyncMeta.cloudRevision,
            syncStatus: 'idle',
            pendingChanges: 0,
            lastError: null
        });
    },

    async init(config = {}) {
        const { enabled, basePath, timeout } = config;

        if (enabled && basePath) {
            window.CloudflareD1SyncAdapter.init({
                basePath: basePath,
                timeout: timeout || 10000
            });
            window.SyncAdapterRegistry.registerCloudflareAdapter();

            const snapshot = window.LocalStorageAdapter.loadSnapshot();
            snapshot.syncMeta = { ...snapshot.syncMeta, provider: 'cloudflare' };
            window.LocalStorageAdapter.saveSnapshot(snapshot);
        } else {
            const snapshot = window.LocalStorageAdapter.loadSnapshot();
            snapshot.syncMeta = { ...snapshot.syncMeta, provider: 'local' };
            window.LocalStorageAdapter.saveSnapshot(snapshot);
        }

        this._setupEventListeners();

        if (document && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    return;
                }

                const syncMeta = window.LocalStorageAdapter.getSyncMeta();
                if ((syncMeta.pendingChanges || 0) > 0 && syncMeta.syncStatus === 'pending') {
                    this._executePush();
                }
            });
        }
    },

    _setupEventListeners() {
        EventBus.on(EventType.FUND_ADDED, () => SyncAppService._onDataChanged());
        EventBus.on(EventType.FUND_UPDATED, () => SyncAppService._onDataChanged());
        EventBus.on(EventType.FUND_DELETED, () => SyncAppService._onDataChanged());

        EventBus.on(EventType.TRADE_ADDED, () => SyncAppService._onDataChanged());
        EventBus.on(EventType.TRADE_UPDATED, () => SyncAppService._onDataChanged());
        EventBus.on(EventType.TRADE_DELETED, () => SyncAppService._onDataChanged());
    },

    async notifyBusinessDataChanged(source = 'unknown') {
        const adapter = window.SyncAdapterRegistry.getCurrentAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            console.log('[同步调试] 未找到可用同步适配器，跳过待同步标记');
            return;
        }

        const status = adapter.getStatus();
        if (!status || !status.canPush) {
            SyncAppService._toLogText('[同步调试] 当前适配器不可推送，跳过同步', status || null);
            return;
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const delay = SyncAppService._getPushDelay(source);
        const nextPendingChanges = (syncMeta.pendingChanges || 0) + 1;
        window.LocalStorageAdapter.updateSyncMeta({
            pendingChanges: nextPendingChanges,
            syncStatus: 'pending',
            lastPendingAt: new Date().toISOString(),
            pendingSource: source
        });

        clearTimeout(SyncAppService._pushTimeout);
        SyncAppService._pushTimeout = setTimeout(() => {
            SyncAppService._executePush();
        }, delay);

        SyncAppService._toLogText('[同步调试] 已标记业务变更，等待推送', {
            source,
            delay,
            provider: status.provider || 'unknown',
            pendingChanges: nextPendingChanges,
            cloudRevision: syncMeta.cloudRevision || 0
        });
    },

    _onDataChanged() {
        return SyncAppService.notifyBusinessDataChanged('event');
    },

    _getPushDelay(source) {
        const delayMap = {
            import: 0,
            clear: 0,
            'batch-delete': 1000,
            event: 2000,
            unknown: 5000
        };

        return delayMap[source] ?? 5000;
    },

    _emitSyncApplied(payload = {}) {
        EventBus.emit(EventType.SYNC_DATA_APPLIED, {
            source: 'sync',
            ...payload
        });
    },

    _scheduleRetry(reason) {
        if (SyncAppService._retryCount >= SyncAppService._maxRetryCount) {
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'error',
                lastError: reason || 'push_failed'
            });
            if (window.Utils && typeof window.Utils.showToast === 'function') {
                window.Utils.showToast('自动同步失败：' + (reason || 'push_failed'), 'error');
            }
            return;
        }

        SyncAppService._retryCount += 1;
        const delay = SyncAppService._retryBaseDelay * SyncAppService._retryCount;
        clearTimeout(SyncAppService._pushTimeout);
        SyncAppService._pushTimeout = setTimeout(() => {
            SyncAppService._executePush();
        }, delay);
    },

    async startBackgroundSync() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();

        // 检查 adapter 是否支持 checkAuthStatus 方法（CloudflareD1SyncAdapter 特有）
        if (typeof adapter.checkAuthStatus === 'function') {
            const authStatus = await adapter.checkAuthStatus();
            if (authStatus.authEnabled && !authStatus.authenticated) {
                return { needPassword: true, authStatus };
            }
        }

        return this._executePull();
    },

    async _executePull() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            console.log('[同步调试] pull 跳过：未找到可用同步适配器');
            return { success: true, reason: 'not_configured' };
        }

        const status = adapter.getStatus();

        if (!status.canPull) {
            SyncAppService._toLogText('[同步调试] pull 跳过：当前适配器不可拉取', status);
            return { success: true, reason: 'not_configured' };
        }

        SyncAppService._toLogText('[同步调试] 开始执行 pull', {
            provider: status.provider || 'unknown',
            cloudRevision: window.LocalStorageAdapter.getSyncMeta().cloudRevision || 0
        });
        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        const result = await adapter.pull();

        if (!result.success) {
            SyncAppService._toLogText('[同步调试] pull 失败', result);
            if (window.Utils && typeof window.Utils.showToast === 'function') {
                window.Utils.showToast('自动同步失败：' + (result.reason || 'pull_failed'), 'error');
            }
            return result;
        }

        SyncAppService._toLogText('[同步调试] pull 成功', {
            revision: result.revision || 0,
            funds: (result.funds || []).length,
            trades: (result.trades || []).length
        });

        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const localFunds = localSnapshot.funds || [];
        const localTrades = localSnapshot.trades || [];
        const cloudFunds = result.funds || [];
        const cloudTrades = result.trades || [];

        window.LocalStorageAdapter.updateSyncMeta({
            cloudFunds: cloudFunds.length,
            cloudTrades: cloudTrades.length
        });

        // 本地空，云端有数据 → 直接填充
        if ((localFunds.length === 0 && localTrades.length === 0) &&
            (cloudFunds.length > 0 || cloudTrades.length > 0)) {
            const newSnapshot = {
                ...localSnapshot,
                funds: cloudFunds,
                trades: cloudTrades
            };
            window.LocalStorageAdapter.saveSnapshot(newSnapshot);
            SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: true });
            return { success: true, reason: 'filled_from_cloud' };
        }

        // 本地有数据，云端为空（且 revision 有更新）→ 云端被清空了，用空数据覆盖本地
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const localCloudRevision = syncMeta.cloudRevision || 0;
        if ((localFunds.length > 0 || localTrades.length > 0) &&
            (cloudFunds.length === 0 && cloudTrades.length === 0) &&
            result.revision > localCloudRevision) {
            const newSnapshot = {
                ...localSnapshot,
                funds: [],
                trades: []
            };
            window.LocalStorageAdapter.saveSnapshot(newSnapshot);
            SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: true });
            return { success: true, reason: 'cleared_by_cloud' };
        }

        // 本地有数据 → 差异检测与合并
        const mergeResult = this._mergeData(localSnapshot, result);

        if (mergeResult.hasConflicts) {
            return {
                success: true,
                hasConflicts: true,
                conflicts: mergeResult.conflicts
            };
        }

        if (mergeResult.hasChanges) {
            window.LocalStorageAdapter.saveSnapshot(mergeResult.snapshot);
            SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: true });
        }

        adapter.markSyncComplete();

        return { success: true };
    },

    async _executePush() {
        if (SyncAppService._syncInProgress) {
            console.log('[同步调试] push 跳过：已有同步进行中');
            return { success: false, reason: 'sync_in_progress' };
        }

        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            console.log('[同步调试] push 跳过：未找到可用同步适配器');
            return { success: true, reason: 'not_configured' };
        }

        const status = adapter.getStatus();

        if (!status.canPush) {
            SyncAppService._toLogText('[同步调试] push 跳过：当前适配器不可推送', status);
            return { success: true, reason: 'not_configured' };
        }

        SyncAppService._syncInProgress = true;
        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        SyncAppService._toLogText('[同步调试] 开始执行 push', {
            provider: status.provider || 'unknown',
            funds: (localSnapshot.funds || []).length,
            trades: (localSnapshot.trades || []).length,
            pendingChanges: localSnapshot.syncMeta && localSnapshot.syncMeta.pendingChanges || 0,
            cloudRevision: localSnapshot.syncMeta && localSnapshot.syncMeta.cloudRevision || 0
        });
        const result = await adapter.push(localSnapshot.funds, localSnapshot.trades);

        SyncAppService._syncInProgress = false;

        if (result.conflict) {
            SyncAppService._toLogText('[同步调试] push 检测到冲突', {
                conflicts: (result.conflicts || []).length
            });
            return {
                success: false,
                reason: 'conflict',
                conflicts: result.conflicts
            };
        }

        if (!result.success) {
            SyncAppService._toLogText('[同步调试] push 失败，准备重试', result);
            if (window.Utils && typeof window.Utils.showToast === 'function') {
                window.Utils.showToast('自动同步失败：' + (result.reason || 'push_failed'), 'error');
            }
            SyncAppService._scheduleRetry(result.reason);
            return result;
        }

        if (result.success) {
            SyncAppService._toLogText('[同步调试] push 成功', {
                revision: result.revision || 0
            });
            SyncAppService._retryCount = 0;
            SyncAppService._finalizePushSuccess(result);
        }

        return result;
    },

    _mergeData(localSnapshot, cloudSnapshot) {
        const localFunds = localSnapshot.funds || [];
        const localTrades = localSnapshot.trades || [];
        const cloudFunds = cloudSnapshot.funds || [];
        const cloudTrades = cloudSnapshot.trades || [];

        const conflicts = [];
        const mergedFunds = this._mergeEntities(localFunds, cloudFunds, 'fund', conflicts);
        const mergedTrades = this._mergeEntities(localTrades, cloudTrades, 'trade', conflicts);

        const hasChanges = mergedFunds.hasChanges || mergedTrades.hasChanges;

        return {
            hasChanges,
            hasConflicts: conflicts.length > 0,
            conflicts,
            snapshot: {
                ...localSnapshot,
                funds: mergedFunds.result,
                trades: mergedTrades.result
            }
        };
    },

    _isEntityDataChanged(local, cloud) {
        const skipKeys = new Set(['updatedAt', 'createdAt', 'deletedAt', 'lastSyncedAt', 'updateTime', 'createTime', 'deleteTime', 'syncId', 'id']);
        const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
        for (const key of keys) {
            if (skipKeys.has(key)) continue;
            if (JSON.stringify(local[key]) !== JSON.stringify(cloud[key])) return true;
        }
        return false;
    },

    _mergeEntities(localEntities, cloudEntities, entityType, conflicts) {
        const localMap = new Map(localEntities.map(e => [e.syncId, e]));
        const cloudMap = new Map(cloudEntities.map(e => [e.syncId, e]));

        const result = [];
        let hasChanges = false;

        for (const [syncId, localEntity] of localMap) {
            const cloudEntity = cloudMap.get(syncId);

            if (!cloudEntity) {
                result.push(localEntity);
                continue;
            }

            const baseTime = localEntity.lastSyncedAt || 0;

            if (localEntity.updatedAt > baseTime && cloudEntity.updatedAt > baseTime) {
                if (this._isEntityDataChanged(localEntity, cloudEntity)) {
                    conflicts.push({
                        entityType,
                        syncId,
                        local: localEntity,
                        cloud: cloudEntity
                    });
                }
                result.push(localEntity);
                hasChanges = true;
            } else if (cloudEntity.updatedAt > baseTime) {
                result.push(cloudEntity);
                hasChanges = true;
            } else {
                result.push(localEntity);
            }
        }

        for (const [syncId, cloudEntity] of cloudMap) {
            if (!localMap.has(syncId)) {
                result.push(cloudEntity);
                hasChanges = true;
            }
        }

        return { result, hasChanges };
    },

    async resolveConflicts(conflicts, resolutions) {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();

        const resolvedFunds = [];
        const resolvedTrades = [];

        conflicts.forEach((conflict, index) => {
            const resolution = resolutions[index];
            if (resolution === 'local') {
                if (conflict.entityType === 'fund') {
                    resolvedFunds.push(conflict.local);
                } else {
                    resolvedTrades.push(conflict.local);
                }
            } else if (resolution === 'cloud') {
                if (conflict.entityType === 'fund') {
                    resolvedFunds.push(conflict.cloud);
                } else {
                    resolvedTrades.push(conflict.cloud);
                }
            }
        });

        const result = await adapter.resolve(conflicts, resolutions);
        if (result && result.success) {
            SyncAppService._emitSyncApplied({ mode: 'resolve', hasChanges: true });
        }
        return result;
    },

    async manualSync() {
        await this._executePull();
        return this._executePush();
    },

    async forcePushLocal() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();

        window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: 0 });

        return adapter.push(snapshot.funds, snapshot.trades);
    },

    async forcePullCloud() {
        window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: 0 });
        return this._executePull();
    },

    async refreshCloudMeta() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') return;
        const status = adapter.getStatus();
        if (!status || !status.canPull) return;
        const result = await adapter.pull();
        if (result && result.success) {
            window.LocalStorageAdapter.updateSyncMeta({
                cloudRevision: result.revision || 0,
                cloudFunds: (result.funds || []).length,
                cloudTrades: (result.trades || []).length
            });
        }
    },

    getSyncStatus() {
        return window.LocalStorageAdapter.getSyncMeta();
    }
};

ModuleRegistry.register('SyncAppService', SyncAppService);

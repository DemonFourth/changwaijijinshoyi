const SyncAppService = {
    _syncInProgress: false,
    _pendingChanges: [],
    _pushTimeout: null,

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
            return;
        }

        const status = adapter.getStatus();
        if (!status || !status.canPush) {
            return;
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const delay = SyncAppService._getPushDelay(source);
        window.LocalStorageAdapter.updateSyncMeta({
            pendingChanges: (syncMeta.pendingChanges || 0) + 1,
            syncStatus: 'pending',
            lastPendingAt: new Date().toISOString(),
            pendingSource: source
        });

        clearTimeout(SyncAppService._pushTimeout);
        SyncAppService._pushTimeout = setTimeout(() => {
            SyncAppService._executePush();
        }, delay);

        console.log(`[SyncAppService] notifyBusinessDataChanged: source=${source}, delay=${delay}ms`);
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
            return { success: true, reason: 'not_configured' };
        }

        const status = adapter.getStatus();

        if (!status.canPull) {
            return { success: true, reason: 'not_configured' };
        }

        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        const result = await adapter.pull();

        if (!result.success) {
            return result;
        }

        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const localFunds = localSnapshot.funds || [];
        const localTrades = localSnapshot.trades || [];
        const cloudFunds = result.funds || [];
        const cloudTrades = result.trades || [];

        // 本地空，云端有数据 → 直接填充
        if ((localFunds.length === 0 && localTrades.length === 0) &&
            (cloudFunds.length > 0 || cloudTrades.length > 0)) {
            const newSnapshot = {
                ...localSnapshot,
                funds: cloudFunds,
                trades: cloudTrades
            };
            window.LocalStorageAdapter.saveSnapshot(newSnapshot);
            return { success: true, reason: 'filled_from_cloud' };
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
        }

        adapter.markSyncComplete();

        return { success: true };
    },

    async _executePush() {
        if (SyncAppService._syncInProgress) {
            return { success: false, reason: 'sync_in_progress' };
        }

        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            return { success: true, reason: 'not_configured' };
        }

        const status = adapter.getStatus();

        if (!status.canPush) {
            return { success: true, reason: 'not_configured' };
        }

        SyncAppService._syncInProgress = true;
        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const result = await adapter.push(localSnapshot.funds, localSnapshot.trades);

        SyncAppService._syncInProgress = false;

        if (result.conflict) {
            return {
                success: false,
                reason: 'conflict',
                conflicts: result.conflicts
            };
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
                conflicts.push({
                    entityType,
                    syncId,
                    local: localEntity,
                    cloud: cloudEntity
                });
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

        return adapter.resolve(conflicts, resolutions);
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

    getSyncStatus() {
        return window.LocalStorageAdapter.getSyncMeta();
    }
};

ModuleRegistry.register('SyncAppService', SyncAppService);
